/* Service Worker - Sistem Asrama SMP GA
   Strategi:
   - App shell (halaman utama, manifest, ikon) di-cache saat install.
   - Navigasi: network-first, fallback ke cache saat offline.
   - Aset CDN (font, css, js library): stale-while-revalidate.
   - Semua request Firebase/Firestore/Storage/WA TIDAK disentuh (langsung ke network)
     agar data realtime & transaksi tidak terganggu. */

const CACHE_VERSION = 'asrama-v1';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png'
];

// Domain yang TIDAK boleh di-intercept (data realtime / API)
const BYPASS = [
  'firestore.googleapis.com',
  'firebasestorage.googleapis.com',
  'firebasestorage.app',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebasedatabase.app',
  'www.googleapis.com',
  'wa.me',
  'api.whatsapp.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // hanya GET

  const url = new URL(req.url);
  if (BYPASS.some((d) => url.hostname.includes(d))) return; // biarkan Firebase lewat langsung

  // Navigasi halaman: network-first agar selalu dapat versi terbaru, fallback offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Aset statis (same-origin & CDN): stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
