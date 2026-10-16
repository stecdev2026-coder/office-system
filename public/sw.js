const CACHE = 'office-shell-v1';
const SHELL = ['/offline.html', '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('office-shell-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never store employee HTML, API responses, auth redirects or React server payloads.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
  } else if (SHELL.includes(url.pathname) || url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) { const cache = await caches.open(CACHE); await cache.put(event.request, response.clone()); }
      return response;
    })());
  }
});
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Office System', {
    body: data.body || 'คุณมีการแจ้งเตือนใหม่', icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png',
    data: { url: data.url || '/notifications' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    let url = new URL(event.notification.data?.url || '/notifications', self.location.origin);
    if (url.origin !== self.location.origin) url = new URL('/notifications', self.location.origin);
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      if ('focus' in client) { await client.navigate(url.href); return client.focus(); }
    }
    return self.clients.openWindow(url.href);
  })());
});
