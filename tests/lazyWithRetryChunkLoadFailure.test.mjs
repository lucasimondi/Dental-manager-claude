import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { importWithRetry } from '../src/lib/lazyWithRetry.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const lazyWithRetrySource = readFileSync(new URL('../src/lib/lazyWithRetry.js', import.meta.url), 'utf8');
const routeErrorBoundarySource = readFileSync(new URL('../src/components/RouteErrorBoundary.jsx', import.meta.url), 'utf8');

// Product Owner, right after a same-day round of deploys: "Ora però non
// carica il popup mi va in caricamento" — persisted even after a full
// close-and-reopen of the PWA (confirmed via a follow-up question). Every
// route component in App.jsx was `lazy(() => import(...))`, rendered
// inside a single `<Suspense fallback={<LoadingScreen />}>` ("Caricamento
// dati…" — matching "va in caricamento" almost verbatim) with NO error
// boundary anywhere above it. A dynamic import() rejecting for any reason
// (stale service-worker-cached manifest after a deploy, a chunk evicted
// from the CDN, a transient network blip) leaves Suspense with nothing to
// resolve to and nothing to catch the rejection — it hangs on the loading
// fallback forever, surviving a normal reopen because the browser's own
// module/service-worker cache is what's stale, not React's in-memory
// state (POL-UI-040).

test('every route-level lazy import goes through lazyWithRetry, not bare React.lazy', () => {
  const routeComponents = [
    'ControlloGestione', 'PoliedronHub', 'FinancialWorkspace', 'Pazienti',
    'PatientWorkspaceBoundary', 'Piani', 'Spese', 'ArchivioDocs', 'Listino',
    'Agenda', 'Richiami', 'Attivita', 'AgenteAISetup', 'WhatsApp', 'Impostazioni',
  ];
  for (const name of routeComponents) {
    const re = new RegExp(`const ${name} = lazyWithRetry\\(\\(\\) => import\\('\\./components/${name}\\.jsx'\\), '${name}'\\)`);
    assert.match(app, re, `${name} must be wrapped in lazyWithRetry with a matching chunk name`);
  }
  assert.doesNotMatch(app, /=\s*lazy\(\(\) => import\(/, 'no route component should still use bare React.lazy');
});

test('lazyWithRetry wraps importWithRetry in React.lazy, keyed by chunk name', () => {
  assert.match(lazyWithRetrySource, /export function lazyWithRetry\(factory, chunkName\)/);
  assert.match(lazyWithRetrySource, /return lazy\(\(\) => importWithRetry\(factory, chunkName\)\);/);
});

test('importWithRetry resolves normally when the import succeeds — no reload, no sessionStorage touched', async () => {
  const originalWindow = globalThis.window;
  const originalSessionStorage = globalThis.sessionStorage;
  let reloadCalled = false;
  globalThis.window = { location: { reload: () => { reloadCalled = true; } } };
  globalThis.sessionStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; } };
  try {
    const module = { default: 'RealComponent' };
    const result = await importWithRetry(async () => module, 'TestChunk');
    assert.equal(result, module);
    assert.equal(reloadCalled, false);
  } finally {
    globalThis.window = originalWindow;
    globalThis.sessionStorage = originalSessionStorage;
  }
});

test('importWithRetry reloads the page exactly once on a failed import, then lets a second failure surface for real', async () => {
  const originalWindow = globalThis.window;
  const originalSessionStorage = globalThis.sessionStorage;
  const store = {};
  let reloadCount = 0;
  globalThis.window = { location: { reload: () => { reloadCount += 1; } } };
  globalThis.sessionStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  try {
    const failingFactory = async () => { throw new Error('Failed to fetch dynamically imported module'); };

    // First failure: reloads once, never rejects (the reload would replace the page for real).
    let firstCallSettled = false;
    importWithRetry(failingFactory, 'Agenda').then(() => { firstCallSettled = true; }, () => { firstCallSettled = true; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(reloadCount, 1, 'the first failure must trigger exactly one reload');
    assert.equal(firstCallSettled, false, 'the promise must never settle after a reload — the navigation replaces the page');
    assert.equal(store['pol_lazy_retry_Agenda'], '1');

    // Second failure (simulating the reload landing on an app that still can't load this chunk):
    // must not reload again, and must surface the real error instead of hanging forever.
    await assert.rejects(() => importWithRetry(failingFactory, 'Agenda'), /Failed to fetch dynamically imported module/);
    assert.equal(reloadCount, 1, 'a second failure for the same chunk must not trigger a second reload');
  } finally {
    globalThis.window = originalWindow;
    globalThis.sessionStorage = originalSessionStorage;
  }
});

test('importWithRetry never throws from a broken sessionStorage (private/locked-down browsing) — still reloads', async () => {
  const originalWindow = globalThis.window;
  const originalSessionStorage = globalThis.sessionStorage;
  let reloadCalled = false;
  globalThis.window = { location: { reload: () => { reloadCalled = true; } } };
  globalThis.sessionStorage = {
    getItem() { throw new Error('SecurityError: sessionStorage blocked'); },
    setItem() { throw new Error('SecurityError: sessionStorage blocked'); },
  };
  try {
    const failingFactory = async () => { throw new Error('chunk load error'); };
    // The reload path never settles (a real reload would replace the page) — don't await it directly.
    importWithRetry(failingFactory, 'Blocked');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(reloadCalled, true, 'a broken sessionStorage must not prevent the reload fallback');
  } finally {
    globalThis.window = originalWindow;
    globalThis.sessionStorage = originalSessionStorage;
  }
});

test('a RouteErrorBoundary now wraps every Suspense boundary that renders a lazyWithRetry-wrapped component, keyed by page so it resets on navigation', () => {
  assert.match(routeErrorBoundarySource, /static getDerivedStateFromError\(\)/);
  assert.match(routeErrorBoundarySource, /componentDidCatch\(error\)/);
  assert.match(routeErrorBoundarySource, /window\.location\.reload\(\)/);

  assert.match(app, /import RouteErrorBoundary from '\.\/components\/RouteErrorBoundary\.jsx'/);
  assert.match(app, /import \{ lazyWithRetry \} from '\.\/lib\/lazyWithRetry\.js'/);

  // The main page-router Suspense (LoadingScreen fallback) — reset per page.
  assert.match(app, /<RouteErrorBoundary key=\{page\}>\s*\n\s*<Suspense fallback=\{<LoadingScreen \/>\}>/);
  // The SchedaPaz patient-card portal Suspense.
  assert.match(app, /<RouteErrorBoundary>\s*\n\s*<Suspense fallback=\{<div role="status"[\s\S]*?>Caricamento scheda paziente…<\/div>\}>/);
});
