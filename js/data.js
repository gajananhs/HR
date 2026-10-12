// Mock data for Quickair HR. Everything here is fictional sample data.
// Dates are generated relative to "today" so the demo always looks current.

import { iso, parseISO, seeded, addMonths, monthKey, daysInMonth } from './utils.js';

export const COMPANY = {
  name: 'Quickair HR',
  legal: 'Northwind Pneumatics Pvt. Ltd.',
  city: 'Bengaluru',
};

export const ME_ID = 'NP-0217';

export const EMPLOYEES = [
  { id: 'NP-0217', name: 'Rohan Kulkarni',  dept: 'Production Planning', role: 'Planning Lead',        joined: '2021-06-14', status: 'Confirmed', manager: 'Meera Nambiar', email: 'rohan.kulkarni@example.com', phone: '+91 98450 10217', location: 'Peenya Plant' },
  { id: 'NP-0101', name: 'Meera Nambiar',   dept: 'Operations',          role: 'Operations Head',      joined: '2017-02-01', status: 'Confirmed', manager: '—',             email: 'meera.nambiar@example.com',  phone: '+91 98450 10101', location: 'Head Office' },
  { id: 'NP-0134', name: 'Imran Sheikh',    dept: 'Quality',             role: 'Quality Engineer',     joined: '2019-09-09', status: 'Confirmed', manager: 'Rohan Kulkarni', email: 'imran.sheikh@example.com',   phone: '+91 98450 10134', location: 'Peenya Plant' },
  { id: 'NP-0156', name: 'Divya Menon',     dept: 'Design',              role: 'Design Engineer',      joined: '2020-01-20', status: 'Confirmed', manager: 'Meera Nambiar', email: 'divya.menon@example.com',    phone: '+91 98450 10156', location: 'Head Office' },
  { id: 'NP-0172', name: 'Karthik Raman',   dept: 'Sales',               role: 'Regional Sales Exec',  joined: '2020-11-02', status: 'Confirmed', manager: 'Meera Nambiar', email: 'karthik.raman@example.com',  phone: '+91 98450 10172', location: 'Head Office' },
  { id: 'NP-0188', name: 'Lakshmi Gowda',   dept: 'Accounts',            role: 'Accounts Executive',   joined: '2021-03-15', status: 'Confirmed', manager: 'Meera Nambiar', email: 'lakshmi.gowda@example.com',  phone: '+91 98450 10188', location: 'Head Office' },
  { id: 'NP-0203', name: 'Suresh Patil',    dept: 'Stores',              role: 'Store Keeper',         joined: '2021-08-23', status: 'Confirmed', manager: 'Rohan Kulkarni', email: 'suresh.patil@example.com',   phone: '+91 98450 10203', location: 'Peenya Plant' },
  { id: 'NP-0209', name: 'Nandini Hegde',   dept: 'Human Resources',     role: 'HR Executive',         joined: '2022-01-10', status: 'Confirmed', manager: 'Meera Nambiar', email: 'nandini.hegde@example.com',  phone: '+91 98450 10209', location: 'Head Office' },
  { id: 'NP-0224', name: 'Arvind Shetty',   dept: 'Production Planning', role: 'Machine Operator',     joined: '2022-05-30', status: 'Confirmed', manager: 'Rohan Kulkarni', email: 'arvind.shetty@example.com',  phone: '+91 98450 10224', location: 'Peenya Plant' },
  { id: 'NP-0231', name: 'Farah Siddiqui',  dept: 'Purchase',            role: 'Purchase Executive',   joined: '2022-09-12', status: 'Confirmed', manager: 'Meera Nambiar', email: 'farah.siddiqui@example.com', phone: '+91 98450 10231', location: 'Head Office' },
  { id: 'NP-0247', name: 'Vikram Joshi',    dept: 'Service',             role: 'Service Technician',   joined: '2023-02-06', status: 'Confirmed', manager: 'Meera Nambiar', email: 'vikram.joshi@example.com',   phone: '+91 98450 10247', location: 'Field' },
  { id: 'NP-0252', name: 'Pooja Bhat',      dept: 'Quality',             role: 'Inspector',            joined: '2023-04-17', status: 'Confirmed', manager: 'Imran Sheikh',  email: 'pooja.bhat@example.com',     phone: '+91 98450 10252', location: 'Peenya Plant' },
  { id: 'NP-0266', name: 'Naveen Prasad',   dept: 'Production Planning', role: 'Assembly Technician',  joined: '2023-10-03', status: 'Confirmed', manager: 'Rohan Kulkarni', email: 'naveen.prasad@example.com',  phone: '+91 98450 10266', location: 'Peenya Plant' },
  { id: 'NP-0279', name: 'Sneha Kamath',    dept: 'Design',              role: 'CAD Technician',       joined: '2024-06-24', status: 'Confirmed', manager: 'Divya Menon',   email: 'sneha.kamath@example.com',   phone: '+91 98450 10279', location: 'Head Office' },
  { id: 'NP-0288', name: 'Rahul Desai',     dept: 'Sales',               role: 'Sales Coordinator',    joined: '2025-01-13', status: 'Probation', manager: 'Karthik Raman', email: 'rahul.desai@example.com',    phone: '+91 98450 10288', location: 'Head Office' },
  { id: 'NP-0293', name: 'Anika Rao',       dept: 'Accounts',            role: 'Accounts Trainee',     joined: '2026-07-01', status: 'Probation', manager: 'Lakshmi Gowda', email: 'anika.rao@example.com',      phone: '+91 98450 10293', location: 'Head Office' },
];

