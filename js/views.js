// View templates. Each view is a pure function: (state) => HTML string.
// All dynamic text is escaped with esc().

import {
  esc, money, pad, iso, todayISO, monthKey, monthLabel, addMonths, fmtDay, fmtShort, fmtLong,
  initials, daysInMonth,
} from './utils.js';
import {
  EMPLOYEES, ME_ID, DEPARTMENTS, LEAVE_POLICY, LEAVE_LABEL, ATT_CODES, HOLIDAYS, EVENTS, SALARY,
  KPI_REVIEWS, SKILLS, DOC_TYPES, PERMISSION_KINDS, EXPENSE_CATS, buildPayslips, holidayMap, teamStatusToday,
} from './data.js';
import { dayInfo, leaveBalances, monthSummary } from './attendance.js';

/** UI-only state (not persisted): selected month, tab, filters. */
export const ui = {
  timeMonth: monthKey(new Date()),
  payKey: null,
  perfIdx: 0,
  reqTab: 'advance',
  peopleQ: '',
  peopleDept: 'All',
};

const me = () => EMPLOYEES.find((e) => e.id === ME_ID);
const byId = (id) => EMPLOYEES.find((e) => e.id === id);
const hMap = holidayMap();

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

const header = (kicker, title, extra = '') =>
  `<div class="app-header"><div class="greet"><p>${esc(kicker)}</p><h1>${esc(title)}</h1></div>${extra}</div>`;

