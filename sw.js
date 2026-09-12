/* ============================================================
   sw.js — keeps the app working with no signal.

   Bump CACHE_VERSION whenever the shell changes; the old cache is
   dropped on activate. Everything is network-first with a short
   timeout, so a live device always gets the current version and a
   dead connection still opens the app.
   ============================================================ */

const CACHE_VERSION = 'v3';
const CACHE = `comic-checklist-${CACHE_VERSION}`;
const TIMEOUT = 2500;

const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/fx.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Network, but never hang on it — fall back to whatever is cached. */
async function networkFirst(request) {
  const cached = await caches.match(request);
  try {
    const fresh = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), TIMEOUT)),
    ]);
    if (fresh && fresh.ok) {
      const copy = fresh.clone();
      caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
    }
    return fresh;
  } catch {
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw new Error('offline and not cached');
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Google Fonts and anything else off-origin can look after itself; the
  // stylesheet has real fallback faces.
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});
