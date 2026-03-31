
const CACHE = 'dare-final-shell-v1';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.json'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e=>{ e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).catch(()=> caches.match('/index.html')))); });
