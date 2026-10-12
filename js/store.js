// Tiny persisted state store. Check-ins, leave requests, advances, etc. live in localStorage on this device.
// Every storage call is wrapped: private mode / disabled storage must never break the app.

import { seedState } from './data.js';

const KEY = 'quickair-hr:v2';
const LEGACY_KEY = 'quickair-hr:v1';
const LEGACY_BACKUP = 'quickair-hr:v1-backup';
// Record ids that were shipped as fictional sample data in v1 — never carried forward.
const V1_SAMPLE_IDS = new Set(['L-1', 'L-2', 'L-3', 'L-4', 'L-5', 'A-1', 'P-1', 'E-1', 'E-2', 'AP-1', 'AP-2', 'AP-3']);

let state = null;
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2) return parsed;
    }
    return migrateV1();
  } catch {
    return null;
  }
}

/**
 * v1 mixed fictional sample records with anything the user entered. Keep only what the user created
 * (and back up the raw v1 blob first), drop the samples and fabricated attendance.
 */
function migrateV1() {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return null;
  let old;
  try { old = JSON.parse(raw); } catch { return null; }
  try { localStorage.setItem(LEGACY_BACKUP, raw); localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  const fresh = seedState();
  const mine = (list) => (Array.isArray(list) ? list.filter((x) => x && !V1_SAMPLE_IDS.has(x.id)) : []);
  fresh.leaves = mine(old.leaves);
  fresh.advances = mine(old.advances);
  fresh.permissions = mine(old.permissions);
  fresh.expenses = mine(old.expenses);
  fresh.approvals = []; // v1 approvals all referred to fictional employees
  fresh.attendanceOverrides = old.attendanceOverrides || {};
  fresh.regularizations = old.regularizations || {};
  if (old.checkin && old.checkin.date && old.checkin.in) {
    fresh.checkin = old.checkin;
    fresh.punches[old.checkin.date] = { in: old.checkin.in, out: old.checkin.out };
  }
  return fresh;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable — keep in memory */ }
}

export function getState() {
  if (!state) {
    state = read() || seedState();
    if (!state.punches) state.punches = {};
    write();
  }
  return state;
}

export function update(mutator) {
  mutator(getState());
  write();
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Clears this device's check-ins and requests. Payroll (separate, encrypted) is not touched. */
export function resetState() {
  state = seedState();
  write();
  listeners.forEach((fn) => fn(state));
}

export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
