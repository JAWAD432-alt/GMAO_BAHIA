const CACHE_NAME = 'gmao-pro-v2';
const urlsToCache = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => { if (e.request.url.includes('script.google.com')) return; e.respondWith(fetch(e.request).then(r => { const rc = r.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, rc)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))); });
