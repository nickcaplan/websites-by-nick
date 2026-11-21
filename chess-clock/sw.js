/* Offline support for the chess clock. Only the clock's own resources are
   cached (an explicit allowlist); everything else goes straight to the
   network. Online, the network copy wins and refreshes the cache; offline,
   navigations fall back to the cached page. */
'use strict';

var CACHE = 'chess-clock-v3';
var ALLOWED = ['/chess-clock', '/chess-clock/index.html', '/chess-clock/sw.js'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.add('/chess-clock/'); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          // Drop every older clock cache, including the test-clock era.
          if (key !== CACHE && (/^chess-clock-/.test(key) || /^test-clock-/.test(key))) {
            return caches.delete(key);
          }
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  var path = url.pathname.replace(/\/+$/, '');
  if (ALLOWED.indexOf(path) === -1) return;
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
        // Only page loads get the cached HTML; other requests match their own entry.
        if (event.request.mode === 'navigate') return caches.match('/chess-clock/');
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
