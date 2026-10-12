// Copies the deployable files into ./dist and stamps the service-worker cache name with a build id,
// so every deployment invalidates old caches. No bundler is needed — the app is plain ES modules.
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const build = (process.env.GITHUB_SHA || String(Date.now())).slice(0, 8);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const item of ['index.html', 'offline.html', '404.html', 'manifest.json', 'service-worker.js', '.nojekyll', 'css', 'js', 'icons']) {
  cpSync(join(root, item), join(dist, item), { recursive: true });
}

const swPath = join(dist, 'service-worker.js');
const sw = readFileSync(swPath, 'utf8').replace("const BUILD = 'dev';", `const BUILD = '${build}';`);
writeFileSync(swPath, sw);

console.log(`✔ Built to dist/ (build id ${build})`);
