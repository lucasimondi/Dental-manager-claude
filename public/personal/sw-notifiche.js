// POL-VITA-018 — service worker di Poliedron Personal solo per le notifiche (promemoria).
// Non gestisce le richieste di rete: niente cache, l'app resta com'è.
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
