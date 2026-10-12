// Tiny persisted state store. All demo data changes (check-in, leave requests, …) live in localStorage.
// Every storage call is wrapped: private mode / disabled storage must never break the app.

import { seedState } from './data.js';

const KEY = 'quickair-hr:v1';
let state = null;
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable — keep in memory */ }
}

export function getState() {
  if (!state) state = read() || seedState();
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

export function resetState() {
  state = seedState();
  write();
  listeners.forEach((fn) => fn(state));
}

export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
