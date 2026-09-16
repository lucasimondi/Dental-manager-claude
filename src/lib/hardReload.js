// POL-UI-040 follow-up: a plain window.location.reload() was not enough —
// the Product Owner still hit the "Qualcosa è andato storto" error screen
// (RouteErrorBoundary) right after the automatic retry-reload should have
// fixed a stale chunk. Root cause: this app's own service worker
// (vite-plugin-pwa, generateSW mode) precaches every built JS/CSS/HTML
// file and, once active, intercepts fetches for those URLs itself —
// including the reload's own request for index.html and for the failing
// chunk. If the ACTIVE service worker is still the OLD one (e.g. it
// hasn't finished installing/activating the newest version yet, or the
// new deploy already dropped a chunk the old precache never had), a plain
// reload can be served entirely from that same stale cache, over and
// over, without ever reaching the network — so retrying via reload alone
// can never break out of the loop.
//
// hardReload() unregisters every service worker registration and deletes
// every Cache Storage entry for this origin BEFORE reloading, so the
// reload's requests are guaranteed to go to the network instead of a
// stale cache. Both the automatic retry in lazyWithRetry.js and the
// manual "Ricarica" button in RouteErrorBoundary.jsx go through this same
// helper, so a manual retap after the automatic one has just as good a
// chance of actually fixing it.
export async function hardReload() {
  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistrations) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Best-effort — an unregister failure must never block the reload itself.
  }
  try {
    if (typeof caches !== 'undefined' && caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Best-effort — same reasoning.
  }
  window.location.reload();
}
