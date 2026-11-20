/* Offline support for the chess clock. Everything the page needs is
   same-origin and static: serve the network copy when online and keep it as
   the fallback for reloads without a connection. */
'use strict';

var CACHE = 'test-clock-v1';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.add('./'); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      })
      .catch(function () {
        return caches.match(event.request, { ignoreSearch: true }).then(function (hit) {
          return hit || caches.match('./');
        });
      })
  );
});
