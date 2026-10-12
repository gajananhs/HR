// Quickair HR — reference data for Canares Automation Pvt. Ltd. (CAPL).
//
// Source of truth (see scripts/import-data.py):
//   • Employee names + codes ........ Emp_Name_With_ID_2.xlsx       → js/data-employees.js
//   • Skill matrices (9 workbooks) .. skill_matrix_*.xlsx           → js/data-skills.js
//   • Salary ........................ salary_statement_format_2.xlsx → NOT bundled; imported on an HR device
//                                                                       and stored encrypted (js/payroll.js)
//   • KPI reviews ................... no KPI data supplied yet        → KPI_REVIEWS is empty
//
// Rule: nothing here is invented. A field the sources do not contain stays null and the UI shows "Not on file".

import { iso } from './utils.js';
import { EMPLOYEE_MASTER } from './data-employees.js';
import { SKILL_DATA } from './data-skills.js';

export const COMPANY = {
  name: 'Quickair HR',
  legal: 'Canares Automation Private Limited',
  address: 'No. 85/O-A, Industrial Suburb, Industrial Layout, Yeshwanthpura, Bengaluru 560022',
  city: 'Bengaluru',
};

/** Signed-in employee for this device. CAPL_1001 = H S Gajanan (from the employee master). */
export const ME_ID = 'CAPL_1001';

const NOT_ON_FILE = null;

/**
 * Employee records. Only `id` and `name` come from the master; `dept` / `role` come from the skill matrix the
 * employee is linked to (if any). Everything else is not in the supplied data and stays null.
 */
export const EMPLOYEES = EMPLOYEE_MASTER.employees.map((e) => {
  const sk = SKILL_DATA.matrices.find((m) => m.employees.some((x) => x.code === e.id));
  const row = sk?.employees.find((x) => x.code === e.id);
  return {
    id: e.id,
    name: e.name,
    dept: e.dept || NOT_ON_FILE,
    role: row?.title && row.title.toUpperCase() !== (sk?.dept || '').toUpperCase() ? row.title : NOT_ON_FILE,
    joined: NOT_ON_FILE,
    status: NOT_ON_FILE,
    manager: NOT_ON_FILE,
    email: NOT_ON_FILE,
    phone: NOT_ON_FILE,
    location: NOT_ON_FILE,
  };
});

export const UNASSIGNED = 'Unassigned';
export const DEPARTMENTS = [...new Set(EMPLOYEES.map((e) => e.dept || UNASSIGNED))]
  .sort((a, b) => (a === UNASSIGNED) - (b === UNASSIGNED) || a.localeCompare(b));

export const byId = (id) => EMPLOYEES.find((e) => e.id === id) || null;
export const DATA_SOURCES = { master: EMPLOYEE_MASTER.source, importedOn: EMPLOYEE_MASTER.importedOn };

/** Annual paid-leave entitlement (calendar year) — retained from the existing HR dashboard configuration. */
export const LEAVE_POLICY = { CL: 12, SL: 12, EL: 15 };
export const LEAVE_LABEL = { CL: 'Casual', SL: 'Sick', EL: 'Earned' };

/** Attendance codes used by the HR dashboard. */
export const ATT_CODES = {
  P: 'Present', A: 'Absent', CL: 'Casual leave', SL: 'Sick leave', EL: 'Earned leave',
  OD: 'On duty', H: 'Holiday', OFF: 'Weekly off', R: 'Rest / comp-off', '?': 'Not marked', '-': 'No record',
};

/**
 * Holiday calendar — retained unchanged from the existing app (public holidays, not employee data).
 * CAPL's own notified holiday list was not supplied; replace this list with it when available.
 */
