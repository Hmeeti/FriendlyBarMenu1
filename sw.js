/* Friendly menu service worker. __BUILD__ is replaced by scripts/build-site.mjs. */
const VERSION = '__BUILD__';
const SHELL = `fm-shell-${VERSION}`;
const PHOTOS = 'fm-photos-v1';
const MAX_PHOTOS = 260;
const PHOTO_REVALIDATE_MS = 3 * 864e5;
const SCOPE = new URL(self.registration.scope);
const scoped = (path) => new URL(path, SCOPE).href;

const PRECACHE = [
  './',
  `menu.css?v=${VERSION}`,
  `app.js?v=${VERSION}`,
  `i18n.js?v=${VERSION}`,
  'menu.json',
  'manifest.webmanifest',
  'fonts/cormorant-600-cyrillic.woff2',
  'fonts/cormorant-600-latin.woff2',
  'fonts/great-vibes-logo.woff2',
  'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(scoped(p), { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fm-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function notify(message) {
  return self.clients.matchAll({ type: 'window' }).then((clients) => clients.forEach((c) => c.postMessage(message)));
}

/** Navigations: cached page instantly, refreshed in the background. */
async function pageStaleWhileRevalidate(event) {
  const cache = await caches.open(SHELL);
  const key = scoped('./');
  const cached = await cache.match(key);
  const network = fetch(event.request)
    .then((res) => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** menu.json: stale-while-revalidate; tell open pages when the background copy changed. */
async function menuStaleWhileRevalidate(event) {
  const cache = await caches.open(SHELL);
  const key = scoped('menu.json');
  const cached = await cache.match(key);
  const network = fetch(key, { cache: 'no-cache' })
    .then(async (res) => {
      if (!res.ok) return res;
      const fresh = await res.clone().text();
      const old = cached ? await cached.clone().text() : null;
      await cache.put(key, res.clone());
      if (old !== null && old !== fresh) await notify({ type: 'menu-updated' });
      return res;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
}

/**
 * CSS/JS/fonts/icons. Versioned URLs from a stamped build never change, so they are cache-first.
 * Without a build (Pages serving the branch as is) URLs stay the same between releases,
 * so serve the cached copy but refresh it in the background.
 */
async function shellAsset(event, url) {
  const { request } = event;
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const immutable = VERSION.indexOf('BUILD') === -1 && (url.searchParams.has('v') || url.pathname.endsWith('.woff2'));
  if (cached && immutable) return cached;
  const network = fetch(request, cached ? { cache: 'no-cache' } : undefined)
    .then((res) => {
      if (res.ok) return cache.put(request, res.clone()).then(() => res);
      return res;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
}

async function trimPhotos(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PHOTOS; i++) await cache.delete(keys[i]);
}

async function storePhoto(cache, request, res) {
  const headers = new Headers(res.headers);
  headers.set('sw-cached-at', String(Date.now()));
  const body = await res.blob();
  await cache.put(request, new Response(body, { status: res.status, statusText: res.statusText, headers }));
  await trimPhotos(cache);
}

/** Photos: cache-first; entries older than a few days refresh quietly in the background. */
async function photoCacheFirst(event) {
  const cache = await caches.open(PHOTOS);
  const cached = await cache.match(event.request);
  if (cached) {
    const age = Date.now() - Number(cached.headers.get('sw-cached-at') || 0);
    if (age > PHOTO_REVALIDATE_MS) {
      event.waitUntil(
        fetch(event.request, { cache: 'no-cache' })
          .then((res) => (res.ok ? storePhoto(cache, event.request, res) : null))
          .catch(() => null),
      );
    }
    return cached;
  }
  const res = await fetch(event.request);
  if (res.ok) event.waitUntil(storePhoto(cache, event.request, res.clone()));
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const path = url.pathname.slice(SCOPE.pathname.length);

  if (request.mode === 'navigate') {
    if (path === '' || path === 'index.html') event.respondWith(pageStaleWhileRevalidate(event));
    return;
  }
  if (path.startsWith('admin') || path === 'config.js' || path === 'sw.js') return;
  if (path === 'menu.json') {
    event.respondWith(menuStaleWhileRevalidate(event));
    return;
  }
  if (path.startsWith('image/')) {
    event.respondWith(photoCacheFirst(event));
    return;
  }
  if (/\.(css|js|woff2|png|webmanifest)$/.test(path)) event.respondWith(shellAsset(event, url));
});
