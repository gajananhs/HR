// Quickair HR — app entry: hash router, event delegation, form handling.
// Hash routing (#/home) keeps every URL valid on GitHub Pages project sites without server rewrites.

import { $, $$, esc, pad, todayISO, toast, addMonths, monthKey, initials } from './utils.js';
import { EMPLOYEES, ME_ID, LEAVE_LABEL, DOC_TYPES } from './data.js';
import { getState, update, subscribe, resetState, uid } from './store.js';
import { countWorkingDays, leaveBalances } from './attendance.js';
import { payslipHtml, letterHtml, printHtml } from './docs.js';
import {
  importPayroll, unlockPayroll, lockPayroll, removePayroll, mapRow, payrollData, rowFor, onPayrollChange,
} from './payroll.js';
import { initPWA, pwa } from './pwa.js';
import {
  ui, NAV, ICONS, pendingApprovals, homeView, timeView, leaveView, payView, moreView, peopleView,
  peopleListHtml, personView, requestsView, performanceView, skillsView, documentsView, policyDialogBody,
  docAvailability,
} from './views.js';

const viewEl = $('#view');
const screenEl = $('#screen');
let currentRoute = '';

/* ------------------------------------------------------------ navigation chrome */
function buildNav() {
  const user = EMPLOYEES.find((e) => e.id === ME_ID);
  $('#side-nav').innerHTML = NAV.map((n) => n.sep ? '<div class="sep" role="separator"></div>'
    : n.mobile && n.desktopHidden ? '' : `<a href="#/${n.route}" data-route="${n.route}" aria-label="${n.label}">${ICONS[n.icon]}<span class="t">${n.label}</span>${n.route === 'requests' ? '<span class="dot" data-approvals hidden></span>' : ''}</a>`).join('');
  $('#tabbar').innerHTML = NAV.filter((n) => n.mobile).map((n) => `<a class="tab" href="#/${n.route}" data-route="${n.route}" aria-label="${n.label}">${ICONS[n.icon]}<span>${n.label}</span>${n.route === 'home' ? '<span class="dot" data-approvals hidden></span>' : ''}</a>`).join('');
  $('#side-who').innerHTML = `<span class="avatar sm">${esc(initials(user.name))}</span><div>${esc(user.name)}<small>${esc(user.role || user.id)}</small></div>`;
}

