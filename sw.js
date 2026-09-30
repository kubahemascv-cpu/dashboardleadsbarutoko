// SW Dashboard Manager New Leads
const CACHE = 'dashboard-newleads-v4';

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(['./', 'manifest.json', 'icon-192.png', 'icon-512.png']).catch(function () {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
      .then(function () {
        return self.clients.matchAll({ type: 'window' }).then(function (clientsList) {
          clientsList.forEach(function (client) { client.navigate(client.url); });
        });
      })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;

  // Data live ke Apps Script: selalu langsung ke internet, jangan
  // pernah di-cache, biar dashboard selalu nampilin angka terbaru.
  if (/docs\.google\.com|googleapis\.com|script\.google\.com/.test(e.request.url)) {
    e.respondWith(fetch(e.request));
    return;
  }

  // HTML/halaman utama: NETWORK-FIRST. Ini benerin masalah "harus hard
  // refresh baru update kelihatan" — kalau cache-first, begitu ke-cache
  // sekali, browser puas ambil dari situ terus, gak pernah ngecek versi
  // baru. Refresh biasa sekarang selalu coba internet dulu (asal
  // online), baru fallback ke cache kalau offline.
  var isHTML = e.request.mode === 'navigate' || e.request.url.endsWith('.html') || e.request.url.endsWith('/');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.status === 200) {
          caches.open(CACHE).then(function (c) { c.put(e.request, res.clone()); });
        }
        return res;
      }).catch(function () {
        return caches.match(e.request);
      })
    );
    return;
  }

  // File statis lain (icon, manifest): cache-first tetap OK, jarang berubah.
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(e.request).then(function (r) {
        return r || fetch(e.request).then(function (res) {
          if (res && res.status === 200) c.put(e.request, res.clone());
          return res;
        }).catch(function () { return r; });
      });
    })
  );
});
