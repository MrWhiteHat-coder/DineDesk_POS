/* DineDesk service worker — offline-first app shell.
 *
 * Strategy:
 *  - Navigations (HTML): network-first, fall back to cached index.html so the
 *    app still boots when the restaurant wifi drops mid-service.
 *  - /static/* build assets: cache-first (hashed filenames — safe forever).
 *  - GET /api/*: network-first with a runtime cache so menus, tables and
 *    dashboard data stay readable offline. Mutable data is always refreshed
 *    from the network when online.
 *  - Non-GET API calls: straight to the network — offline writes are handled
 *    by the app layer (IndexedDB order queue), not the SW.
 */
const VERSION = 'v1';
const SHELL_CACHE = `dinedesk-shell-${VERSION}`;
const STATIC_CACHE = `dinedesk-static-${VERSION}`;
const API_CACHE = `dinedesk-api-${VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, STATIC_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // offline writes handled in app layer

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, cached shell as offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Hashed build assets: cache-first.
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // API GETs: network-first with runtime cache for offline reads.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(API_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