/* =========================================================== HOME */
export function homeView(state) {
  const today = todayISO();
  const user = me();
  const first = user.name.split(' ')[0];
  const info = dayInfo(state, today);
  const my = info.code === 'CL' || info.code === 'SL' || info.code === 'EL' ? 'leave' : 'present';
  const team = teamStatusToday(today, hMap, my);
  const bal = leaveBalances(state);
  const leftTotal = Object.values(bal).reduce((s, b) => s + b.left, 0);
  const c = state.checkin;
  const checkedIn = c.date === today && c.in && !c.out;
  const done = c.date === today && c.in && c.out;
  const sub = done ? `Checked out at ${c.out} · have a good evening`
    : checkedIn ? `Checked in at ${c.in}` : 'Not checked in yet';
  const btnLabel = checkedIn ? 'Check out' : done ? 'Day complete' : 'Check in';

  // Team attendance % for Mon–Fri of the current week
  const now = new Date();
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const bars = [...Array(5)].map((_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const key = iso(d);
    const future = key > today;
    const t = teamStatusToday(key, hMap, 'present');
    const pct = future || t.off ? 8 : Math.round((t.present / t.total) * 100);
    return { label: d.toLocaleDateString('en-IN', { weekday: 'short' }), pct, today: key === today, future };
  });

  const approvals = state.approvals.filter((a) => a.status === 'pending');
  const upcoming = [
    ...HOLIDAYS.filter((h) => h.date >= today).slice(0, 2).map((h) => ({ date: h.date, name: h.name, tag: 'Holiday' })),
    ...EVENTS.filter((e) => e.date >= today).map((e) => ({ date: e.date, name: e.name, tag: 'Event' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

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
          <div class="stat" role="listitem"><div class="num">${team.present}</div><div class="lbl">Present today</div></div>
          <div class="stat" role="listitem"><div class="num">${team.leave}</div><div class="lbl">On leave</div></div>
          <div class="stat" role="listitem"><div class="num">${pendingApprovals(state)}</div><div class="lbl">Approvals</div></div>
          <div class="stat" role="listitem"><div class="num">${leftTotal}</div><div class="lbl">Leave days left</div></div>
        </div>
        <div class="card">
          <h3>This week <span class="psub" style="margin:0">Team attendance</span></h3>
          <div class="bars" role="img" aria-label="Team attendance this week: ${bars.map((b) => `${b.label} ${b.future ? 'upcoming' : b.pct + '%'}`).join(', ')}">
            ${bars.map((b) => `<div class="bar${b.today ? ' today' : ''}" style="height:${b.pct}%"></div>`).join('')}
          </div>
          <div class="bar-lbls">${bars.map((b) => `<div class="bar-lbl">${b.label}</div>`).join('')}</div>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <h3>Pending approvals <a href="#/requests">See all</a></h3>
          ${approvals.length ? approvals.map((a) => approvalRow(a)).join('') : '<div class="empty">You\'re all caught up.</div>'}
        </div>
        <div class="card">
          <h3>Upcoming</h3>
          ${upcoming.map((u) => `<div class="row-item"><div><div class="pname">${esc(u.name)}</div><div class="psub">${u.tag} · ${esc(fmtShort(u.date))}</div></div></div>`).join('')}
        </div>
      </div>
    </div>
  </section>`;
}

function approvalRow(a) {
  const e = byId(a.empId);
  return `<div class="row-item">
    <div><div class="pname">${esc(e ? e.name : 'Employee')}</div><div class="psub">${esc(a.detail)}</div></div>
    <div class="right-cluster">
      <button class="btn-ghost ok" data-action="approve" data-id="${esc(a.id)}" aria-label="Approve request from ${esc(e ? e.name : 'employee')}">Approve</button>
      <button class="btn-ghost no" data-action="reject" data-id="${esc(a.id)}" aria-label="Reject request from ${esc(e ? e.name : 'employee')}">Reject</button>
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
    cells.push(`<div class="cal-cell ${cls}${date === today ? ' today' : ''}" title="${esc(fmtDay(date))} — ${esc(ATT_CODES[info.code] || 'Upcoming')}">
      <span class="d">${d}</span><span class="c">${esc(info.code === '-' ? '' : info.code)}</span></div>`);
  }

  // Daily log: most recent days with a meaningful record
  const log = [];
  for (let d = days; d >= 1 && log.length < 7; d--) {
    const date = `${y}-${pad(m)}-${pad(d)}`;
    if (date > today) continue;
    const info = dayInfo(state, date);
    if (['OFF', '-'].includes(info.code)) continue;
    log.push({ date, info });
  }

  const team = teamStatusToday(today, hMap, 'present');
  const dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
            ${dow.map((d) => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('')}${cells.join('')}
          </div>
          <div class="legend">
            <span><i style="background:var(--sage-soft)"></i>P Present</span>
            <span><i style="background:var(--amber-soft)"></i>CL / SL / EL Leave</span>
            <span><i style="background:var(--cream);border:1px solid var(--line)"></i>H Holiday · OFF Weekly off</span>
            <span><i style="background:var(--red-soft)"></i>? Not marked</span>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <h3>Daily log</h3>
          ${log.length ? log.map(({ date, info }) => logRow(date, info)).join('') : '<div class="empty">No records for this month yet.</div>'}
        </div>
        <div class="card">
          <h3>Team snapshot</h3>
          <div class="row-item"><div class="pname">Present</div><span class="amt">${team.present} / ${team.total}</span></div>
          <div class="row-item"><div class="pname">On approved leave</div><span class="amt">${team.leave}</span></div>
          <div class="row-item"><div class="pname">Unmarked / absent</div><span class="amt">${team.absent}</span></div>
          <p class="footnote">Regularization requests route to your reporting manager and must be filed within 3 working days of the missed punch, per company attendance policy.</p>
        </div>
      </div>
    </div>
  </section>`;
}

function logRow(date, info) {
  const name = esc(fmtDay(date));
  if (info.code === 'P' || info.code === 'OD') {
    const sub = info.in ? `${esc(info.in)} → ${esc(info.out || '…')}${info.note && info.out ? ' · ' + esc(info.note) : ''}` : esc(info.note || 'Present');
    return `<div class="row-item"><div><div class="pname">${name}</div><div class="psub">${sub}</div></div><span class="badge ok">Present</span></div>`;
  }
  if (info.code === '?') {
    return `<div class="row-item"><div><div class="pname">${name}</div><div class="psub">No check-in recorded</div></div><button class="btn-ghost" data-action="regularize" data-date="${date}">Regularize</button></div>`;
  }
  if (info.code === 'Q') {
    return `<div class="row-item"><div><div class="pname">${name}</div><div class="psub">Regularization submitted to ${esc(me().manager)}</div></div><span class="badge pending">Pending</span></div>`;
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
    ${header('Time off', 'Leave').replace('<h1>', '<h1 id="h-leave">')}
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
          ${history.map((l) => `<div class="row-item"><div><div class="pname">${LEAVE_LABEL[l.type]} · ${esc(fmtShort(l.from))}${l.to !== l.from ? ' – ' + esc(fmtShort(l.to)) : ''}</div><div class="psub">${l.days} day${l.days > 1 ? 's' : ''} · ${esc(l.reason || '—')}</div></div>${badge(l.status)}</div>`).join('')}
        </div>
        <div class="card">
          <h3>Employment details</h3>
          <div class="mini-row"><span>Employee ID</span><span>${esc(user.id)}</span></div>
          <div class="mini-row"><span>Date of joining</span><span>${esc(fmtLong(user.joined))}</span></div>
          <div class="mini-row"><span>Status</span><span class="status-chip">${esc(user.status)}</span></div>
          <div class="mini-row"><span>Department</span><span>${esc(user.dept)}</span></div>
          <div class="mini-row"><span>Reporting manager</span><span>${esc(user.manager)}</span></div>
          <p class="footnote">Leave is counted per calendar year (${year}). Sundays and company holidays are not deducted. Leave beyond your balance is treated as loss of pay in salary.</p>
        </div>
      </div>
    </div>
  </section>`;
}

export function policyDialogBody() {
  return Object.keys(LEAVE_POLICY).map((k) => `<div class="mini-row"><span>${LEAVE_LABEL[k]} leave (${k})</span><span>${LEAVE_POLICY[k]} days / year</span></div>`).join('');
}

/* =========================================================== PAY */
export function payView(state) {
  const slips = buildPayslips();
  if (!ui.payKey || !slips.find((s) => s.key === ui.payKey)) ui.payKey = slips[0].key;
  const s = slips.find((x) => x.key === ui.payKey);
  const [y, m] = s.key.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long' });

  const lines = [
    ['Basic', SALARY.basic], ['HRA', SALARY.hra], ['Medical allowance', SALARY.medical],
    ['Conveyance', SALARY.conveyance], ['Special allowance', SALARY.special],
  ];

  return `<section class="view" aria-labelledby="h-pay">
    ${header(String(y), 'Payslips').replace('<h1>', '<h1 id="h-pay">')}
    <div class="cols cols-wide">
      <div class="col">
        <div class="card">
          <h3>${esc(monthName)} breakdown
            <select class="btn-ghost" data-action="pay-select" aria-label="Choose payslip month" style="padding:5px 8px">
              ${slips.map((x) => `<option value="${x.key}"${x.key === s.key ? ' selected' : ''}>${esc(monthLabel(x.key))}</option>`).join('')}
            </select>
          </h3>
          <div class="breakdown">
            ${lines.map(([n, v]) => `<div class="bd-row"><span>${n}</span><span>${money(v)}</span></div>`).join('')}
            <div class="bd-row sub"><span>Gross earnings</span><span>${money(s.gross)}</span></div>
            <div class="bd-row" style="margin-top:4px"><span>Employee PF (12% of Basic)</span><span>−${money(s.pf)}</span></div>
            <div class="bd-row"><span>Professional tax</span><span>−${money(SALARY.pt)}</span></div>
            <div class="bd-row"><span>TDS (as declared)</span><span>−${money(SALARY.tds)}</span></div>
            ${s.lopAmt ? `<div class="bd-row"><span>Loss of pay (${s.lop} day)</span><span>−${money(s.lopAmt)}</span></div>` : ''}
            ${s.advance ? `<div class="bd-row"><span>Salary advance recovery</span><span>−${money(s.advance)}</span></div>` : ''}
            <div class="bd-row bd-total"><span>Net pay</span><span>${money(s.net)}</span></div>
          </div>
          <p class="footnote">Paid for ${s.payDays} of ${s.days} days. Employer also contributes 12% of Basic (${money(s.pf)}) to PF — this doesn't reduce your take-home but is part of CTC. Tax figures are estimates; final TDS depends on the regime and declarations on file.</p>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <h3>History</h3>
          ${slips.map((x) => `<div class="payslip-row"><div><div class="pname">${esc(monthLabel(x.key))}</div><div class="psub">${x.payDays} of ${x.days} days paid</div></div>
            <div class="right-cluster"><span class="amt">${money(x.net)}</span>
            <button class="btn-ghost" data-action="print-payslip" data-key="${x.key}" aria-label="Save ${esc(monthLabel(x.key))} payslip as PDF">PDF</button></div></div>`).join('')}
        </div>
      </div>
    </div>
  </section>`;
}

/* =========================================================== MORE */
export function moreView(state, { canInstall, isIOS, installed }) {
  const items = [
    ['people', 'People', 'Directory of colleagues', 'people'],
    ['requests', 'Requests', 'Advances, permissions & expenses', 'requests'],
    ['performance', 'Performance', 'KPI reviews', 'perf'],
    ['skills', 'Skills', 'Skill matrix & development plan', 'skills'],
    ['documents', 'Documents', 'Letters & certificates', 'docs'],
  ];
  const install = installed ? '' : canInstall
    ? `<div class="card install-card"><h3>Install Quickair HR</h3><p>Add the app to your home screen for one-tap access and offline use.</p><button class="btn-primary" data-action="install">Install app</button></div>`
    : isIOS
      ? `<div class="card install-card"><h3>Install on iPhone / iPad</h3><p>In Safari tap the Share button, then <strong>Add to Home Screen</strong>.</p></div>`
      : '';
  return `<section class="view" aria-labelledby="h-more">
    ${header('Everything else', 'More').replace('<h1>', '<h1 id="h-more">')}
    <div class="menu-list">
      ${items.map(([r, t, s, ic]) => `<a class="menu-item" href="#/${r}"><span class="ico">${ICONS[ic]}</span><span><b>${t}</b><small>${s}</small></span><span class="chev">${ICONS.chevron.replace('<svg', '<svg width="16" height="16"')}</span></a>`).join('')}
    </div>
    <div style="height:14px"></div>
    ${install}
    <div class="card">
      <h3>About this demo</h3>
      <p class="footnote" style="padding:0">All employees, payslips and figures are fictional sample data stored only on this device. Changes you make (check-ins, requests) are saved locally.</p>
      <div style="height:10px"></div>
      <button class="btn-ghost" data-action="reset-demo">Reset demo data</button>
    </div>
  </section>`;
}

/* =========================================================== PEOPLE */
export function peopleListHtml() {
  const q = ui.peopleQ.trim().toLowerCase();
  const rows = EMPLOYEES.filter((e) =>
    (ui.peopleDept === 'All' || e.dept === ui.peopleDept) &&
    (!q || `${e.name} ${e.role} ${e.id} ${e.dept}`.toLowerCase().includes(q)));
  if (!rows.length) return '<div class="empty">No colleagues match your search.</div>';
  return rows.map((e) => `<a class="row-item row-link" href="#/people/${e.id}">
    <div class="row-main"><span class="avatar sm sage">${esc(initials(e.name))}</span><div><div class="pname">${esc(e.name)}</div><div class="psub">${esc(e.role)} · ${esc(e.dept)}</div></div></div>
    <span class="psub" style="margin:0">${esc(e.id)}</span></a>`).join('');
}

export function peopleView() {
  return `<section class="view" aria-labelledby="h-people">
    ${header(`${EMPLOYEES.length} colleagues`, 'People').replace('<h1>', '<h1 id="h-people">')}
    <div class="field"><label class="sr-only" for="people-q">Search people</label>
      <input class="search" id="people-q" type="search" placeholder="Search name, role or ID" value="${esc(ui.peopleQ)}" autocomplete="off"></div>
    <div class="chips" role="group" aria-label="Filter by department">
      ${['All', ...DEPARTMENTS].map((d) => `<button class="chip${ui.peopleDept === d ? ' active' : ''}" data-action="dept" data-dept="${esc(d)}" aria-pressed="${ui.peopleDept === d}">${esc(d)}</button>`).join('')}
    </div>
    <div class="card" id="people-list">${peopleListHtml()}</div>
  </section>`;
}

export function personView(state, id) {
  const e = byId(id);
  if (!e) return `<section class="view"><a class="back-link" href="#/people">← People</a><div class="card"><div class="empty">That person could not be found.</div></div></section>`;
  const mgr = EMPLOYEES.find((x) => x.name === e.manager);
  const reports = EMPLOYEES.filter((x) => x.manager === e.name);
  return `<section class="view" aria-labelledby="h-person">
    <a class="back-link" href="#/people">← People</a>
    <div class="app-header"><div class="row-main"><span class="avatar lg">${esc(initials(e.name))}</span>
      <div class="greet"><p>${esc(e.id)}${e.id === ME_ID ? ' · You' : ''}</p><h1 id="h-person">${esc(e.name)}</h1></div></div></div>
    <div class="cols">
      <div class="col"><div class="card">
        <h3>Employment</h3>
        <div class="mini-row"><span>Role</span><span>${esc(e.role)}</span></div>
        <div class="mini-row"><span>Department</span><span>${esc(e.dept)}</span></div>
        <div class="mini-row"><span>Location</span><span>${esc(e.location)}</span></div>
        <div class="mini-row"><span>Date of joining</span><span>${esc(fmtLong(e.joined))}</span></div>
        <div class="mini-row"><span>Status</span><span class="status-chip">${esc(e.status)}</span></div>
        <div class="mini-row"><span>Reporting manager</span><span>${mgr ? `<a href="#/people/${mgr.id}">${esc(mgr.name)}</a>` : '—'}</span></div>
      </div></div>
      <div class="col">
        <div class="card">
          <h3>Contact</h3>
          <div class="mini-row"><span>Email</span><span><a href="mailto:${esc(e.email)}">${esc(e.email)}</a></span></div>
          <div class="mini-row"><span>Phone</span><span><a href="tel:${esc(e.phone.replace(/\s/g, ''))}">${esc(e.phone)}</a></span></div>
        </div>
        ${reports.length ? `<div class="card"><h3>Direct reports</h3>${reports.map((r) => `<a class="row-item row-link" href="#/people/${r.id}"><div><div class="pname">${esc(r.name)}</div><div class="psub">${esc(r.role)}</div></div></a>`).join('')}</div>` : ''}
      </div>
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
        <div class="field"><label for="adv-amt">Amount (₹)</label><input id="adv-amt" name="amount" type="number" min="500" step="500" inputmode="numeric" placeholder="e.g. 10000"></div>
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
      ${[...state.expenses].reverse().map((x) => `<div class="row-item"><div><div class="pname">${esc(x.cat)}</div><div class="psub">${esc(fmtShort(x.date))}</div></div><div class="right-cluster"><span class="amt">${money(x.amount)}</span>${badge(x.status)}</div></div>`).join('')}
    </div>`;
  }

  const approvals = state.approvals.filter((a) => a.status === 'pending');
  return `<section class="view" aria-labelledby="h-req">
    ${header('Reimbursements & requests', 'Requests').replace('<h1>', '<h1 id="h-req">')}
    <div class="chips" role="tablist" aria-label="Request type">${tabs.map(([k, l]) => `<button class="chip${ui.reqTab === k ? ' active' : ''}" role="tab" aria-selected="${ui.reqTab === k}" data-action="req-tab" data-tab="${k}">${l}</button>`).join('')}</div>
    ${body}
    ${approvals.length ? `<div class="card"><h3>Awaiting your approval</h3>${approvals.map(approvalRow).join('')}</div>` : ''}
  </section>`;
}

/* =========================================================== PERFORMANCE */
export function performanceView() {
  const r = KPI_REVIEWS[ui.perfIdx] || KPI_REVIEWS[0];
  return `<section class="view" aria-labelledby="h-perf">
    ${header('Reviews', 'Performance').replace('<h1>', '<h1 id="h-perf">')}
    <div class="chips" role="group" aria-label="Review period">${KPI_REVIEWS.map((k, i) => `<button class="chip${i === ui.perfIdx ? ' active' : ''}" data-action="perf-select" data-idx="${i}" aria-pressed="${i === ui.perfIdx}">${esc(k.period)}</button>`).join('')}</div>
    <div class="cols cols-wide">
      <div class="col"><div class="card"><h3>KPI breakdown</h3>
        ${r.items.map((i) => `<div class="kpi-item"><div class="top"><span class="pname">${esc(i.name)}</span><span class="amt">${i.score.toFixed(1)} / 5</span></div>
          <div class="meter" role="img" aria-label="${i.score} out of 5"><i style="width:${(i.score / 5) * 100}%"></i></div>
          <div class="psub">Weight ${i.weight}% · ${esc(i.note)}</div></div>`).join('')}
      </div></div>
      <div class="col"><div class="card"><h3>Overall</h3>
        <div class="score">${r.overall.toFixed(1)}<span class="psub" style="font-size:13px"> / 5</span></div>
        <div class="meter amber"><i style="width:${(r.overall / 5) * 100}%"></i></div>
        <div style="height:12px"></div>
        <span class="status-chip">${esc(r.label)}</span>
        <div class="mini-row" style="margin-top:10px"><span>Reviewer</span><span>${esc(r.reviewer)}</span></div>
        <div class="mini-row"><span>Period</span><span>${esc(r.period)}</span></div>
      </div></div>
    </div>
  </section>`;
}

/* =========================================================== SKILLS */
export function skillsView() {
  const dots = (level, target) => `<div class="dots" role="img" aria-label="Level ${level} of 5, target ${target}">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= level ? 'on' : n <= target ? 'target' : ''}"></i>`).join('')}</div>`;
  const gaps = SKILLS.filter((s) => s.level < s.target).length;
  return `<section class="view" aria-labelledby="h-skills">
    ${header('Skill matrix', 'Skills').replace('<h1>', '<h1 id="h-skills">')}
    <div class="stat-strip">
      <div class="stat"><div class="num">${SKILLS.length}</div><div class="lbl">Skills tracked</div></div>
      <div class="stat"><div class="num">${gaps}</div><div class="lbl">To develop</div></div>
      <div class="stat"><div class="num">${(SKILLS.reduce((s, k) => s + k.level, 0) / SKILLS.length).toFixed(1)}</div><div class="lbl">Avg. level</div></div>
    </div>
    <div class="card"><h3>Matrix <span class="psub" style="margin:0">Amber = target gap</span></h3>
      ${SKILLS.map((s) => `<div class="row-item" style="align-items:flex-start"><div><div class="pname">${esc(s.name)}</div>${dots(s.level, s.target)}<div class="psub" style="margin-top:6px">${esc(s.plan)}</div></div><span class="amt">${s.level} → ${s.target}</span></div>`).join('')}
    </div>
  </section>`;
}

/* =========================================================== DOCUMENTS */
export function documentsView(state) {
  return `<section class="view" aria-labelledby="h-docs">
    ${header('Letters & certificates', 'Documents').replace('<h1>', '<h1 id="h-docs">')}
    <div class="cols">
      <div class="col"><div class="card"><h3>Generate</h3>
        ${DOC_TYPES.map((d) => `<div class="row-item"><div><div class="pname">${esc(d.title)}</div><div class="psub">${esc(d.sub)}</div></div><button class="btn-ghost" data-action="doc" data-key="${d.key}" aria-label="Generate ${esc(d.title)} as PDF">PDF</button></div>`).join('')}
        <p class="footnote">Opens your device's print dialog — choose “Save as PDF”.</p>
      </div></div>
      <div class="col"><div class="card"><h3>Recently generated</h3>
        ${state.docsRequested.length ? [...state.docsRequested].reverse().slice(0, 8).map((d) => `<div class="row-item"><div><div class="pname">${esc(d.title)}</div><div class="psub">${esc(fmtLong(d.date))}</div></div><span class="badge ok">Generated</span></div>`).join('') : '<div class="empty">Nothing generated yet.</div>'}
      </div></div>
    </div>
  </section>`;
}
