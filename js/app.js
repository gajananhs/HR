// Quickair HR — app entry: hash router, event delegation, form handling.
// Hash routing (#/home) keeps every URL valid on GitHub Pages project sites without server rewrites.

import { $, $$, esc, pad, todayISO, toast, addMonths, monthKey } from './utils.js';
import { EMPLOYEES, ME_ID, LEAVE_LABEL } from './data.js';
import { getState, update, subscribe, resetState, uid } from './store.js';
import { countWorkingDays, leaveBalances } from './attendance.js';
import { payslipHtml, letterHtml, printHtml } from './docs.js';
import { buildPayslips } from './data.js';
import { initPWA, pwa } from './pwa.js';
import {
  ui, NAV, ICONS, pendingApprovals, homeView, timeView, leaveView, payView, moreView, peopleView,
  peopleListHtml, personView, requestsView, performanceView, skillsView, documentsView, policyDialogBody,
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
  $('#side-who').innerHTML = `<span class="avatar sm">${esc(user.name.split(' ').map((p) => p[0]).join(''))}</span><div>${esc(user.name)}<small>${esc(user.role)}</small></div>`;
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
  pay: (s) => payView(s),
  more: (s) => moreView(s, { canInstall: pwa.canInstall, isIOS: pwa.isIOS, installed: pwa.installed }),
  people: (s, id) => (id ? personView(s, id) : peopleView(s)),
  requests: (s) => requestsView(s),
  performance: () => performanceView(),
  skills: () => skillsView(),
  documents: (s) => documentsView(s),
};

const titles = {
  home: 'Home', time: 'Attendance', leave: 'Leave', pay: 'Payslips', more: 'More', people: 'People',
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
    });
    const c = getState().checkin;
    toast(c.out ? `Checked out at ${c.out}` : `Checked in at ${c.in}`);
  },
  regularize(el) {
    const date = el.dataset.date;
    update((s) => { s.regularizations[date] = 'pending'; });
    toast(`Regularization sent to ${getEmp(ME_ID).manager}`);
  },
  approve(el) { decide(el.dataset.id, 'approved'); },
  reject(el) { decide(el.dataset.id, 'rejected'); },
  'month-prev'() { ui.timeMonth = addMonths(ui.timeMonth, -1); render(); },
  'month-next'() { if (ui.timeMonth < monthKey(new Date())) { ui.timeMonth = addMonths(ui.timeMonth, 1); render(); } },
  'pay-select'(el) { ui.payKey = el.value; render(); },
  'print-payslip'(el) {
    const slip = buildPayslips().find((s) => s.key === el.dataset.key);
    if (slip) printHtml(payslipHtml(slip));
  },
  policy() { const d = $('#policy-dialog'); $('#policy-body').innerHTML = policyDialogBody(); d.showModal(); },
  dept(el) { ui.peopleDept = el.dataset.dept; render(); },
  'req-tab'(el) { ui.reqTab = el.dataset.tab; render(); },
  'perf-select'(el) { ui.perfIdx = Number(el.dataset.idx); render(); },
  doc(el) {
    const key = el.dataset.key;
    printHtml(letterHtml(key, buildPayslips()));
    const title = { employment: 'Employment verification letter', 'salary-cert': 'Salary certificate', experience: 'Experience letter (preview)', form16: 'Form 16 (previous FY)' }[key];
    update((s) => { s.docsRequested.push({ title, date: todayISO() }); });
  },
  async install() { await pwa.promptInstall(); },
  'reset-demo'() { $('#reset-dialog').showModal(); },
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
  const handlers = { leave: submitLeave, advance: submitAdvance, permission: submitPermission, expense: submitExpense };
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
  toast(`Request for ${days} day${days > 1 ? 's' : ''} sent to ${getEmp(ME_ID).manager}`);
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
  toast('Demo data reset');
});

/* ------------------------------------------------------------ boot */
subscribe(() => render());
buildNav();
initPWA(() => { if (parseHash().route === 'more') render(); });
render();
