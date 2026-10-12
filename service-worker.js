/* Quickair HR — service worker
 *
 * Strategies
 *  - App shell (HTML/CSS/JS/icons): pre-cached on install, served cache-first, refreshed in the background.
 *  - Navigations: network-first (so deploys show up), falling back to the cached shell, then offline.html.
 *  - Google Fonts: stale-while-revalidate in a separate runtime cache.
 *  - Everything else cross-origin / non-GET: untouched.
 *
 * All URLs are resolved against the worker's scope, so the app works from any GitHub Pages subpath.
 * `BUILD` is replaced by scripts/build.mjs on every build so each deploy gets a fresh cache.
 */
const VERSION = '2.0.0';
const BUILD = 'dev';
const CACHE = `quickair-hr-shell-${VERSION}-${BUILD}`;
const FONT_CACHE = 'quickair-hr-fonts-v1';

const PRECACHE = [
  './',
  'index.html',
  'offline.html',
  'manifest.json',
  'css/styles.css',
  'js/app.js',
  'js/attendance.js',
  'js/data.js',
  'js/data-employees.js',
  'js/data-skills.js',
  'js/payroll.js',
  'js/docs.js',
  'js/pwa.js',
  'js/store.js',
  'js/utils.js',
  'js/views.js',
  'icons/favicon.svg',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
];

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map(scopeUrl)))
  );
  // No skipWaiting() here: the page asks for it (SKIP_WAITING message) when the user accepts an update.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('quickair-hr-') && k !== CACHE && k !== FONT_CACHE)
        .map((k) => caches.delete(k))
    );
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable().catch(() => {});
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Google Fonts (stylesheet + font files)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, CACHE));
});

async function handleNavigation(event) {
  const cache = await caches.open(CACHE);
  try {
    const preload = await event.preloadResponse;
    const response = preload || await fetch(event.request);
    if (response && response.ok) cache.put(scopeUrl('index.html'), response.clone());
    return response;
  } catch {
    return (
      (await cache.match(scopeUrl('index.html'))) ||
      (await cache.match(scopeUrl('./'))) ||
      (await cache.match(scopeUrl('offline.html'))) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then((response) => {
      // status 0 = opaque (cross-origin font responses); safe to cache for fonts.
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    network.catch(() => {}); // refresh in the background
    return cached;
  }
  const fresh = await network;
  return fresh || new Response('', { status: 504, statusText: 'Offline' });
}