export const DEPARTMENTS = [...new Set(EMPLOYEES.map((e) => e.dept))].sort();

/** Annual paid-leave entitlement (calendar year) — mirrors the CL / SL / EL policy in the HR dashboard. */
export const LEAVE_POLICY = { CL: 12, SL: 12, EL: 15 };
export const LEAVE_LABEL = { CL: 'Casual', SL: 'Sick', EL: 'Earned' };

/** Attendance codes used by the HR dashboard. */
export const ATT_CODES = {
  P: 'Present', A: 'Absent', CL: 'Casual leave', SL: 'Sick leave', EL: 'Earned leave',
  OD: 'On duty', H: 'Holiday', OFF: 'Weekly off', R: 'Rest / comp-off', '?': 'Not marked',
};

function nextYearDate(mmdd, year) { return `${year}-${mmdd}`; }
const Y = new Date().getFullYear();
export const HOLIDAYS = [
  ...[Y, Y + 1].flatMap((yr) => [
    { date: nextYearDate('01-01', yr), name: "New Year's Day" },
    { date: nextYearDate('01-26', yr), name: 'Republic Day' },
    { date: nextYearDate('05-01', yr), name: 'Labour Day' },
    { date: nextYearDate('08-15', yr), name: 'Independence Day' },
    { date: nextYearDate('11-01', yr), name: 'Kannada Rajyotsava' },
    { date: nextYearDate('12-25', yr), name: 'Christmas' },
  ]),
  { date: '2026-03-19', name: 'Ugadi' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi' },
  { date: '2026-10-20', name: 'Vijayadashami' },
  { date: '2026-11-08', name: 'Deepavali' },
  { date: '2026-11-09', name: 'Balipadyami' },
].sort((a, b) => a.date.localeCompare(b.date));

export const holidayMap = () => Object.fromEntries(HOLIDAYS.map((h) => [h.date, h.name]));

export const EVENTS = [
  { date: offsetDays(6),  name: 'Safety drill — Peenya Plant' },
  { date: offsetDays(15), name: 'Quarterly town hall' },
];
function offsetDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }

/** Compensation structure for the signed-in employee (monthly, INR). */
export const SALARY = {
  basic: 42000, hra: 16800, medical: 1250, conveyance: 1600, special: 14350,
  pfRate: 0.12, pt: 200, tds: 2350,
};

/** Build payslips for the last 5 completed months. */
export function buildPayslips(now = new Date()) {
  const gross = SALARY.basic + SALARY.hra + SALARY.medical + SALARY.conveyance + SALARY.special;
  const lastDone = addMonths(monthKey(now), -1);
  const slips = [];
  for (let i = 0; i < 5; i++) {
    const key = addMonths(lastDone, -i);
    const [y, m] = key.split('-').map(Number);
    const days = daysInMonth(y, m);
    const lop = seeded('lop' + key) > 0.78 ? 1 : 0;
    const lopAmt = Math.round((gross / days) * lop);
    const advance = key === addMonths(lastDone, -2) ? 5000 : 0;
    const pf = Math.round(SALARY.basic * SALARY.pfRate);
    const deductions = pf + SALARY.pt + SALARY.tds + advance + lopAmt;
    slips.push({ key, days, payDays: days - lop, lop, lopAmt, gross, pf, advance, net: gross - deductions });
  }
  return slips;
}

