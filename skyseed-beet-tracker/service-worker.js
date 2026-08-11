// Skyseed Beet-Tracker · Service Worker
// Strategie:
//   - Statische Assets (HTML, Icons, Manifest, Fonts): cache-first
//   - API-Calls (script.google.com): network-only (nie cachen)
//   - Offline-Fallback: gecachte Version der Seite + letzte bekannte Daten

// Bei jeder Änderung an den Dateien unter STATIC_CACHE hochzählen, sonst
// behalten installierte Geräte die alte Version im Cache.
const CACHE_VERSION = 'skyseed-beet-v2';
const STATIC_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// Font-Dateien von Google Fonts werden beim ersten Request gecached (runtime cache)
const FONT_CACHE = 'fonts-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_VERSION && k !== FONT_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Apps-Script-API: immer direkt ans Netz, nie cachen
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
    return; // default network handling
  }

  // QR-API: ebenfalls passthrough
  if (url.hostname === 'api.qrserver.com') {
    return;
  }

  // Google Fonts: cache-first mit runtime cache
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // Alles andere (unsere Assets): cache-first, fallback zum Netz
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          // Im Hintergrund aktualisieren
          fetch(event.request).then(response => {
            if (response.ok) {
              caches.open(CACHE_VERSION).then(cache => cache.put(event.request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
          }
          return response;
        }).catch(() => {
          // Offline und nichts im Cache - liefere index.html als Fallback
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});

// Message Handler fuer manuelle Cache-Invalidierung
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
