const CACHE_NAME = 'heyplace-v20260629.2';

const CORE_FILES = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './version.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png',
];

// Install: cache all core files
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES))
    );
});

// Activate: delete old caches immediately
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch: network first for version.json (always fresh), cache first for everything else
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Always fetch version.json fresh so update checks work
    if (url.pathname.endsWith('version.json')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // For external resources (tiles, Nominatim, CDN) — network only, no caching
    if (url.origin !== self.location.origin) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Cache first, fall back to network, then update cache in background
    event.respondWith(
        caches.match(event.request).then(cached => {
            const networkFetch = fetch(event.request).then(response => {
                if (response.ok) {
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
                }
                return response;
            });
            return cached || networkFetch;
        })
    );
});
