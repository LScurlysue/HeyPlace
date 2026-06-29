const CACHE_NAME = 'heyplace-v20260629.1';

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

const SHARE_CACHE = 'heyplace-share-target';

// Receive a video shared from another app (e.g. Instagram's share sheet on Android).
// Service workers can't hand data straight to the page, so we stash the file in
// Cache Storage and redirect to index.html, which then picks it up.
async function handleShareTarget(event) {
    const formData = await event.request.formData();
    const file = formData.get('video');
    const cache = await caches.open(SHARE_CACHE);

    if (file && file.size > 0) {
        await cache.put('/shared-video', new Response(file, { headers: { 'Content-Type': file.type || 'video/mp4' } }));
        return Response.redirect('./index.html?shared=1', 303);
    }

    // No video file arrived — Instagram (or whichever app) only sent text/a
    // link. Surface what we actually got so this is debuggable instead of
    // silently doing nothing.
    const debugInfo = {
        title: formData.get('title') || '',
        text: formData.get('text') || '',
        url: formData.get('url') || '',
    };
    await cache.put('/shared-debug', new Response(JSON.stringify(debugInfo)));
    return Response.redirect('./index.html?shared=nofile', 303);
}

// Fetch: network first for version.json (always fresh), cache first for everything else
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.pathname.endsWith('/share-target/')) {
        event.respondWith(handleShareTarget(event));
        return;
    }

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