function syncNav(route) {
  // Secondary routes highlight their parent tab on mobile.
  const mobileParent = ['home', 'time', 'leave', 'pay'].includes(route) ? route : 'more';
  $$('#side-nav a').forEach((a) => {
    const on = a.dataset.route === route;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $$('#tabbar a').forEach((a) => {
    const on = a.dataset.route === mobileParent;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const n = pendingApprovals(getState());
  $$('[data-approvals]').forEach((d) => { d.hidden = !n; d.textContent = n; });
}

/* ------------------------------------------------------------ routing */
const routes = {
  home: (s) => homeView(s),
  time: (s) => timeView(s),
  leave: (s) => leaveView(s),
  pay: () => payView(),
  more: (s) => moreView(s, { canInstall: pwa.canInstall, isIOS: pwa.isIOS, installed: pwa.installed }),
  people: (s, id) => (id ? personView(s, id) : peopleView(s)),
  requests: (s) => requestsView(s),
  performance: () => performanceView(),
  skills: () => skillsView(),
  documents: (s) => documentsView(s),
};

const titles = {
  home: 'Home', time: 'Attendance', leave: 'Leave', pay: 'Payroll', more: 'More', people: 'People',
  requests: 'Requests', performance: 'Performance', skills: 'Skills', documents: 'Documents',
};

function parseHash() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  const route = routes[parts[0]] ? parts[0] : 'home';
  return { route, id: parts[1] ? decodeURIComponent(parts[1]) : null };
}

function render({ resetScroll = false } = {}) {
  const { route, id } = parseHash();
  const changed = route + (id || '') !== currentRoute;
  const scrollTop = screenEl.scrollTop;
  viewEl.innerHTML = routes[route](getState(), id);
  document.title = `${titles[route]} · Quickair HR`;
  syncNav(route);
  tick();
  if (changed || resetScroll) {
    screenEl.scrollTop = 0;
    if (changed && currentRoute) screenEl.focus({ preventScroll: true });
  } else {
    screenEl.scrollTop = scrollTop;
  }
  currentRoute = route + (id || '');
}

window.addEventListener('hashchange', () => render());

/* ------------------------------------------------------------ clock */
function tick() {
  const now = new Date();
  const clock = $('#clock');
  if (clock) clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(tick, 1000);

/* ------------------------------------------------------------ helpers */
const hhmmNow = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const getEmp = (id) => EMPLOYEES.find((e) => e.id === id);

function showError(form, message) {
  const el = $('[data-error]', form);
  if (el) { el.textContent = message; el.hidden = !message; }
}

/* ------------------------------------------------------------ click actions */
const actions = {
  checkin() {
    const today = todayISO();
    update((s) => {
      const c = s.checkin;
      if (c.date !== today) s.checkin = { date: today, in: hhmmNow(), out: null };
      else if (c.in && !c.out) c.out = hhmmNow();
      s.punches[today] = { in: s.checkin.in, out: s.checkin.out };
    });
    const c = getState().checkin;
    toast(c.out ? `Checked out at ${c.out}` : `Checked in at ${c.in}`);
  },
  regularize(el) {
    const date = el.dataset.date;
    update((s) => { s.regularizations[date] = 'pending'; });
    const mgr = getEmp(ME_ID).manager;
    toast(mgr ? `Regularization sent to ${mgr}` : 'Regularization request recorded');
  },
  approve(el) { decide(el.dataset.id, 'approved'); },
  reject(el) { decide(el.dataset.id, 'rejected'); },
  'month-prev'() { ui.timeMonth = addMonths(ui.timeMonth, -1); render(); },
  'month-next'() { if (ui.timeMonth < monthKey(new Date())) { ui.timeMonth = addMonths(ui.timeMonth, 1); render(); } },
  'pay-row'(el) { ui.paySl = Number(el.dataset.sl); render(); },
  'pay-filter'(el) { ui.payFilter = el.dataset.f; render(); },
  async 'pay-map'(el) {
    const sl = Number(el.dataset.sl);
    try {
      await mapRow(sl, el.value || null);
      toast(el.value ? `Sl No ${sl} linked to ${el.value}` : `Sl No ${sl} unlinked`);
    } catch (err) { toast(err.message, { type: 'error' }); render(); }
  },
  'payroll-lock'() { lockPayroll(); toast('Payroll locked'); },
  'payroll-export-links'() {
    const d = payrollData();
    if (!d) return;
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Sl No', 'Employee code', "Employee's Name"].map(q).join(',')]
      .concat(d.rows.map((r) => { const c = d.map[r.slNo]; return [r.slNo, c || '', c ? getEmp(c)?.name : ''].map(q).join(','); }));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' }));
    a.download = `payroll-links-${d.month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  'payroll-remove'() { $('#payroll-remove-dialog').showModal(); },
  'print-payslip'(el) {
    const d = payrollData();
    if (!d) return;
    const row = d.rows.find((r) => r.slNo === Number(el.dataset.sl));
    const code = row && d.map[row.slNo];
    if (row && code) printHtml(payslipHtml(row, code, d.month, d.source));
  },
  policy() { const d = $('#policy-dialog'); $('#policy-body').innerHTML = policyDialogBody(); d.showModal(); },
  dept(el) { ui.peopleDept = el.dataset.dept; render(); },
  'req-tab'(el) { ui.reqTab = el.dataset.tab; render(); },
  'perf-select'(el) { ui.perfIdx = Number(el.dataset.idx); render(); },
  'perf-emp'(el) { ui.perfEmp = el.value; ui.perfIdx = 0; render(); },
  'skill-dept'(el) { ui.skillIdx = Number(el.dataset.idx); ui.skillPerson = null; render(); },
  'skill-person'(el) { ui.skillPerson = ui.skillPerson === el.dataset.p ? null : el.dataset.p; render(); },
  'skill-open'(el) { ui.skillIdx = Number(el.dataset.m); ui.skillPerson = el.dataset.p; },
  doc(el) {
    const key = el.dataset.key;
    if (!docAvailability(key).ok) return toast('Required details are not on file for this document.', { type: 'error' });
    const d = payrollData();
    printHtml(letterHtml(key, rowFor(ME_ID), d?.month));
    const title = DOC_TYPES.find((t) => t.key === key).title;
    update((s) => { s.docsRequested.push({ title, date: todayISO() }); });
  },
  async install() { await pwa.promptInstall(); },
  'reset-local'() { $('#reset-dialog').showModal(); },
};

function decide(id, status) {
  update((s) => {
    const a = s.approvals.find((x) => x.id === id);
    if (a) a.status = status;
  });
  toast(status === 'approved' ? 'Request approved' : 'Request rejected');
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT') return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('select[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
});

// Live search on the People screen (updates the list only, so the input keeps focus).
document.addEventListener('input', (e) => {
  if (e.target.id === 'people-q') {
    ui.peopleQ = e.target.value;
    $('#people-list').innerHTML = peopleListHtml();
  }
});

/* ------------------------------------------------------------ forms */
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const handlers = {
    leave: submitLeave, advance: submitAdvance, permission: submitPermission, expense: submitExpense,
    'payroll-import': submitPayrollImport, 'payroll-unlock': submitPayrollUnlock,
  };
  handlers[form.dataset.form]?.(form, data);
});

function submitLeave(form, d) {
  $$('.field', form).forEach((f) => f.classList.remove('invalid'));
  const mark = (name) => $(`[name="${name}"]`, form)?.closest('.field')?.classList.add('invalid');
  if (!d.from || !d.to) {
    if (!d.from) mark('from'); if (!d.to) mark('to');
    return showError(form, 'Pick both a start and end date.');
  }
  if (d.to < d.from) { mark('to'); return showError(form, 'End date can’t be before the start date.'); }
  const days = countWorkingDays(d.from, d.to);
  if (days === 0) return showError(form, 'That range only has weekly offs or holidays — nothing to deduct.');
  const left = leaveBalances(getState())[d.type].left;
  if (days > left) {
    return showError(form, `You've requested ${days} day${days > 1 ? 's' : ''} but only have ${left} ${LEAVE_LABEL[d.type].toLowerCase()} day${left !== 1 ? 's' : ''} left. Consider splitting this across leave types or shortening the range.`);
  }
  update((s) => {
    s.leaves.push({ id: uid('L'), type: d.type, from: d.from, to: d.to, days, reason: (d.reason || '').trim(), status: 'pending' });
  });
  const mgr = getEmp(ME_ID).manager;
  toast(`Request for ${days} day${days > 1 ? 's' : ''} ${mgr ? 'sent to ' + mgr : 'submitted'}`);
}

function submitAdvance(form, d) {
  const amount = Number(d.amount);
  if (!amount || amount < 500) return showError(form, 'Enter an amount of at least ₹500.');
  if (amount > 50000) return showError(form, 'Advances are capped at ₹50,000 per request.');
  if (!d.month) return showError(form, 'Choose the payroll month for recovery.');
  update((s) => { s.advances.push({ id: uid('A'), amount, month: d.month, reason: (d.reason || '').trim(), status: 'pending' }); });
  toast('Advance request submitted to HR');
}

function submitPermission(form, d) {
  const hours = Number(d.hours);
  if (!d.date) return showError(form, 'Pick a date.');
  if (!hours || hours < 0.5 || hours > 4) return showError(form, 'Hours must be between 0.5 and 4.');
  update((s) => { s.permissions.push({ id: uid('P'), kind: d.kind, date: d.date, hours, reason: (d.reason || '').trim(), status: 'pending' }); });
  toast(`${d.kind} request submitted`);
}

function submitExpense(form, d) {
  const amount = Number(d.amount);
  if (!amount || amount <= 0) {
    showError(form, 'Enter an amount greater than ₹0.');
    $('[name="amount"]', form)?.focus();
    return;
  }
  update((s) => { s.expenses.push({ id: uid('E'), cat: d.cat, amount, date: todayISO(), status: 'pending' }); });
  toast(`Expense of ₹${amount.toLocaleString('en-IN')} added`);
}

async function submitPayrollImport(form, d) {
  const file = $('[name="file"]', form).files[0];
  if (!file) return showError(form, 'Choose the payroll .json file.');
  const btn = $('button[type="submit"]', form);
  btn.disabled = true;
  try {
    await importPayroll(file, d.pass, d.pass2);
    ui.paySl = null;
    toast('Payroll imported and encrypted on this device');
  } catch (err) { showError(form, err.message); } finally { btn.disabled = false; }
}

async function submitPayrollUnlock(form, d) {
  const btn = $('button[type="submit"]', form);
  btn.disabled = true;
  try { await unlockPayroll(d.pass); } catch (err) { showError(form, err.message); btn.disabled = false; }
}

/* ------------------------------------------------------------ dialogs */
document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) closer.closest('dialog').close();
  if (e.target.matches('dialog')) { // click on the backdrop (outside the dialog box)
    const r = e.target.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) e.target.close();
  }
});
$('#reset-confirm').addEventListener('click', () => {
  resetState();
  $('#reset-dialog').close();
  toast('Local records cleared');
});
$('#payroll-remove-confirm').addEventListener('click', () => {
  removePayroll();
  $('#payroll-remove-dialog').close();
  toast('Payroll removed from this device');
});

/* ------------------------------------------------------------ boot */
subscribe(() => render());
onPayrollChange(() => render());
// Lock payroll when the app is hidden for more than 5 minutes.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000 && payrollData()) { lockPayroll(); toast('Payroll locked after inactivity'); }
});
buildNav();
initPWA(() => { if (parseHash().route === 'more') render(); });
render();
