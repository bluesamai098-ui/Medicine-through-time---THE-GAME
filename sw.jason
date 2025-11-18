const CACHE = "mtt-cache-v1";
const FILES = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/questions.json"
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', evt => {
  // network-first for dynamic fetch; fallback to cache
  if (evt.request.method !== 'GET') return;
  evt.respondWith(
    fetch(evt.request).then(r => {
      // update cache
      caches.open(CACHE).then(c => c.put(evt.request, r.clone()));
      return r;
    }).catch(_ => caches.match(evt.request).then(res => res || caches.match('/index.html')))
  );
});
