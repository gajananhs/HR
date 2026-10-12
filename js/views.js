// View templates. Each view is a pure function: (state) => HTML string.
// All dynamic text is escaped with esc(). Fields missing from the source data render as "Not on file".

import {
  esc, money, pad, todayISO, monthKey, monthLabel, addMonths, fmtDay, fmtShort, fmtLong,
  initials, daysInMonth,
} from './utils.js';
import {
  EMPLOYEES, ME_ID, DEPARTMENTS, UNASSIGNED, LEAVE_POLICY, LEAVE_LABEL, ATT_CODES, HOLIDAYS, HOLIDAYS_SOURCE,
  EVENTS, DOC_TYPES, PERMISSION_KINDS, EXPENSE_CATS, holidayMap, byId, kpiFor, KPI_REVIEWS, DATA_SOURCES,
  SKILL_MATRICES, SKILL_SCALE, SKILL_MAX, scoreSkills, skillsFor,
} from './data.js';
import { dayInfo, leaveBalances, monthSummary } from './attendance.js';
import { payrollStatus, payrollMeta, payrollData, rowFor, EARN_LABELS, DED_LABELS } from './payroll.js';

/** UI-only state (not persisted): selected month, tab, filters. */
export const ui = {
  timeMonth: monthKey(new Date()),
  paySl: null,
  payFilter: 'all',
  perfEmp: ME_ID,
  perfIdx: 0,
  reqTab: 'advance',
  peopleQ: '',
  peopleDept: 'All',
  skillIdx: null,
  skillPerson: null,
};

const me = () => byId(ME_ID);
const hMap = holidayMap();
const NOF = '<span class="nof">Not on file</span>';
const val = (v, f = (x) => esc(x)) => (v === null || v === undefined || v === '' ? NOF : f(v));

