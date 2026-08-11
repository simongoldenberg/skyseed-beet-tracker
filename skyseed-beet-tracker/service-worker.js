// Skyseed Beet-Tracker · Service Worker
// - Statische Assets: cache-first
// - Apps-Script-API: network-only (nie cachen)
// - Bei Offline: letzte bekannte Daten zeigen
// - Cache-Version bei jedem Update bumpen, damit alte HTML weicht!

const CACHE_VERSION = 'skyseed-beet-v4';
const STATIC_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];
const FONT_CACHE = 'beet-fonts-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(c => c.addAll(STATIC_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION && k !== FONT_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Apps-Script-API: niemals cachen, immer Netzwerk
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({error:'offline'}), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Drive-Foto-Thumbnails: stale-while-revalidate (zeigt Cache + holt frisch im Hintergrund)
  if (url.hostname === 'drive.google.com' || url.hostname === 'lh3.googleusercontent.com') {
    event.respondWith(
      caches.open('beet-fotos-v1').then(cache =>
        cache.match(event.request).then(cached => {
          const fresh = fetch(event.request).then(r => { if (r.ok) cache.put(event.request, r.clone()); return r; }).catch(() => cached);
          return cached || fresh;
        })
      )
    );
    return;
  }

  // Google Fonts: cache-first (immutable)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(cached => cached || fetch(event.request).then(r => {
          if (r.ok) cache.put(event.request, r.clone());
          return r;
        }))
      )
    );
    return;
  }

  // Statische Assets: cache-first mit Netzwerk-Fallback
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(r => {
      if (r.ok && event.request.method === 'GET') {
        const copy = r.clone();
        caches.open(CACHE_VERSION).then(c => c.put(event.request, copy));
      }
      return r;
    }).catch(() => caches.match('./index.html')))
  );
});

// Message Handler fuer manuelle Cache-Invalidierung
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
