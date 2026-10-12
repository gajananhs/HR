// PWA plumbing: service-worker registration, update prompt, install prompt, online/offline banner.

import { toast } from './utils.js';

export const pwa = {
  deferredPrompt: null,
  onChange: () => {},
  get canInstall() { return !!this.deferredPrompt; },
  get installed() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  },
  get isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },
  async promptInstall() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    await this.deferredPrompt.userChoice.catch(() => {});
    this.deferredPrompt = null;
    this.onChange();
  },
};

export function initPWA(onChange) {
  pwa.onChange = onChange;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pwa.deferredPrompt = e;
    onChange();
  });
  window.addEventListener('appinstalled', () => {
    pwa.deferredPrompt = null;
    toast('Quickair HR installed');
    onChange();
  });

  const banner = document.getElementById('net-banner');
  const sync = () => { if (banner) banner.hidden = navigator.onLine; };
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      // Resolved against the document URL so it works from any GitHub Pages subpath.
      const url = new URL('service-worker.js', document.baseURI);
      const scope = new URL('./', document.baseURI).pathname;
      const reg = await navigator.serviceWorker.register(url, { scope });

      const promptUpdate = (worker) => toast('A new version is ready.', {
        action: { label: 'Update', onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
      });

      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(worker);
        });
      });

      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });

      // Check for updates whenever the app returns to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  });
}
