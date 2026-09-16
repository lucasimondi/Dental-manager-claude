import { lazy } from 'react';
import { hardReload } from './hardReload.js';

// POL-UI-040: Product Owner, right after a same-day round of deploys —
// "Ora però non carica il popup mi va in caricamento" — persisted even
// after a full close-and-reopen of the PWA. Every route component in
// App.jsx is `lazy(() => import(...))`, rendered inside ONE
// `<Suspense fallback={<LoadingScreen />}>` with no error boundary
// anywhere above it. A dynamic import() can reject for reasons that have
// nothing to do with the component's own code — a service-worker-cached
// index.html/manifest still pointing at a chunk hash a newer deploy no
// longer serves, a chunk evicted from the CDN, a transient network blip
// right after a deploy — and when it does, Suspense has no resolved
// value and no error handler to fall back to: it stays on the loading
// fallback forever, which reads exactly as "non carica, va in
// caricamento" and survives a normal reopen because the browser's own
// module cache / service worker cache is what's stale, not the app's
// in-memory state.
//
// `lazyWithRetry` wraps a dynamic import factory so a rejected import is
// retried exactly once via `hardReload()` (see hardReload.js) — not just a
// bare page reload, which turned out not to be enough on its own: this
// app's service worker can intercept even the reload's own requests and
// serve the same stale cache again. `hardReload()` clears the service
// worker + Cache Storage first, guaranteeing the reload actually reaches
// the network. A `sessionStorage` flag keyed by chunk name prevents a
// reload loop if the failure is NOT transient (e.g. the chunk is
// genuinely missing) — the second failure is left to reject for real, so
// the error boundary around Suspense (see RouteErrorBoundary.jsx) can
// show a real, recoverable error message instead of an infinite spinner.
// Exported separately so it can be exercised directly in tests without
// going through React's lazy()/Suspense machinery.
export async function importWithRetry(factory, chunkName) {
  try {
    return await factory();
  } catch (error) {
    const retryKey = `pol_lazy_retry_${chunkName}`;
    let alreadyRetried = false;
    try {
      alreadyRetried = sessionStorage.getItem(retryKey) === '1';
    } catch {
      // sessionStorage can throw in private/locked-down browsing — treat as "not yet retried".
    }
    if (alreadyRetried) {
      throw error;
    }
    try {
      sessionStorage.setItem(retryKey, '1');
    } catch {
      // Best-effort only — if we can't persist the flag, worst case we retry every time.
    }
    await hardReload();
    // The reload replaces this page before this promise would ever need to settle.
    return new Promise(() => {});
  }
}

export function lazyWithRetry(factory, chunkName) {
  return lazy(() => importWithRetry(factory, chunkName));
}
