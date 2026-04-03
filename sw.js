// =============================================================================
// NoAdsSports — Service Worker
// Caching, push notifications, offline support
// =============================================================================

const CACHE_NAME = 'noadssports-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js'
];

// --- Install: cache static assets, skip waiting -----------------------------

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// --- Activate: clean old caches, claim clients ------------------------------

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// --- Fetch: network-first with cache fallback (same-origin GET only) --------

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only cache same-origin GET requests
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        fetch(request)
            .then(response => {
                // Clone and cache the successful response
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                return response;
            })
            .catch(() => caches.match(request))
    );
});

// --- Push: show notification from server payload ----------------------------

self.addEventListener('push', (event) => {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'NoAdsSports', body: event.data.text() };
        }
    }

    const title = data.title || 'NoAdsSports';
    const options = {
        body: data.body || '',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">\uD83C\uDFC8</text></svg>',
        tag: data.type || 'general',
        renotify: true,
        data: data
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// --- Notification click: focus or open tab ----------------------------------

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                // Focus an existing tab if one is open
                for (const client of clients) {
                    if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open a new tab
                return self.clients.openWindow('/');
            })
    );
});