const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export const ICONS = {
  home: svg('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>'),
  time: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
  leave: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  pay: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
  more: svg('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'),
  people: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 010 5.6M18 14.4c1.8.9 3 2.8 3 5.6"/>'),
  perf: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  skills: svg('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
  docs: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  requests: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  chevron: svg('<path d="M9 6l6 6-6 6"/>'),
  back: svg('<path d="M15 6l-6 6 6 6"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
};

export const NAV = [
  { route: 'home', label: 'Home', icon: 'home', mobile: true },
  { route: 'time', label: 'Time', icon: 'time', mobile: true },
  { route: 'leave', label: 'Leave', icon: 'leave', mobile: true },
  { route: 'pay', label: 'Pay', icon: 'pay', mobile: true },
  { route: 'more', label: 'More', icon: 'more', mobile: true, desktopHidden: true },
  { sep: true },
  { route: 'people', label: 'People', icon: 'people' },
  { route: 'requests', label: 'Requests', icon: 'requests' },
  { route: 'performance', label: 'Performance', icon: 'perf' },
  { route: 'skills', label: 'Skills', icon: 'skills' },
  { route: 'documents', label: 'Documents', icon: 'docs' },
];

export const pendingApprovals = (state) => state.approvals.filter((a) => a.status === 'pending').length;

const badge = (status) => {
  const map = { approved: ['ok', 'Approved'], pending: ['pending', 'Pending'], rejected: ['no', 'Rejected'], paid: ['ok', 'Paid'] };
  const [cls, label] = map[status] || ['pending', status];
  return `<span class="badge ${cls}">${label}</span>`;
};

const header = (kicker, title, id, extra = '') =>
  `<div class="app-header"><div class="greet"><p>${esc(kicker)}</p><h1 id="${id}">${esc(title)}</h1></div>${extra}</div>`;

const skillPeople = () => SKILL_MATRICES.flatMap((m) => m.employees);

/* =========================================================== HOME */
export function homeView(state) {
  const today = todayISO();
  const user = me();
  const first = user.name.split(/\s+/).find((t) => t.length > 1) || user.name;
  const bal = leaveBalances(state);
  const leftTotal = Object.values(bal).reduce((s, b) => s + b.left, 0);
  const c = state.checkin;
  const checkedIn = c.date === today && c.in && !c.out;
  const done = c.date === today && c.in && c.out;
  const sub = done ? `Checked out at ${c.out} · have a good evening`
    : checkedIn ? `Checked in at ${c.in}` : 'Not checked in yet';
  const btnLabel = checkedIn ? 'Check out' : done ? 'Day complete' : 'Check in';

  const approvals = state.approvals.filter((a) => a.status === 'pending');
  const upcoming = [
    ...HOLIDAYS.filter((h) => h.date >= today).slice(0, 3).map((h) => ({ date: h.date, name: h.name, tag: 'Holiday' })),
    ...EVENTS.filter((e) => e.date >= today).map((e) => ({ date: e.date, name: e.name, tag: 'Event' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const sp = skillPeople();

  return `<section class="view" aria-labelledby="h-home">
    <div class="app-header">
      <div class="greet"><p id="today-str">${esc(new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }))}</p><h1 id="h-home">Hi, ${esc(first)}</h1></div>
      <a class="avatar" href="#/people/${ME_ID}" aria-label="My profile">${esc(initials(user.name))}</a>
    </div>
    <div class="cols">
      <div class="col">
        <div class="hero">
          <div class="label">TODAY</div>
          <div class="time" id="clock" aria-live="off">00:00:00</div>
          <div class="sub" id="checkin-sub">${esc(sub)}</div>
          <button class="checkin-btn${checkedIn ? ' checked' : ''}" data-action="checkin" ${done ? 'disabled' : ''}>${btnLabel}</button>
        </div>
        <div class="stat-strip" role="list">
          <div class="stat" role="listitem"><div class="num">${EMPLOYEES.length}</div><div class="lbl">Employees</div></div>
          <div class="stat" role="listitem"><div class="num">${pendingApprovals(state)}</div><div class="lbl">Approvals</div></div>
          <div class="stat" role="listitem"><div class="num">${leftTotal}</div><div class="lbl">Leave days left</div></div>
          <div class="stat" role="listitem"><div class="num">${sp.length}</div><div class="lbl">In skill matrix</div></div>
        </div>
        <div class="card">
          <h3>Team attendance</h3>
          <div class="empty">No team attendance feed is connected.</div>
          <p class="footnote">Team presence comes from LOGBOOK in the CAPL HR backend. This app only shows check-ins made on this device, so no team figures are displayed here.</p>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <h3>Pending approvals <a href="#/requests">See all</a></h3>
          ${approvals.length ? approvals.map((a) => approvalRow(a)).join('') : '<div class="empty">You\'re all caught up.</div>'}
        </div>
        <div class="card">
          <h3>Upcoming</h3>
          ${upcoming.length ? upcoming.map((u) => `<div class="row-item"><div><div class="pname">${esc(u.name)}</div><div class="psub">${u.tag} · ${esc(fmtShort(u.date))}</div></div></div>`).join('') : '<div class="empty">Nothing scheduled.</div>'}
          <p class="footnote">${esc(HOLIDAYS_SOURCE)}.</p>
        </div>
        ${dataStatusCard()}
      </div>
    </div>
  </section>`;
}

export function dataStatusCard() {
  const sp = skillPeople();
  const linked = sp.filter((e) => e.code).length;
  const ps = payrollStatus();
  const meta = payrollMeta();
  const payTxt = ps === 'none' ? 'Not loaded on this device' : `${monthLabel(meta.month)} · ${meta.rows} rows · ${ps === 'unlocked' ? 'unlocked' : 'locked'}`;
  const kpiCount = Object.values(KPI_REVIEWS).flat().length;
  return `<div class="card">
    <h3>Data status</h3>
    <div class="mini-row"><span>Employee master</span><span>${EMPLOYEES.length} employees</span></div>
    <div class="mini-row"><span>Skill matrices</span><span>${SKILL_MATRICES.length} sheets · ${sp.length} people · ${linked} linked</span></div>
    <div class="mini-row"><span>Payroll</span><span>${esc(payTxt)}</span></div>
    <div class="mini-row"><span>KPI reviews</span><span>${kpiCount ? kpiCount + ' reviews' : 'None supplied'}</span></div>
    <p class="footnote">Source: ${esc(DATA_SOURCES.master)} (imported ${esc(fmtLong(DATA_SOURCES.importedOn))}). Department and role are known only for employees linked to a skill matrix.</p>
  </div>`;
}

function approvalRow(a) {
  const e = byId(a.empId);
  return `<div class="row-item">
    <div><div class="pname">${esc(e ? e.name : a.empId)}</div><div class="psub">${esc(a.detail)}</div></div>
    <div class="right-cluster">
      <button class="btn-ghost ok" data-action="approve" data-id="${esc(a.id)}" aria-label="Approve request from ${esc(e ? e.name : a.empId)}">Approve</button>
      <button class="btn-ghost no" data-action="reject" data-id="${esc(a.id)}" aria-label="Reject request from ${esc(e ? e.name : a.empId)}">Reject</button>
    </div>
  </div>`;
}

/* =========================================================== TIME */
export function timeView(state) {
  const key = ui.timeMonth;
  const [y, m] = key.split('-').map(Number);
  const today = todayISO();
  const isCurrent = key === monthKey(new Date());
  const sum = monthSummary(state, key);
  const days = daysInMonth(y, m);
  const first = new Date(y, m - 1, 1).getDay();

  const cells = [];
  for (let i = 0; i < first; i++) cells.push('<div class="cal-cell empty-cell" aria-hidden="true"></div>');
  for (let d = 1; d <= days; d++) {
    const date = `${y}-${pad(m)}-${pad(d)}`;
    const info = dayInfo(state, date);
    const cls = info.code === 'P' || info.code === 'OD' ? 'P' : ['CL', 'SL', 'EL'].includes(info.code) ? 'L'
      : info.code === 'H' ? 'H' : info.code === 'OFF' ? 'OFF' : info.code === '?' || info.code === 'A' ? 'A' : info.code === 'Q' ? 'L' : '';
    cells.push(`<div class="cal-cell ${cls}${date === today ? ' today' : ''}" title="${esc(fmtDay(date))} — ${esc(date > today ? 'Upcoming' : ATT_CODES[info.code] || info.note)}">
      <span class="d">${d}</span><span class="c">${esc(info.code === '-' ? '' : info.code)}</span></div>`);
  }

  const log = [];
  for (let d = days; d >= 1 && log.length < 7; d--) {
    const date = `${y}-${pad(m)}-${pad(d)}`;
    if (date > today) continue;
    const info = dayInfo(state, date);
    if (['OFF', '-'].includes(info.code)) continue;
    log.push({ date, info });
  }

  return `<section class="view" aria-labelledby="h-time">
    <div class="app-header">
      <div class="greet"><p>${esc(monthLabel(key))}</p><h1 id="h-time">Attendance</h1></div>
      <div class="month-nav">
        <button data-action="month-prev" aria-label="Previous month">${ICONS.back.replace('<svg', '<svg width="16" height="16"')}</button>
        <span>${esc(monthLabel(key))}</span>
        <button data-action="month-next" aria-label="Next month" ${isCurrent ? 'disabled' : ''}>${ICONS.chevron.replace('<svg', '<svg width="16" height="16"')}</button>
      </div>
    </div>
    <div class="stat-strip">
      <div class="stat"><div class="num">${sum.present}</div><div class="lbl">Days present</div></div>
      <div class="stat"><div class="num">${sum.leave}</div><div class="lbl">Leave days</div></div>
      <div class="stat"><div class="num">${sum.unmarked}</div><div class="lbl">Unmarked</div></div>
      <div class="stat"><div class="num">${sum.avgHours ? sum.avgHours.toFixed(1) + 'h' : '—'}</div><div class="lbl">Avg. hours / day</div></div>
    </div>
    <div class="cols cols-wide">
      <div class="col">
        <div class="card">
          <h3>Month view</h3>
          <div class="cal" role="grid" aria-label="Attendance calendar for ${esc(monthLabel(key))}">
            ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('')}${cells.join('')}
          </div>
          <div class="legend">
            <span><i style="background:var(--sage-soft)"></i>P Present</span>
            <span><i style="background:var(--amber-soft)"></i>CL / SL / EL Leave</span>
            <span><i style="background:var(--cream);border:1px solid var(--line)"></i>H Holiday · OFF Weekly off</span>
            <span><i style="background:var(--red-soft)"></i>? Not marked</span>
          </div>
          <p class="footnote">Blank past days: no record — this device started recording on ${esc(fmtLong(state.since))}. Earlier attendance lives in LOGBOOK.</p>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <h3>Daily log</h3>
          ${log.length ? log.map(({ date, info }) => logRow(date, info)).join('') : '<div class="empty">No records for this month yet.</div>'}
          <p class="footnote">Regularization requests route to your reporting manager and must be filed within 3 working days of the missed punch, per company attendance policy.</p>
        </div>
      </div>
    </div>
  </section>`;
}

function logRow(date, info) {
  const name = esc(fmtDay(date));
  const mgr = me().manager;
  if (info.code === 'P' || info.code === 'OD') {
    const sub = info.in ? `${esc(info.in)} → ${esc(info.out || '…')}${info.note ? ' · ' + esc(info.note) : ''}` : esc(info.note || 'Present');
    return `<div class="row-item"><div><div class="pname">${name}</div><div class="psub">${sub}</div></div><span class="badge ok">Present</span></div>`;
  }
  if (info.code === '?') {
    return `<div class="row-item"><div><div class="pname">${name}</div><div class="psub">No check-in recorded</div></div><button class="btn-ghost" data-action="regularize" data-date="${date}">Regularize</button></div>`;
  }
  if (info.code === 'Q') {
    return `<div class="row-item"><div><div class="pname">${name}</div><div class="psub">Regularization submitted${mgr ? ' to ' + esc(mgr) : ''}</div></div><span class="badge pending">Pending</span></div>`;
  }
  if (['CL', 'SL', 'EL'].includes(info.code)) {
    return `<div class="row-item"><div><div class="pname">${name}</div><div class="psub">${esc(info.note)}</div></div><span class="badge pending">${esc(ATT_CODES[info.code])}</span></div>`;
  }
  return `<div class="row-item"><div><div class="pname">${name}</div><div class="psub">${esc(info.note || ATT_CODES[info.code] || '')}</div></div><span class="badge ok">${esc(ATT_CODES[info.code] || info.code)}</span></div>`;
}

/* =========================================================== LEAVE */
export function leaveView(state) {
  const bal = leaveBalances(state);
  const total = Object.values(bal).reduce((s, b) => s + b.total, 0);
  const left = Object.values(bal).reduce((s, b) => s + b.left, 0);
  const pct = Math.round((left / total) * 100);
  const user = me();
  const history = [...state.leaves].sort((a, b) => b.from.localeCompare(a.from));
  const year = new Date().getFullYear();

  return `<section class="view" aria-labelledby="h-leave">
    ${header('Time off', 'Leave', 'h-leave')}
    <div class="cols">
      <div class="col">
        <div class="card">
          <h3>Balance <button class="link-btn" data-action="policy">Leave policy</button></h3>
          <div class="leave-ring">
            <div class="ring" style="background:conic-gradient(var(--amber) 0% ${pct}%, var(--sage-soft) ${pct}% 100%)" role="img" aria-label="${left} of ${total} leave days remaining">
              <div class="ring-inner"><b>${left}</b><small>of ${total}</small></div>
            </div>
            <div class="ring-text">${Object.keys(bal).map((k) => `${bal[k].left} of ${bal[k].total} ${LEAVE_LABEL[k].toLowerCase()} left`).join('<br>')}</div>
          </div>
          <p class="footnote">Balance counts only leave requested in this app — opening balances were not supplied.</p>
        </div>
        <div class="card">
          <h3>New request</h3>
          <form data-form="leave" novalidate>
            <div class="field"><label for="leave-type">Leave type</label>
              <select id="leave-type" name="type">${Object.keys(bal).map((k) => `<option value="${k}">${LEAVE_LABEL[k]} leave (${bal[k].left} left)</option>`).join('')}</select></div>
            <div class="field-row">
              <div class="field"><label for="leave-from">From</label><input type="date" id="leave-from" name="from"></div>
              <div class="field"><label for="leave-to">To</label><input type="date" id="leave-to" name="to"></div>
            </div>
            <div class="field"><label for="leave-reason">Reason</label><textarea id="leave-reason" name="reason" placeholder="A short note for your manager" maxlength="200"></textarea></div>
            <div class="error-text" data-error hidden role="alert"></div>
            <button class="btn-primary" type="submit">Submit request</button>
          </form>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <h3>Recent requests</h3>
          ${history.length ? history.map((l) => `<div class="row-item"><div><div class="pname">${LEAVE_LABEL[l.type]} · ${esc(fmtShort(l.from))}${l.to !== l.from ? ' – ' + esc(fmtShort(l.to)) : ''}</div><div class="psub">${l.days} day${l.days > 1 ? 's' : ''} · ${esc(l.reason || '—')}</div></div>${badge(l.status)}</div>`).join('') : '<div class="empty">No leave requests yet.</div>'}
        </div>
        <div class="card">
          <h3>Employment details</h3>
          <div class="mini-row"><span>Employee code</span><span>${esc(user.id)}</span></div>
          <div class="mini-row"><span>Date of joining</span><span>${val(user.joined, fmtLong)}</span></div>
          <div class="mini-row"><span>Status</span><span>${val(user.status)}</span></div>
          <div class="mini-row"><span>Department</span><span>${val(user.dept)}</span></div>
          <div class="mini-row"><span>Reporting manager</span><span>${val(user.manager)}</span></div>
          <p class="footnote">Leave is counted per calendar year (${year}). Sundays and company holidays are not deducted. Leave beyond your balance is treated as loss of pay in salary.</p>
        </div>
      </div>
    </div>
  </section>`;
}

export function policyDialogBody() {
  return Object.keys(LEAVE_POLICY).map((k) => `<div class="mini-row"><span>${LEAVE_LABEL[k]} leave (${k})</span><span>${LEAVE_POLICY[k]} days / year</span></div>`).join('');
}

/* =========================================================== PAY (restricted) */
const amt = (v) => (v === null || v === undefined ? '—' : money(v));

function slipBreakdown(r) {
  const earn = EARN_LABELS.filter(([k]) => r.earned[k]).map(([k, l]) => `<div class="bd-row"><span>${l}</span><span>${money(r.earned[k])}</span></div>`).join('');
  const ded = DED_LABELS.filter(([k]) => r.ded[k]).map(([k, l]) => `<div class="bd-row"><span>${l}</span><span>−${money(r.ded[k])}</span></div>`).join('');
  return `<div class="breakdown">
    ${earn}
    <div class="bd-row sub"><span>Gross salary</span><span>${amt(r.gross)}</span></div>
    <div style="height:4px"></div>
    ${ded}
    <div class="bd-row sub"><span>Total deductions</span><span>−${amt(r.totalDed)}</span></div>
    <div class="bd-row bd-total"><span>Net salary</span><span>${amt(r.net)}</span></div>
  </div>
  <div style="height:8px"></div>
  <div class="mini-row"><span>Pay days</span><span>${r.payDays ?? '—'} of ${r.wageDays ?? '—'}</span></div>
  <div class="mini-row"><span>OT hours</span><span>${r.otHrs ?? 0}</span></div>
  <div class="mini-row"><span>Fixed wages (monthly)</span><span>${amt(r.fixedWages)}</span></div>
  <div class="mini-row"><span>CTC (monthly)</span><span>${amt(r.ctc)}</span></div>
  <div class="mini-row"><span>PF wages · ESI wages</span><span>${amt(r.pfWages)} · ${amt(r.esiWages)}</span></div>
  <div class="mini-row"><span>Date of joining</span><span>${val(r.doj, fmtLong)}</span></div>
  <div class="mini-row"><span>UAN</span><span>${val(r.uan)}</span></div>`;
}

export function payView() {
  const status = payrollStatus();
  if (status === 'none') {
    return `<section class="view" aria-labelledby="h-pay">
      ${header('Restricted · HR only', 'Payroll', 'h-pay')}
      <div class="cols"><div class="col"><div class="card">
        <h3>${ICONS.lock.replace('<svg', '<svg width="15" height="15" style="vertical-align:-2px;margin-right:4px"')}Payroll is not loaded on this device</h3>
        <p class="psub" style="margin-bottom:12px;line-height:1.6">Salary figures are not part of the app. An authorised HR user imports the wages-register file here; it is encrypted with a passcode before it is saved on this device.</p>
        <form data-form="payroll-import" novalidate>
          <div class="field"><label for="pr-file">Wages register file (.json)</label><input id="pr-file" name="file" type="file" accept=".json,application/json"></div>
          <div class="field-row">
            <div class="field"><label for="pr-pass">Passcode</label><input id="pr-pass" name="pass" type="password" autocomplete="new-password" minlength="6"></div>
            <div class="field"><label for="pr-pass2">Confirm</label><input id="pr-pass2" name="pass2" type="password" autocomplete="new-password"></div>
          </div>
          <div class="error-text" data-error hidden role="alert"></div>
          <button class="btn-primary" type="submit">Import &amp; encrypt</button>
        </form>
      </div></div>
      <div class="col"><div class="card"><h3>How access is restricted</h3>
        <div class="mini-row"><span>Bundled in the app</span><span>No salary data</span></div>
        <div class="mini-row"><span>Stored on device</span><span>AES-256 encrypted</span></div>
        <div class="mini-row"><span>Unlock</span><span>Passcode, per session</span></div>
        <p class="footnote">The passcode cannot be recovered. If it is lost, remove payroll from the device and import the file again.</p>
      </div></div></div>
    </section>`;
  }
  if (status === 'locked') {
    const meta = payrollMeta();
    return `<section class="view" aria-labelledby="h-pay">
      ${header('Restricted · HR only', 'Payroll', 'h-pay')}
      <div class="cols"><div class="col"><div class="card">
        <h3>${ICONS.lock.replace('<svg', '<svg width="15" height="15" style="vertical-align:-2px;margin-right:4px"')}Locked</h3>
        <p class="psub" style="margin-bottom:12px">${esc(monthLabel(meta.month))} wages register · ${meta.rows} rows</p>
        <form data-form="payroll-unlock" novalidate>
          <div class="field"><label for="pr-unlock">Passcode</label><input id="pr-unlock" name="pass" type="password" autocomplete="current-password"></div>
          <div class="error-text" data-error hidden role="alert"></div>
          <button class="btn-primary" type="submit">Unlock</button>
        </form>
        <div style="height:12px"></div>
        <button class="btn-ghost no" data-action="payroll-remove">Remove payroll from this device</button>
      </div></div></div>
    </section>`;
  }

  const d = payrollData();
  const rows = d.rows;
  const map = d.map || {};
  const linked = rows.filter((r) => map[r.slNo]).length;
  const mine = rowFor(ME_ID);
  if (ui.paySl === null || !rows.some((r) => r.slNo === ui.paySl)) ui.paySl = (mine || rows[0]).slNo;
  const sel = rows.find((r) => r.slNo === ui.paySl);
  const selEmp = map[sel.slNo] ? byId(map[sel.slNo]) : null;
  const tot = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const list = rows.filter((r) => ui.payFilter === 'all' || (ui.payFilter === 'unlinked' ? !map[r.slNo] : !!map[r.slNo]));
  const usedCodes = new Set(Object.values(map));
  const opts = (r) => `<option value="">— Not linked —</option>${EMPLOYEES.map((e) => `<option value="${e.id}"${map[r.slNo] === e.id ? ' selected' : ''}${usedCodes.has(e.id) && map[r.slNo] !== e.id ? ' disabled' : ''}>${esc(e.id)} · ${esc(e.name)}</option>`).join('')}`;

  return `<section class="view" aria-labelledby="h-pay">
    ${header(`Restricted · ${monthLabel(d.month)}`, 'Payroll', 'h-pay', `<button class="btn-ghost" data-action="payroll-lock">${ICONS.lock.replace('<svg', '<svg width="13" height="13" style="vertical-align:-2px"')} Lock</button>`)}
    <div class="stat-strip">
      <div class="stat"><div class="num">${rows.length}</div><div class="lbl">Register rows</div></div>
      <div class="stat"><div class="num">${linked}</div><div class="lbl">Linked to code</div></div>
      <div class="stat"><div class="num" style="font-size:16px">${money(tot('gross'))}</div><div class="lbl">Total gross</div></div>
      <div class="stat"><div class="num" style="font-size:16px">${money(tot('net'))}</div><div class="lbl">Total net</div></div>
    </div>
    ${linked < rows.length ? `<div class="notice">The register has no employee names, so salary rows can’t be matched to codes automatically. Link each Sl No to the right employee below — ${rows.length - linked} still unlinked. ${d.employeesInMaster} employees are in the master vs ${rows.length} register rows.</div>` : ''}
    <div class="cols cols-wide">
      <div class="col">
        <div class="card">
          <h3>Sl No ${sel.slNo} — ${selEmp ? esc(selEmp.name) : 'not linked'}
            ${selEmp ? `<button class="btn-ghost" data-action="print-payslip" data-sl="${sel.slNo}" aria-label="Save payslip as PDF">PDF</button>` : ''}</h3>
          ${slipBreakdown(sel)}
          <p class="footnote">Figures exactly as in the ${esc(monthLabel(d.month))} wages register (${esc(d.source)}). Nothing is recalculated.</p>
        </div>
        <div class="card">
          <h3>My salary <span class="psub" style="margin:0">${esc(ME_ID)}</span></h3>
          ${mine ? `<div class="mini-row"><span>Register row</span><span>Sl No ${mine.slNo}</span></div><div class="mini-row"><span>Net salary</span><span class="amt">${money(mine.net)}</span></div>` : '<div class="empty">Your code isn’t linked to a register row yet.</div>'}
        </div>
      </div>
      <div class="col">
        <div class="card">
          <h3>Wages register</h3>
          <div class="chips" role="group" aria-label="Filter rows">${[['all', 'All'], ['unlinked', 'Unlinked'], ['linked', 'Linked']].map(([k, l]) => `<button class="chip${ui.payFilter === k ? ' active' : ''}" data-action="pay-filter" data-f="${k}" aria-pressed="${ui.payFilter === k}">${l}</button>`).join('')}</div>
          ${list.map((r) => `<div class="reg-row${r.slNo === sel.slNo ? ' sel' : ''}">
            <button class="reg-main" data-action="pay-row" data-sl="${r.slNo}">
              <span class="pname">Sl ${r.slNo}</span>
              <span class="psub">${r.doj ? 'DOJ ' + esc(fmtLong(r.doj)) : 'DOJ blank'} · ${r.payDays ?? '—'}/${r.wageDays ?? '—'} days</span>
              <span class="amt">${money(r.net)}</span>
            </button>
            <label class="sr-only" for="map-${r.slNo}">Employee for Sl No ${r.slNo}</label>
            <select id="map-${r.slNo}" class="map-select" data-action="pay-map" data-sl="${r.slNo}">${opts(r)}</select>
          </div>`).join('') || '<div class="empty">No rows in this filter.</div>'}
          <p class="footnote">Each employee code can be linked to one row. Links are saved inside the encrypted payroll on this device.</p>
        </div>
        <div class="card">
          <h3>Manage</h3>
          <form data-form="payroll-import" novalidate>
            <div class="field"><label for="pr-file2">Re-import corrected register (.json)</label><input id="pr-file2" name="file" type="file" accept=".json,application/json"></div>
            <div class="field-row">
              <div class="field"><label for="pr-p1">New passcode</label><input id="pr-p1" name="pass" type="password" autocomplete="new-password"></div>
              <div class="field"><label for="pr-p2">Confirm</label><input id="pr-p2" name="pass2" type="password" autocomplete="new-password"></div>
            </div>
            <div class="error-text" data-error hidden role="alert"></div>
            <button class="btn-outline" type="submit">Re-import</button>
          </form>
          <div style="height:10px"></div>
          <div class="right-cluster" style="flex-wrap:wrap">
            <button class="btn-ghost" data-action="payroll-export-links">Download links (CSV)</button>
            <button class="btn-ghost no" data-action="payroll-remove">Remove from device</button>
          </div>
          <p class="footnote">The links file holds Sl No, employee code and name only — no salary figures. Use it to fill the Employee's Name column in the register so future imports link automatically.</p>
        </div>
      </div>
    </div>
  </section>`;
}

/* =========================================================== MORE */
export function moreView(state, { canInstall, isIOS, installed }) {
  const items = [
    ['people', 'People', 'Employee directory', 'people'],
    ['requests', 'Requests', 'Advances, permissions & expenses', 'requests'],
    ['performance', 'Performance', 'KPI reviews', 'perf'],
    ['skills', 'Skills', 'Department skill matrices', 'skills'],
    ['documents', 'Documents', 'Letters & certificates', 'docs'],
  ];
  const install = installed ? '' : canInstall
    ? `<div class="card install-card"><h3>Install Quickair HR</h3><p>Add the app to your home screen for one-tap access and offline use.</p><button class="btn-primary" data-action="install">Install app</button></div>`
    : isIOS
      ? `<div class="card install-card"><h3>Install on iPhone / iPad</h3><p>In Safari tap the Share button, then <strong>Add to Home Screen</strong>.</p></div>`
      : '';
  return `<section class="view" aria-labelledby="h-more">
    ${header('Everything else', 'More', 'h-more')}
    <div class="menu-list">
      ${items.map(([r, t, s, ic]) => `<a class="menu-item" href="#/${r}"><span class="ico">${ICONS[ic]}</span><span><b>${t}</b><small>${s}</small></span><span class="chev">${ICONS.chevron.replace('<svg', '<svg width="16" height="16"')}</span></a>`).join('')}
    </div>
    <div style="height:14px"></div>
    ${install}
    ${dataStatusCard()}
    <div class="card">
      <h3>This device</h3>
      <p class="footnote" style="padding:0">Check-ins and requests you make are saved on this device. Clearing them does not touch the employee master, skill matrices or the encrypted payroll.</p>
      <div style="height:10px"></div>
      <button class="btn-ghost" data-action="reset-local">Clear my local records</button>
    </div>
  </section>`;
}

/* =========================================================== PEOPLE */
export function peopleListHtml() {
  const q = ui.peopleQ.trim().toLowerCase();
  const rows = EMPLOYEES.filter((e) =>
    (ui.peopleDept === 'All' || (e.dept || UNASSIGNED) === ui.peopleDept) &&
    (!q || `${e.name} ${e.role || ''} ${e.id} ${e.dept || ''}`.toLowerCase().includes(q)));
  if (!rows.length) return '<div class="empty">No employees match your search.</div>';
  return rows.map((e) => `<a class="row-item row-link" href="#/people/${e.id}">
    <div class="row-main"><span class="avatar sm sage">${esc(initials(e.name))}</span><div><div class="pname">${esc(e.name)}</div><div class="psub">${e.dept || e.role ? esc([e.role, e.dept].filter(Boolean).join(' · ')) : 'Department not on file'}</div></div></div>
    <span class="psub" style="margin:0">${esc(e.id)}</span></a>`).join('');
}

export function peopleView() {
  return `<section class="view" aria-labelledby="h-people">
    ${header(`${EMPLOYEES.length} employees`, 'People', 'h-people')}
    <div class="field"><label class="sr-only" for="people-q">Search people</label>
      <input class="search" id="people-q" type="search" placeholder="Search name or code" value="${esc(ui.peopleQ)}" autocomplete="off"></div>
    <div class="chips" role="group" aria-label="Filter by department">
      ${['All', ...DEPARTMENTS].map((d) => `<button class="chip${ui.peopleDept === d ? ' active' : ''}" data-action="dept" data-dept="${esc(d)}" aria-pressed="${ui.peopleDept === d}">${esc(d)}</button>`).join('')}
    </div>
    <div class="card" id="people-list">${peopleListHtml()}</div>
    <p class="footnote">The employee master holds name and code only. Department is shown where the employee is linked to a skill matrix.</p>
  </section>`;
}

export function personView(state, id) {
  const e = byId(id);
  if (!e) return `<section class="view"><a class="back-link" href="#/people">← People</a><div class="card"><div class="empty">No employee with code ${esc(id)}.</div></div></section>`;
  const sk = skillsFor(e.id);
  return `<section class="view" aria-labelledby="h-person">
    <a class="back-link" href="#/people">← People</a>
    <div class="app-header"><div class="row-main"><span class="avatar lg">${esc(initials(e.name))}</span>
      <div class="greet"><p>${esc(e.id)}${e.id === ME_ID ? ' · You' : ''}</p><h1 id="h-person">${esc(e.name)}</h1></div></div></div>
    <div class="cols">
      <div class="col"><div class="card">
        <h3>Employment</h3>
        <div class="mini-row"><span>Employee code</span><span>${esc(e.id)}</span></div>
        <div class="mini-row"><span>Role</span><span>${val(e.role)}</span></div>
        <div class="mini-row"><span>Department</span><span>${val(e.dept)}</span></div>
        <div class="mini-row"><span>Location</span><span>${val(e.location)}</span></div>
        <div class="mini-row"><span>Date of joining</span><span>${val(e.joined, fmtLong)}</span></div>
        <div class="mini-row"><span>Status</span><span>${val(e.status)}</span></div>
        <div class="mini-row"><span>Reporting manager</span><span>${val(e.manager)}</span></div>
        <div class="mini-row"><span>Email</span><span>${val(e.email, (x) => `<a href="mailto:${esc(x)}">${esc(x)}</a>`)}</span></div>
        <div class="mini-row"><span>Phone</span><span>${val(e.phone, (x) => `<a href="tel:${esc(x.replace(/\s/g, ''))}">${esc(x)}</a>`)}</span></div>
      </div></div>
      <div class="col"><div class="card">
        <h3>Skills</h3>
        ${sk.length ? sk.map(({ matrix, person, score }) => `<a class="row-item row-link" href="#/skills" data-action="skill-open" data-m="${SKILL_MATRICES.indexOf(matrix)}" data-p="${esc(person.name)}">
          <div><div class="pname">${esc(matrix.dept)}</div><div class="psub">${score.assessed} skills assessed · ${score.gaps} below expected${score.notAssessed ? ` · ${score.notAssessed} not assessed` : ''}${person.match === 'name' ? ` · linked by name (“${esc(person.name)}”) — verify` : ''}</div></div>
          <span class="amt">${score.competency === null ? '—' : score.competency + '%'}</span></a>`).join('') : '<div class="empty">Not in any skill matrix.</div>'}
        <div class="mini-row" style="margin-top:6px"><span>KPI reviews</span><span>${kpiFor(e.id).length || 'None supplied'}</span></div>
      </div></div>
    </div>
  </section>`;
}

/* =========================================================== REQUESTS */
export function requestsView(state) {
  const tabs = [['advance', 'Salary advance'], ['permission', 'Permission'], ['expenses', 'Expenses']];
  const nextMonth = addMonths(monthKey(new Date()), 1);
  let body = '';

  if (ui.reqTab === 'advance') {
    body = `<div class="cols"><div class="col"><div class="card"><h3>Request a salary advance</h3>
      <form data-form="advance" novalidate>
        <div class="field"><label for="adv-amt">Amount (₹)</label><input id="adv-amt" name="amount" type="number" min="500" step="500" inputmode="numeric" placeholder="Amount in ₹"></div>
        <div class="field"><label for="adv-month">Recover from payroll of</label><input id="adv-month" name="month" type="month" value="${nextMonth}"></div>
        <div class="field"><label for="adv-reason">Reason</label><textarea id="adv-reason" name="reason" maxlength="200"></textarea></div>
        <div class="error-text" data-error hidden role="alert"></div>
        <button class="btn-primary" type="submit">Submit request</button>
      </form></div></div>
      <div class="col"><div class="card"><h3>History</h3>${state.advances.length ? [...state.advances].reverse().map((a) => `<div class="row-item"><div><div class="pname">${money(a.amount)}</div><div class="psub">Recover ${esc(monthLabel(a.month))} · ${esc(a.reason || '—')}</div></div>${badge(a.status)}</div>`).join('') : '<div class="empty">No advance requests yet.</div>'}</div></div></div>`;
  } else if (ui.reqTab === 'permission') {
    body = `<div class="cols"><div class="col"><div class="card"><h3>Late / early permission</h3>
      <form data-form="permission" novalidate>
        <div class="field"><label for="perm-kind">Type</label><select id="perm-kind" name="kind">${PERMISSION_KINDS.map((k) => `<option>${k}</option>`).join('')}</select></div>
        <div class="field-row">
          <div class="field"><label for="perm-date">Date</label><input id="perm-date" name="date" type="date" value="${todayISO()}"></div>
          <div class="field"><label for="perm-hours">Hours</label><input id="perm-hours" name="hours" type="number" min="0.5" max="4" step="0.5" value="1"></div>
        </div>
        <div class="field"><label for="perm-reason">Reason</label><textarea id="perm-reason" name="reason" maxlength="200"></textarea></div>
        <div class="error-text" data-error hidden role="alert"></div>
        <button class="btn-primary" type="submit">Submit request</button>
      </form></div></div>
      <div class="col"><div class="card"><h3>History</h3>${[...state.permissions].reverse().map((p) => `<div class="row-item"><div><div class="pname">${esc(p.kind)} · ${p.hours}h</div><div class="psub">${esc(fmtShort(p.date))} · ${esc(p.reason || '—')}</div></div>${badge(p.status)}</div>`).join('') || '<div class="empty">No permission requests yet.</div>'}</div></div></div>`;
  } else {
    body = `<div class="card"><h3>Add an expense</h3>
      <form data-form="expense" novalidate>
        <div class="exp-add">
          <select name="cat" aria-label="Expense category">${EXPENSE_CATS.map((c) => `<option>${c}</option>`).join('')}</select>
          <input type="number" name="amount" min="1" step="1" inputmode="numeric" placeholder="₹ Amount" aria-label="Expense amount in rupees">
          <button type="submit">Add</button>
        </div>
        <div class="error-text" data-error hidden role="alert"></div>
      </form>
      ${state.expenses.length ? [...state.expenses].reverse().map((x) => `<div class="row-item"><div><div class="pname">${esc(x.cat)}</div><div class="psub">${esc(fmtShort(x.date))}</div></div><div class="right-cluster"><span class="amt">${money(x.amount)}</span>${badge(x.status)}</div></div>`).join('') : '<div class="empty">No expenses yet.</div>'}
    </div>`;
  }

  const approvals = state.approvals.filter((a) => a.status === 'pending');
  return `<section class="view" aria-labelledby="h-req">
    ${header('Reimbursements & requests', 'Requests', 'h-req')}
    <div class="chips" role="tablist" aria-label="Request type">${tabs.map(([k, l]) => `<button class="chip${ui.reqTab === k ? ' active' : ''}" role="tab" aria-selected="${ui.reqTab === k}" data-action="req-tab" data-tab="${k}">${l}</button>`).join('')}</div>
    ${body}
    <div class="card"><h3>Awaiting your approval</h3>${approvals.length ? approvals.map(approvalRow).join('') : '<div class="empty">No requests awaiting approval.</div>'}</div>
  </section>`;
}

/* =========================================================== PERFORMANCE */
export function performanceView() {
  const withReviews = Object.keys(KPI_REVIEWS).filter((id) => KPI_REVIEWS[id].length);
  if (!withReviews.length) {
    return `<section class="view" aria-labelledby="h-perf">
      ${header('KPI reviews', 'Performance', 'h-perf')}
      <div class="cols"><div class="col"><div class="card">
        <h3>No KPI data supplied</h3>
        <div class="empty">No KPI reviews have been provided for any employee, so nothing is scored here.</div>
        <p class="footnote">Sample KPI reviews were removed. To populate this screen, supply per employee code and review period: KPI name, weightage, target, actual, score and rating. They load into <code>KPI_REVIEWS</code> in js/data.js and the weighted overall is calculated from them.</p>
      </div></div>
      <div class="col"><div class="card">
        <h3>Related real data</h3>
        <div class="row-item"><div><div class="pname">Skill matrices</div><div class="psub">${SKILL_MATRICES.length} department sheets · Expected vs Current</div></div><a class="btn-ghost" href="#/skills">Open</a></div>
      </div></div></div>
    </section>`;
  }
  if (!withReviews.includes(ui.perfEmp)) ui.perfEmp = withReviews[0];
  const reviews = kpiFor(ui.perfEmp);
  const r = reviews[ui.perfIdx] || reviews[0];
  const overall = r.overall ?? (r.items.reduce((s, i) => s + i.score * i.weight, 0) / r.items.reduce((s, i) => s + i.weight, 0));
  return `<section class="view" aria-labelledby="h-perf">
    ${header(byId(ui.perfEmp)?.name || ui.perfEmp, 'Performance', 'h-perf')}
    <div class="field"><label for="perf-emp">Employee</label><select id="perf-emp" data-action="perf-emp">${withReviews.map((id) => `<option value="${id}"${id === ui.perfEmp ? ' selected' : ''}>${esc(id)} · ${esc(byId(id)?.name || '')}</option>`).join('')}</select></div>
    <div class="chips" role="group" aria-label="Review period">${reviews.map((k, i) => `<button class="chip${i === ui.perfIdx ? ' active' : ''}" data-action="perf-select" data-idx="${i}" aria-pressed="${i === ui.perfIdx}">${esc(k.period)}</button>`).join('')}</div>
    <div class="cols cols-wide">
      <div class="col"><div class="card"><h3>KPI breakdown</h3>
        ${r.items.map((i) => `<div class="kpi-item"><div class="top"><span class="pname">${esc(i.name)}</span><span class="amt">${i.score.toFixed(1)} / 5</span></div>
          <div class="meter" role="img" aria-label="${i.score} out of 5"><i style="width:${(i.score / 5) * 100}%"></i></div>
          <div class="psub">Weight ${i.weight}%${i.target != null ? ` · Target ${esc(i.target)}` : ''}${i.actual != null ? ` · Actual ${esc(i.actual)}` : ''}${i.note ? ' · ' + esc(i.note) : ''}</div></div>`).join('')}
      </div></div>
      <div class="col"><div class="card"><h3>Overall</h3>
        <div class="score">${overall.toFixed(1)}<span class="psub" style="font-size:13px"> / 5</span></div>
        <div class="meter amber"><i style="width:${(overall / 5) * 100}%"></i></div>
        <div style="height:12px"></div>
        ${r.label ? `<span class="status-chip">${esc(r.label)}</span>` : ''}
        <div class="mini-row" style="margin-top:10px"><span>Reviewer</span><span>${val(r.reviewer)}</span></div>
        <div class="mini-row"><span>Period</span><span>${esc(r.period)}</span></div>
      </div></div>
    </div>
  </section>`;
}

/* =========================================================== SKILLS */
const matchBadge = (p) => {
  if (p.match === 'exact') return `<span class="badge ok">${esc(p.code)}</span>`;
  if (p.match === 'name') return `<span class="badge pending" title="Linked by unique name match — please confirm">${esc(p.code)} · verify</span>`;
  if (p.match === 'ambiguous') return `<span class="badge no" title="Matches ${esc(p.candidates.join(', '))}">Ambiguous</span>`;
  return '<span class="badge no">No code</span>';
};

const dots = (cur, exp) => `<div class="dots" role="img" aria-label="Current ${cur ?? 'not assessed'}, expected ${exp} of ${SKILL_MAX}">${Array.from({ length: SKILL_MAX }, (_, i) => i + 1).map((n) => `<i class="${typeof cur === 'number' && n <= cur ? 'on' : typeof exp === 'number' && n <= exp ? 'target' : ''}"></i>`).join('')}</div>`;

export function skillsView() {
  const all = skillPeople();
  const scored = all.map((p) => scoreSkills(p.ratings)).filter((s) => s.competency !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, x) => s + x.competency, 0) / scored.length) : null;
  const gaps = scored.reduce((s, x) => s + x.gaps, 0);
  if (ui.skillIdx === null) ui.skillIdx = Math.max(0, SKILL_MATRICES.findIndex((m) => m.employees.length));
  const m = SKILL_MATRICES[ui.skillIdx];

  let body;
  if (!m.employees.length) {
    body = `<div class="card"><h3>${esc(m.dept)} <span class="psub" style="margin:0">${m.skills.length} skills</span></h3>
      <div class="empty">Template only — no employees have been rated in this sheet yet.</div>
      ${m.skills.map((s) => `<div class="row-item"><div class="pname">${esc(s.name)}</div><span class="psub" style="margin:0">${esc(s.group || '')}</span></div>`).join('')}
      <p class="footnote">Source: ${esc(m.source)}</p></div>`;
  } else {
    body = `<div class="card"><h3>${esc(m.dept)} <span class="psub" style="margin:0">${m.employees.length} people · ${m.skills.length} skills</span></h3>
      ${m.employees.map((p) => {
        const s = scoreSkills(p.ratings);
        const open = ui.skillPerson === p.name;
        const groups = [...new Set(m.skills.map((k) => k.group || 'Skills'))];
        return `<div class="skill-person${open ? ' open' : ''}">
          <button class="row-item skill-head" data-action="skill-person" data-p="${esc(p.name)}" aria-expanded="${open}">
            <div style="text-align:left"><div class="pname">${esc(p.name)}${p.code && byId(p.code)?.name !== p.name ? ` <span class="psub" style="display:inline">· ${esc(byId(p.code)?.name || '')}</span>` : ''}</div>
              <div class="psub">${s.assessed ? `${s.assessed} assessed · ${s.gaps} below expected` : 'No ratings entered'}${s.notAssessed ? ` · ${s.notAssessed} not assessed` : ''}${p.title && p.title.toUpperCase() !== m.dept.toUpperCase() ? ' · ' + esc(p.title) : ''}</div>
              ${s.competency !== null ? `<div class="meter" style="max-width:220px"><i style="width:${s.competency}%"></i></div>` : ''}</div>
            <div class="right-cluster">${matchBadge(p)}<span class="amt">${s.competency === null ? '—' : s.competency + '%'}</span></div>
          </button>
          ${open ? `<div class="skill-detail">
            ${p.match === 'ambiguous' ? `<p class="notice">Name “${esc(p.name)}” matches ${p.candidates.map((c) => `${esc(c)} ${esc(byId(c)?.name || '')}`).join(' and ')} — not linked until confirmed.</p>` : ''}
            ${p.match === 'none' ? `<p class="notice">Not in the employee master${p.sheetId ? ` (sheet ID ${esc(p.sheetId)})` : ''} — no employee code assigned.</p>` : ''}
            ${groups.map((g) => `<div class="skill-group">${esc(g)}</div>${m.skills.map((k, i) => ({ k, r: p.ratings[i] })).filter(({ k }) => (k.group || 'Skills') === g).map(({ k, r }) => {
              const [e, c] = r;
              const na = e === 'NA' || c === 'NA';
              const right = na ? 'NA' : e == null && c == null ? '—' : `${c ?? '·'} / ${e ?? '·'}`;
              return `<div class="row-item" style="align-items:flex-start"><div><div class="pname" style="font-weight:400">${esc(k.name)}</div>${na || (e == null && c == null) ? '' : dots(c, e)}${!na && typeof e === 'number' && c == null ? '<div class="psub">Not assessed</div>' : ''}${typeof c === 'number' && typeof e === 'number' && c > e ? '<div class="psub">Current above expected — check sheet</div>' : ''}</div><span class="amt">${right}</span></div>`;
            }).join('')}`).join('')}
          </div>` : ''}
        </div>`;
      }).join('')}
      <p class="footnote">Source: ${esc(m.source)}. Score = current ÷ expected across assessed skills (each skill capped at expected). NA and blank ratings are excluded.</p>
    </div>`;
  }

  return `<section class="view" aria-labelledby="h-skills">
    ${header('Skill matrix', 'Skills', 'h-skills')}
    <div class="stat-strip">
      <div class="stat"><div class="num">${all.length}</div><div class="lbl">People rated</div></div>
      <div class="stat"><div class="num">${all.filter((p) => p.code).length}</div><div class="lbl">Linked to code</div></div>
      <div class="stat"><div class="num">${avg === null ? '—' : avg + '%'}</div><div class="lbl">Avg. competency</div></div>
      <div class="stat"><div class="num">${gaps}</div><div class="lbl">Skills below expected</div></div>
    </div>
    <div class="chips" role="group" aria-label="Department">${SKILL_MATRICES.map((x, i) => `<button class="chip${i === ui.skillIdx ? ' active' : ''}" data-action="skill-dept" data-idx="${i}" aria-pressed="${i === ui.skillIdx}">${esc(x.dept)}${x.employees.length ? '' : ' ·  empty'}</button>`).join('')}</div>
    <div class="cols cols-wide">
      <div class="col">${body}</div>
      <div class="col"><div class="card"><h3>Rating scale</h3>
        ${Object.entries(SKILL_SCALE).map(([k, v]) => `<div class="mini-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}
        <div class="legend"><span><i style="background:var(--deep)"></i>Current</span><span><i style="background:var(--amber)"></i>Gap to expected</span></div>
      </div></div>
    </div>
  </section>`;
}

/* =========================================================== DOCUMENTS */
export function docAvailability(key) {
  const e = me();
  const t = DOC_TYPES.find((d) => d.key === key);
  const missing = t.needs.filter((n) => (n === 'payroll' ? !rowFor(e.id) : !e[n]));
  return { ok: !missing.length, missing };
}

export function documentsView(state) {
  const label = { role: 'role', dept: 'department', joined: 'date of joining', payroll: 'linked & unlocked payroll row' };
  return `<section class="view" aria-labelledby="h-docs">
    ${header('Letters & certificates', 'Documents', 'h-docs')}
    <div class="cols">
      <div class="col"><div class="card"><h3>Generate</h3>
        ${DOC_TYPES.map((d) => {
          const a = docAvailability(d.key);
          return `<div class="row-item"><div><div class="pname">${esc(d.title)}</div><div class="psub">${a.ok ? esc(d.sub) : 'Missing: ' + esc(a.missing.map((x) => label[x]).join(', '))}</div></div><button class="btn-ghost" data-action="doc" data-key="${d.key}" ${a.ok ? '' : 'disabled'} aria-label="Generate ${esc(d.title)} as PDF">PDF</button></div>`;
        }).join('')}
        <p class="footnote">Letters are generated only from data on file — a document stays disabled until every field it states is available. Opens your device's print dialog — choose “Save as PDF”.</p>
      </div></div>
      <div class="col"><div class="card"><h3>Recently generated</h3>
        ${state.docsRequested.length ? [...state.docsRequested].reverse().slice(0, 8).map((d) => `<div class="row-item"><div><div class="pname">${esc(d.title)}</div><div class="psub">${esc(fmtLong(d.date))}</div></div><span class="badge ok">Generated</span></div>`).join('') : '<div class="empty">Nothing generated yet.</div>'}
      </div></div>
    </div>
  </section>`;
}

