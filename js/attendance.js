// Attendance + leave calculations for the signed-in employee (pure functions, no DOM).

import { iso, parseISO, pad, seeded, daysInMonth, todayISO } from './utils.js';
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

/** The Nth working day before `fromISO` (Sunday and holidays skipped). */
function workingDayBefore(fromISO, n) {
  const d = parseISO(fromISO);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && !hMap[iso(d)]) left--;
  }
  return iso(d);
}

const hhmm = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

/**
 * What a single day looks like.
 * Returns { code, in, out, hours, note, explicit }.
 *  code: P A CL SL EL OD H OFF R ? Q(regularization pending) - (future)
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

  if (date === today) {
    const c = state.checkin;
    if (c.date === today && c.in) return { code: 'P', in: c.in, out: c.out, note: c.out ? '' : 'Working' };
    return { code: '-', note: 'Not checked in yet' };
  }

  if (state.regularizations[date]) return { code: 'Q', note: 'Regularization pending' };

  const currentMonth = date.slice(0, 7) === today.slice(0, 7);
  // One recent day is always left unmarked so the "Regularize" flow is demonstrable.
  const missing = currentMonth && (date === workingDayBefore(today, 3) || seeded('missing' + date) < 0.05);
  if (missing) return { code: '?', note: 'No check-in recorded' };

  const inMin = 9 * 60 + Math.floor(seeded('in' + date) * 28);
  const outMin = 18 * 60 + Math.floor(seeded('out' + date) * 45);
  const worked = outMin - inMin;
  return {
    code: 'P', in: hhmm(inMin), out: hhmm(outMin),
    hours: worked, note: `${Math.floor(worked / 60)}h ${pad(worked % 60)}m`,
  };
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
