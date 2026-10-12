// Printable documents (payslip, letters). Rendered into a hidden iframe and sent to the
// browser's print dialog, where "Save as PDF" is available on every platform.
// Every figure and field comes from the supplied data; documents are disabled when a stated field is missing.

import { esc, money, monthLabel, fmtLong, todayISO } from './utils.js';
import { COMPANY, ME_ID, byId } from './data.js';
import { EARN_LABELS, DED_LABELS } from './payroll.js';

const BASE_CSS = `
  @page{ size:A4; margin:18mm; }
  *{ box-sizing:border-box; }
  body{ font-family:'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; color:#1D2B26; font-size:12.5px; line-height:1.55; }
  h1{ font-family:Georgia,'Times New Roman',serif; font-size:20px; margin:0 0 2px; color:#16302C; }
  h2{ font-family:Georgia,'Times New Roman',serif; font-size:15px; margin:22px 0 8px; color:#16302C; }
  .muted{ color:#6c7f73; }
  .head{ display:flex; justify-content:space-between; gap:20px; border-bottom:2px solid #16302C; padding-bottom:12px; margin-bottom:16px; }
  table{ width:100%; border-collapse:collapse; }
  td,th{ padding:7px 6px; border-bottom:1px solid #E9E5D8; text-align:left; }
  td.r,th.r{ text-align:right; font-variant-numeric:tabular-nums; }
  tr.total td{ border-top:2px solid #1D2B26; font-weight:700; border-bottom:none; }
  .meta{ display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; margin-bottom:6px; }
  .note{ margin-top:22px; font-size:10.5px; color:#6c7f73; }
  .sign{ margin-top:48px; }
`;

function wrap(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}</style></head><body>${body}</body></html>`;
}

function letterhead(subtitle) {
  return `<div class="head"><div><h1>${esc(COMPANY.legal)}</h1><div class="muted">${esc(COMPANY.address)}</div></div><div style="text-align:right"><strong>${esc(subtitle)}</strong><div class="muted">Issued ${esc(fmtLong(todayISO()))}</div></div></div>`;
}

const opt = (label, v) => (v ? `<div><span class="muted">${label}:</span> ${esc(v)}</div>` : '');

/** Payslip for one wages-register row that has been linked to an employee code. */
export function payslipHtml(row, code, month, source) {
  const e = byId(code);
  const earn = EARN_LABELS.filter(([k]) => row.earned[k]).map(([k, l]) => [l, row.earned[k]]);
  const ded = DED_LABELS.filter(([k]) => row.ded[k]).map(([k, l]) => [l, row.ded[k]]);
  const body = `${letterhead('Payslip — ' + monthLabel(month))}
    <div class="meta">
      <div><span class="muted">Employee:</span> ${esc(e.name)}</div><div><span class="muted">Employee code:</span> ${esc(e.id)}</div>
      ${opt('Designation', e.role)}${opt('Department', e.dept)}
      ${opt('Date of joining', row.doj && fmtLong(row.doj))}${opt('UAN', row.uan)}
      <div><span class="muted">Pay days:</span> ${row.payDays ?? '—'} of ${row.wageDays ?? '—'}</div>${row.otHrs ? `<div><span class="muted">OT hours:</span> ${row.otHrs}</div>` : ''}
    </div>
    <h2>Earnings</h2>
    <table>${earn.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="r">${money(v)}</td></tr>`).join('')}
    <tr class="total"><td>Gross salary</td><td class="r">${money(row.gross)}</td></tr></table>
    <h2>Deductions</h2>
    <table>${ded.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="r">−${money(v)}</td></tr>`).join('')}
    <tr class="total"><td>Total deductions</td><td class="r">−${money(row.totalDed)}</td></tr>
    <tr class="total"><td>Net salary</td><td class="r">${money(row.net)}</td></tr></table>
    <p class="note">Computer-generated from the ${esc(monthLabel(month))} register of wages (Sl No ${row.slNo}). Confidential.</p>`;
  return wrap(`Payslip ${e.id} ${monthLabel(month)}`, body);
}

/** Letters for the signed-in employee. Callers must check docAvailability() first. */
export function letterHtml(key, payRow, month) {
  const e = byId(ME_ID);
  const titles = {
    employment: 'Employment verification letter',
    'salary-cert': 'Salary certificate',
    experience: 'Experience letter (preview)',
  };
  const para = {
    employment: `This is to certify that <strong>${esc(e.name)}</strong> (Employee code ${esc(e.id)}) is employed with ${esc(COMPANY.legal)} as <strong>${esc(e.role)}</strong> in the ${esc(e.dept)} department since ${esc(fmtLong(e.joined || ''))}.${e.status ? ` Employment status: ${esc(e.status)}.` : ''}`,
    'salary-cert': payRow ? `This is to certify that <strong>${esc(e.name)}</strong> (Employee code ${esc(e.id)}) is employed with ${esc(COMPANY.legal)}. For ${esc(monthLabel(month))} the gross salary was <strong>${money(payRow.gross)}</strong> and the net salary was <strong>${money(payRow.net)}</strong>, as per the register of wages.` : '',
    experience: `This is a preview. An experience letter is issued on separation. It will confirm that <strong>${esc(e.name)}</strong> served as ${esc(e.role)} from ${esc(fmtLong(e.joined || ''))} to the last working day.`,
  };
  const body = `${letterhead(titles[key])}
    <p>To whom it may concern,</p><p style="margin-top:14px">${para[key]}</p>
    <p style="margin-top:14px">This letter is issued at the employee's request for official purposes.</p>
    <div class="sign"><div>Authorised signatory</div><div class="muted">Human Resources, ${esc(COMPANY.legal)}</div></div>`;
  return wrap(titles[key], body);
}

/** Print an HTML string via a throw-away iframe (no popups, works inside installed PWAs). */
export function printHtml(html) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.append(frame);
  const cleanup = () => setTimeout(() => frame.remove(), 1500);
  frame.addEventListener('load', () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } finally { cleanup(); }
  }, { once: true });
  frame.srcdoc = html;
}
