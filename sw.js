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

    // Use team badge if available, otherwise sport-specific icon, otherwise default
    const SPORT_ICONS = {
        'American Football': '/img/notif/football.png',
        'Basketball': '/img/notif/basketball.png',
        'Baseball': '/img/notif/baseball.png',
        'Ice Hockey': '/img/notif/hockey.png',
        'Soccer': '/img/notif/soccer.png',
    };

    let icon = '/img/notif/default.png';
    if (data.badge) {
        // Use team badge — convert TheSportsDB URL to local path
        const teamId = data.badge.match(/\/(\d+)\.png/)?.[1];
        if (teamId) icon = `/img/teams/${teamId}.png`;
        else icon = data.badge; // Use as-is if not a standard format
    } else if (data.sport && SPORT_ICONS[data.sport]) {
        icon = SPORT_ICONS[data.sport];
    }

    const options = {
        body: data.body || '',
        icon: icon,
        badge: '/img/notif/badge.png',
        tag: data.type || 'general',
        renotify: true,
        data: data
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// --- Notification click: focus or open tab ----------------------------------

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Build URL with team key hash so the app can scroll to the right card
    const data = event.notification.data || {};
    const teamKey = data.teamKey || '';
    const url = teamKey ? `/?team=${encodeURIComponent(teamKey)}` : '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                // Focus an existing tab if one is open
                for (const client of clients) {
                    if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
                        client.navigate(url);
                        return client.focus();
                    }
                }
                // Otherwise open a new tab
                return self.clients.openWindow(url);
            })
    );
});
