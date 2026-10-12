// Attendance + leave calculations for the signed-in employee (pure functions, no DOM).

import { iso, parseISO, pad, daysInMonth, todayISO } from './utils.js';
import { LEAVE_POLICY, holidayMap } from './data.js';

const hMap = holidayMap();

/** Working days (Mon–Sat minus holidays; Sunday is the weekly off) between two ISO dates, inclusive. */
export function countWorkingDays(fromISO, toISO) {
  let n = 0;
  const d = parseISO(fromISO);
  const end = parseISO(toISO);
  while (d <= end) {
    if (d.getDay() !== 0 && !hMap[iso(d)]) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/** Leave balance per type for the current calendar year (pending + approved requests both reserve days). */
export function leaveBalances(state, year = new Date().getFullYear()) {
  const used = { CL: 0, SL: 0, EL: 0 };
  state.leaves.forEach((l) => {
    if (l.status !== 'rejected' && l.from.startsWith(String(year))) used[l.type] += l.days;
  });
  return Object.fromEntries(Object.keys(LEAVE_POLICY).map((k) => [k, {
    total: LEAVE_POLICY[k], used: used[k], left: Math.max(LEAVE_POLICY[k] - used[k], 0),
  }]));
}

function leaveOn(state, date) {
  return state.leaves.find((l) => l.status !== 'rejected' && date >= l.from && date <= l.to) || null;
}

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/**
 * What a single day looks like — built only from records made in this app (check-ins, leave, overrides).
 * Returns { code, in, out, hours, note, explicit }.
 *  code: P A CL SL EL OD H OFF R ? Q(regularization pending) - (future / no record)
 */
export function dayInfo(state, date) {
  const today = todayISO();
  const d = parseISO(date);
  const override = state.attendanceOverrides[date];
  if (override) return { code: override.code, note: override.note || '', explicit: true };

  if (hMap[date]) return { code: 'H', note: hMap[date] };
  if (d.getDay() === 0) return { code: 'OFF', note: 'Weekly off' };

  const leave = leaveOn(state, date);
  if (leave) return { code: leave.type, note: `${leave.status === 'pending' ? 'Pending · ' : ''}${leave.reason}` };

  if (date > today) return { code: '-', note: '' };

  const punch = (state.punches || {})[date];
  if (punch && punch.in) {
    const worked = punch.out ? toMin(punch.out) - toMin(punch.in) : 0;
    return {
      code: 'P', in: punch.in, out: punch.out,
      hours: worked > 0 ? worked : 0,
      note: punch.out ? `${Math.floor(worked / 60)}h ${pad(worked % 60)}m` : (date === today ? 'Working' : 'No check-out recorded'),
    };
  }
  if (date === today) return { code: '-', note: 'Not checked in yet' };

  // Before this device started recording there is simply no data — never fabricate presence.
  if (date < (state.since || today)) return { code: '-', note: 'No record' };

  if (state.regularizations[date]) return { code: 'Q', note: 'Regularization pending' };
  return { code: '?', note: 'No check-in recorded' };
}

/** Month roll-up used by the Time screen. */
export function monthSummary(state, key) {
  const [y, m] = key.split('-').map(Number);
  const s = { present: 0, leave: 0, holiday: 0, off: 0, absent: 0, unmarked: 0, minutes: 0, workedDays: 0 };
  for (let day = 1; day <= daysInMonth(y, m); day++) {
    const info = dayInfo(state, `${y}-${pad(m)}-${pad(day)}`);
    if (info.code === 'P' || info.code === 'OD') { s.present++; if (info.hours) { s.minutes += info.hours; s.workedDays++; } }
    else if (['CL', 'SL', 'EL'].includes(info.code)) s.leave++;
    else if (info.code === 'H') s.holiday++;
    else if (info.code === 'OFF') s.off++;
    else if (info.code === 'A') s.absent++;
    else if (info.code === '?' || info.code === 'Q') s.unmarked++;
  }
  s.avgHours = s.workedDays ? (s.minutes / s.workedDays / 60) : 0;
  return s;
}
