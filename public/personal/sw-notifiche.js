// POL-VITA-018 — service worker di Poliedron Personal solo per le notifiche (promemoria).
// Gestisce anche la sola POST esplicita del share target PDF; cache temporanea locale.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { testo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titolo || 'Poliedron', {
    body: d.testo || '',
    icon: '/poliedron-v2-192.png',
    badge: '/poliedron-v2-192.png',
    tag: d.tag || 'promemoria',
    data: { url: d.url || '/personal/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/personal/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
    for (const f of finestre) if (f.url.includes('/personal')) return f.focus();
    return self.clients.openWindow(url);
  }));
});

// Only the explicit share-target POST is handled. No Studio routes or network cache.
const PDF_SHARE_CACHE = 'personal-pdf-incoming-v1';
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (event.request.method !== 'POST' || url.origin !== scope.origin || url.pathname !== scope.pathname || url.searchParams.get('receive-pdf') !== '1') return;
  event.respondWith((async () => {
    const cache = await caches.open(PDF_SHARE_CACHE);
    const id = crypto.randomUUID(), key = new URL(`/personal/pdf-incoming/${id}`, scope.origin).href;
    try {
      const form = await event.request.formData();
      const files = form.getAll('files').filter(f => typeof f !== 'string');
      if (!files.length || files.length > 20 || files.some(f => !f.size || (f.type !== 'application/pdf' && !f.type.startsWith('image/'))) || files.reduce((n,f) => n+f.size,0) > 40*1024*1024) throw new Error('Formato o dimensione non supportati');
      // Remove expired inbox data only; these are temporary local copies, never originals.
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (Number(response.headers.get('X-Personal-Created')) < Date.now() - 86400000) await cache.delete(request);
      }
      const created = Date.now();
      for (let i=0;i<files.length;i++) await cache.put(`${key}/${i}`, new Response(files[i], { headers: { 'Content-Type': files[i].type, 'X-Personal-Created': String(created) } }));
      await cache.put(key, new Response(JSON.stringify({ created, names: files.map(f=>f.name) }), { headers: { 'Content-Type':'application/json', 'X-Personal-Created':String(created) } }));
      return Response.redirect(`${scope.href}?pdf-share=${id}`,303);
    } catch {
      for (const request of await cache.keys()) if (request.url === key || request.url.startsWith(`${key}/`)) await cache.delete(request);
      return Response.redirect(`${scope.href}?pdf-share-error=1`,303);
    }
  })());
});
