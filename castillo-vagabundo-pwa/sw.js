// Service Worker - El Castillo Ambulante
// Rutas relativas para que funcione en GitHub Pages (https://usuario.github.io/repo/)
const VERSION = 'castillo-v10';
const CACHE_ESTATICO = 'estatico-' + VERSION;   // app shell (se precarga)
const CACHE_DINAMICO = 'dinamico-' + VERSION;   // lo demás que se vaya pidiendo

const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './css/animate.css',
    './js/libs/jquery.js',
    './js/app.js',
    './img/favicon.ico',
    './img/icons/apple-touch-icon.png',
    './img/icons/icon-72x72.png',
    './img/icons/icon-96x96.png',
    './img/icons/icon-128x128.png',
    './img/icons/icon-144x144.png',
    './img/icons/icon-152x152.png',
    './img/icons/icon-192x192.png',
    './img/icons/icon-384x384.png',
    './img/icons/icon-512x512.png',
    './img/avatars/howl.jpg',
    './img/avatars/sophie.jpg',
    './img/avatars/calcifer.jpg',
    './img/avatars/markl.jpg',
    './img/avatars/nabo.jpg'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_ESTATICO).then((c) => c.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((k) => k !== CACHE_ESTATICO && k !== CACHE_DINAMICO)
                .map((k) => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

// Estrategia: caché primero; si no está, red y se guarda; si no hay red, index.html
self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || !req.url.startsWith('http')) return;

    const appScript = new URL('./js/app.js', self.registration.scope).href;
    if (req.url === appScript) {
        e.respondWith(
            fetch(new Request(req, { cache: 'reload' })).then((resp) => {
                if (resp && resp.ok) caches.open(CACHE_ESTATICO).then((c) => c.put(req, resp.clone()));
                return resp;
            }).catch(() => caches.match(req))
        );
        return;
    }

    e.respondWith(
        caches.match(req).then((enCache) => {
            if (enCache) return enCache;
            return fetch(req).then((resp) => {
                if (resp && resp.ok) {
                    const copia = resp.clone();
                    caches.open(CACHE_DINAMICO).then((c) => c.put(req, copia));
                }
                return resp;
            }).catch(() => {
                if (req.mode === 'navigate') return caches.match('./index.html');
            });
        })
    );
});

// Notificaciones push recibidas desde el servidor
self.addEventListener('push', (e) => {
    let datos = { title: 'El Castillo Ambulante', body: 'Hay un mensaje nuevo en el castillo' };
    if (e.data) { try { datos = e.data.json(); } catch (_) { datos.body = e.data.text(); } }
    e.waitUntil(self.registration.showNotification(datos.title, {
        body: datos.body,
        icon: './img/icons/icon-192x192.png',
        badge: './img/icons/icon-72x72.png'
    }));
});

// Al tocar la notificación se abre
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
            for (const c of lista) { if ('focus' in c) return c.focus(); }
            return self.clients.openWindow('./index.html');
        })
    );
});
