const CACHE_NAME = 'mandarin-cache-v1';
const APP_SHELL = [
  '/',
  '/app/index.html',
  '/app/study.html',
  '/app/add.html',
  '/app/settings.html',
  '/app/styles.css',
  '/app.js',
  '/app/manifest.webmanifest',
  '/app/icons/icon-192.svg',
  '/app/icons/icon-512.svg',
  '/data/hsk1.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => cached)
    )
  );
});
