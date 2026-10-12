// Sanity checks run before every build / deploy:
//  - every file in the service worker's PRECACHE list exists
//  - every icon referenced by manifest.json exists
//  - every local JS import resolves
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const need = (rel, why) => { if (!existsSync(join(root, rel))) errors.push(`Missing ${rel} (${why})`); };

const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');
const list = /const PRECACHE = \[([\s\S]*?)\];/.exec(sw);
if (!list) errors.push('Could not find PRECACHE in service-worker.js');
else {
  const entries = [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((p) => p !== './');
  entries.forEach((p) => need(p, 'listed in PRECACHE'));
  const jsFiles = readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`);
  jsFiles.filter((f) => !entries.includes(f)).forEach((f) => errors.push(`${f} is not in PRECACHE — it would break offline mode`));
}

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
[...manifest.icons, ...(manifest.shortcuts || []).flatMap((s) => s.icons || [])].forEach((i) => need(i.src, 'manifest icon'));

for (const f of readdirSync(join(root, 'js')).filter((n) => n.endsWith('.js'))) {
  const src = readFileSync(join(root, 'js', f), 'utf8');
  for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) need(join('js', m[1]), `imported by js/${f}`);
}

if (errors.length) {
  console.error('✖ Check failed:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('✔ Project check passed');
