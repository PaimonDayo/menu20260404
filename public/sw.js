const CACHE_NAME = 'tf-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // 基本的にはネットワークを取りに行き、失敗したらキャッシュを返す (Network First)
  // スプレッドシートの取得なども含むため、常にオンラインからは最新をつかむようにする
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
