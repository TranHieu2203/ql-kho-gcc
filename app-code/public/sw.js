// Service worker — basic offline-capable shell cache.
// Full sync queue (Dexie + Background Sync) sẽ làm ở sprint sau theo ARCHITECTURE §6.

const CACHE_VERSION = 'v2';
const APP_SHELL_CACHE = `ql-kho-shell-${CACHE_VERSION}`;
const APP_DATA_CACHE = `ql-kho-data-${CACHE_VERSION}`;

const APP_SHELL = ['/offline', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_SHELL_CACHE && k !== APP_DATA_CACHE && k.startsWith('ql-kho-'))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never cache mutations
  const url = new URL(req.url);

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // M3 SECURITY: API responses are per-user (auth-scoped). KHÔNG cache để tránh
  // user B vô tình thấy response cached của user A trên cùng device (shared PC kho).
  // Để SW không can thiệp: return luôn, browser sẽ fetch network bình thường.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML / pages: network-first with 3s timeout, fallback to cache, then /offline
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(req, { signal: controller.signal });
          clearTimeout(timeout);
          if (res.ok) {
            const cache = await caches.open(APP_SHELL_CACHE);
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          return caches.match('/offline') || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, res.clone())).catch(() => {});
        }
        return res;
      });
    })
  );
});