const Y = new Date().getFullYear();
export const HOLIDAYS_SOURCE = 'Public holidays carried over from the existing app — CAPL holiday list not yet supplied';
export const HOLIDAYS = [
  ...[Y, Y + 1].flatMap((yr) => [
    { date: `${yr}-01-01`, name: "New Year's Day" },
    { date: `${yr}-01-26`, name: 'Republic Day' },
    { date: `${yr}-05-01`, name: 'Labour Day' },
    { date: `${yr}-08-15`, name: 'Independence Day' },
    { date: `${yr}-11-01`, name: 'Kannada Rajyotsava' },
    { date: `${yr}-12-25`, name: 'Christmas' },
  ]),
  { date: '2026-03-19', name: 'Ugadi' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi' },
  { date: '2026-10-20', name: 'Vijayadashami' },
  { date: '2026-11-08', name: 'Deepavali' },
  { date: '2026-11-09', name: 'Balipadyami' },
].sort((a, b) => a.date.localeCompare(b.date));

export const holidayMap = () => Object.fromEntries(HOLIDAYS.map((h) => [h.date, h.name]));

/** Company events — none supplied. */
export const EVENTS = [];

/** Seed state — first-run values; the live copy is persisted in localStorage. No sample records. */
export function seedState() {
  return {
    version: 2,
    since: iso(new Date()),     // attendance before this date has no record in this app
    checkin: { date: null, in: null, out: null },
    punches: {},               // { 'YYYY-MM-DD': { in, out } } — real check-ins made in this app
    attendanceOverrides: {},   // { 'YYYY-MM-DD': { code, note } }
    regularizations: {},       // { 'YYYY-MM-DD': 'pending' }
    leaves: [],
    advances: [],
    permissions: [],
    expenses: [],
    approvals: [],
    docsRequested: [],
  };
}

/**
 * KPI reviews, keyed by employee code: { 'CAPL_1xxx': [ { period, reviewer, overall, label, items:[{name, weight, score, target, actual, note}] } ] }.
 * No KPI data has been supplied — the Performance screen shows that instead of sample reviews.
 */
export const KPI_REVIEWS = {};
export const kpiFor = (id) => KPI_REVIEWS[id] || [];

/* ------------------------------------------------------------------ skill matrix helpers */
export const SKILL_SCALE = SKILL_DATA.scale;           // { 1: 'Trainee', … 4: 'Expert' }
export const SKILL_MAX = Math.max(...Object.keys(SKILL_DATA.scale).map(Number));
export const SKILL_MATRICES = SKILL_DATA.matrices;

const isLvl = (v) => typeof v === 'number';

/** Score one person's row. Only skills with both Expected and Current as numbers count. */
export function scoreSkills(ratings) {
  let exp = 0, cur = 0, assessed = 0, gaps = 0, gapPts = 0, notAssessed = 0, na = 0;
  ratings.forEach(([e, c]) => {
    if (e === 'NA' || c === 'NA') { na++; return; }
    if (isLvl(e) && !isLvl(c)) { notAssessed++; return; }
    if (!isLvl(e) || !isLvl(c)) return;
    assessed++; exp += e; cur += Math.min(c, e);
    if (c < e) { gaps++; gapPts += e - c; }
  });
  return {
    assessed, gaps, gapPts, notAssessed, na,
    competency: exp ? Math.round((cur / exp) * 100) : null, // % of expected level achieved (capped per skill)
  };
}

/** Every skill row linked to an employee code. */
export const skillsFor = (id) => SKILL_MATRICES.flatMap((m) => m.employees
  .filter((e) => e.code === id)
  .map((e) => ({ matrix: m, person: e, score: scoreSkills(e.ratings) })));

export const DOC_TYPES = [
  { key: 'employment', title: 'Employment verification letter', sub: 'Needs role, department and date of joining', needs: ['role', 'dept', 'joined'] },
  { key: 'salary-cert', title: 'Salary certificate', sub: 'Needs your wages-register row (Pay → unlock)', needs: ['payroll'] },
  { key: 'experience', title: 'Experience letter', sub: 'Issued on exit — needs role and date of joining', needs: ['role', 'joined'] },
];

export const PERMISSION_KINDS = ['Late arrival', 'Early departure'];
export const EXPENSE_CATS = ['Travel', 'Food', 'Client visit', 'Other'];
