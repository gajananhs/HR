// Small shared helpers (formatting, DOM, dates).

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export const money = (n) => '₹' + inr.format(Math.round(Number(n) || 0));
export const signedMoney = (n) => '−' + money(Math.abs(n));

export const pad = (n) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD (never use toISOString for local dates). */
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => iso(new Date());
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate(); // m is 1-based

export const fmtDay = (s) => parseISO(s).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtShort = (s) => parseISO(s).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
export const fmtLong = (s) => parseISO(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
export const addMonths = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

export const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

let toastHost;
/** Show a transient message. `action` = { label, onClick } adds a button (used for SW updates). */
export function toast(message, { type = 'info', action = null, ms = 3600 } = {}) {
  toastHost = toastHost || $('#toasts');
  if (!toastHost) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.addEventListener('click', () => { action.onClick(); el.remove(); });
    el.append(b);
  }
  toastHost.append(el);
  if (!action) setTimeout(() => el.remove(), ms);
}