/** Seed state — first-run values; the live copy is persisted in localStorage. */
export function seedState() {
  const y = new Date().getFullYear();
  return {
    version: 1,
    checkin: { date: null, in: null, out: null },
    attendanceOverrides: {},   // { 'YYYY-MM-DD': { code, note } }
    regularizations: {},       // { 'YYYY-MM-DD': 'pending' }
    leaves: [
      { id: 'L-1', type: 'CL', from: `${y}-02-12`, to: `${y}-02-12`, days: 1, reason: 'Family function', status: 'approved' },
      { id: 'L-2', type: 'CL', from: `${y}-04-08`, to: `${y}-04-09`, days: 2, reason: 'Personal work', status: 'approved' },
      { id: 'L-3', type: 'SL', from: `${y}-05-20`, to: `${y}-05-21`, days: 2, reason: 'Viral fever', status: 'approved' },
      { id: 'L-4', type: 'EL', from: `${y}-06-15`, to: `${y}-06-18`, days: 4, reason: 'Trip to Coorg', status: 'approved' },
      { id: 'L-5', type: 'EL', from: `${y}-01-05`, to: `${y}-01-07`, days: 3, reason: 'Travel', status: 'rejected' },
    ],
    advances: [
      { id: 'A-1', amount: 5000, month: addMonths(monthKey(new Date()), -3), reason: 'Medical expense', status: 'approved' },
    ],
    permissions: [
      { id: 'P-1', kind: 'Late arrival', date: offsetDays(-20), hours: 1, reason: 'Vehicle breakdown', status: 'approved' },
    ],
    expenses: [
      { id: 'E-1', cat: 'Travel', amount: 640, date: offsetDays(-9), status: 'approved' },
      { id: 'E-2', cat: 'Client visit', amount: 1850, date: offsetDays(-4), status: 'pending' },
    ],
    approvals: [
      { id: 'AP-1', empId: 'NP-0134', kind: 'leave', detail: 'Sick leave · 2 days', status: 'pending' },
      { id: 'AP-2', empId: 'NP-0203', kind: 'advance', detail: 'Salary advance · ₹8,000', status: 'pending' },
      { id: 'AP-3', empId: 'NP-0224', kind: 'permission', detail: 'Late arrival · 1.5h', status: 'pending' },
    ],
    docsRequested: [],
  };
}

/** KPI reviews for the signed-in employee. */
export const KPI_REVIEWS = [
  {
    period: 'Q2 FY26', reviewer: 'Meera Nambiar', overall: 4.2, label: 'Exceeds expectations',
    items: [
      { name: 'On-time production plan adherence', weight: 30, score: 4.5, note: 'Hit 96% adherence across 13 weeks.' },
      { name: 'Rework & rejection rate', weight: 25, score: 4.0, note: 'Rejection down from 2.4% to 1.7%.' },
      { name: 'Machine utilisation', weight: 20, score: 4.0, note: 'Average 82% vs 85% target.' },
      { name: 'Team coordination', weight: 15, score: 4.5, note: 'Cross-shift handovers well documented.' },
      { name: 'Safety compliance', weight: 10, score: 4.0, note: 'Zero reportable incidents.' },
    ],
  },
  {
    period: 'Q1 FY26', reviewer: 'Meera Nambiar', overall: 3.8, label: 'Meets expectations',
    items: [
      { name: 'On-time production plan adherence', weight: 30, score: 4.0, note: '92% adherence.' },
      { name: 'Rework & rejection rate', weight: 25, score: 3.5, note: 'Two lots reworked due to tooling.' },
      { name: 'Machine utilisation', weight: 20, score: 3.5, note: 'Below target in April.' },
      { name: 'Team coordination', weight: 15, score: 4.0, note: 'Good.' },
      { name: 'Safety compliance', weight: 10, score: 4.0, note: 'Compliant.' },
    ],
  },
];

/** Skill matrix for the signed-in employee. level & target are 1–5. */
export const SKILLS = [
  { name: 'Production scheduling', level: 4, target: 5, plan: 'Complete advanced APS course by Dec' },
  { name: 'Lean / 5S practices', level: 4, target: 4, plan: 'Maintain — mentor two juniors' },
  { name: 'CNC programming basics', level: 3, target: 4, plan: 'Shadow design team for 4 weeks' },
  { name: 'ERP data entry & reports', level: 4, target: 4, plan: 'Maintain' },
  { name: 'Root-cause analysis (8D)', level: 2, target: 4, plan: 'Workshop booked for next quarter' },
  { name: 'People management', level: 3, target: 4, plan: 'Leadership cohort — module 2 of 4' },
];

export const DOC_TYPES = [
  { key: 'employment', title: 'Employment verification letter', sub: 'Confirms role, joining date and status' },
  { key: 'salary-cert', title: 'Salary certificate', sub: 'Monthly gross & net pay' },
  { key: 'experience', title: 'Experience letter', sub: 'Issued on exit — preview only' },
  { key: 'form16', title: 'Form 16 (previous FY)', sub: 'Tax deduction summary' },
];

export const PERMISSION_KINDS = ['Late arrival', 'Early departure'];
export const EXPENSE_CATS = ['Travel', 'Food', 'Client visit', 'Other'];

/** Deterministic status for the whole team "today" (used for snapshot counts). */
export function teamStatusToday(dateISO, hMap, myState) {
  const d = parseISO(dateISO);
  const dow = d.getDay();
  const out = { present: 0, leave: 0, absent: 0, off: 0, total: EMPLOYEES.length };
  if (dow === 0 || hMap[dateISO]) { out.off = EMPLOYEES.length; return out; }
  EMPLOYEES.forEach((e) => {
    if (e.id === ME_ID) {
      const code = myState;
      if (code === 'leave') out.leave++; else if (code === 'absent') out.absent++; else out.present++;
      return;
    }
    const r = seeded(e.id + dateISO);
    if (r < 0.1) out.leave++; else if (r < 0.14) out.absent++; else out.present++;
  });
  return out;
}
