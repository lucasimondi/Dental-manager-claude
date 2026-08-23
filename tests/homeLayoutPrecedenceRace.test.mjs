import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDefaultHomeLayout } from '../src/lib/homeWidgetRegistry.js';
import { resolveHomeLayout, loadResolvedHomeLayout, saveUserHomeLayout } from '../src/lib/homeLayoutPersistence.js';
import { logHomeLayoutEvent } from '../src/lib/homeLayoutDiagnostics.js';

/* POL-UI-013C — root-cause investigation into "Personalizza Home ->
   change layout -> Save -> appears not to persist". The underlying
   persistence primitives (registry normalize/move/resize + Supabase
   load/save) were already covered by tests/dashboardPersonalization
   .test.mjs and tests/homeWidgetRegistry.test.mjs and are NOT the bug —
   this file covers the two gaps identified by the deeper audit: full
   user/studio/role/default precedence through the real async load path
   (not just the pure resolver), and the confirmed state-race root cause
   in Dashboard.jsx's background load effect silently overwriting an
   in-progress "Personalizza Home" edit. */

const dashboardSrc = await readFile(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');

const fakeClient = ({ userRow = null, studioRow = null } = {}) => ({
  from: (table) => ({
    select: () => ({ eq: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: table === 'user_home_layouts' ? userRow : null, error: null }),
    }), maybeSingle: async () => ({ data: table === 'studio_home_layouts' ? studioRow : null, error: null }) }) }),
  }),
});

// --- 3. USER VS STUDIO PRECEDENCE (test matrix A-D, through the real async path) ---

test('A. user layout only -> loads user, through the real async loadResolvedHomeLayout path', async () => {
  const userLayout = createDefaultHomeLayout().map((w) => w.id === 'todo' ? { ...w, size: 'wide' } : w);
  const client = fakeClient({ userRow: { layout: userLayout } });
  const { layout, source } = await loadResolvedHomeLayout(client, 'studio-a', 'user-a');
  assert.equal(source, 'user');
  assert.equal(layout.find((w) => w.id === 'todo').size, 'wide');
});

test('B. studio layout only -> loads studio, through the real async loadResolvedHomeLayout path', async () => {
  const studioLayout = createDefaultHomeLayout().map((w) => w.id === 'agenda' ? { ...w, visible: false } : w);
  const client = fakeClient({ studioRow: { layout: studioLayout } });
  const { layout, source } = await loadResolvedHomeLayout(client, 'studio-a', 'user-a');
  assert.equal(source, 'studio');
  assert.equal(layout.find((w) => w.id === 'agenda').visible, false);
});

test('C. both user and studio layouts exist -> user wins, never silently overwritten by studio', async () => {
  const userLayout = createDefaultHomeLayout().map((w) => w.id === 'todo' ? { ...w, size: 'wide' } : w);
  const studioLayout = createDefaultHomeLayout().map((w) => w.id === 'todo' ? { ...w, size: 'medium' } : w);
  const client = fakeClient({ userRow: { layout: userLayout }, studioRow: { layout: studioLayout } });
  const { layout, source } = await loadResolvedHomeLayout(client, 'studio-a', 'user-a');
  assert.equal(source, 'user');
  assert.equal(layout.find((w) => w.id === 'todo').size, 'wide');
});

test('D. neither user nor studio layout exists, but a role preset is provided -> role wins over platform default', () => {
  const roleLayout = createDefaultHomeLayout().map((w) => ({ ...w, visible: w.id === 'agenda' }));
  const resolved = resolveHomeLayout({ userLayout: null, studioLayout: null, roleLayout });
  assert.equal(resolved.source, 'role');
  assert.equal(resolved.layout.find((w) => w.id === 'agenda').visible, true);
});

test('D2. neither user, studio, nor role layout exists -> platform default', () => {
  const resolved = resolveHomeLayout({ userLayout: null, studioLayout: null, roleLayout: null });
  assert.equal(resolved.source, 'platform');
  assert.deepEqual(resolved.layout, createDefaultHomeLayout());
});

// --- 6. STATE RACE CONDITIONS (root cause) ---

test('ROOT CAUSE: the background load effect no longer resets draftWidgets/draftInherits, so it cannot silently discard an in-progress "Personalizza Home" edit', () => {
  const effectStart = dashboardSrc.indexOf('logHomeLayoutEvent(\'HOME_LAYOUT_LOAD_START\')');
  const effectEnd = dashboardSrc.indexOf('}, [studioId, userId,');
  assert.ok(effectStart > -1 && effectEnd > effectStart, 'expected to locate the Home layout load effect');
  const effectBody = dashboardSrc.slice(effectStart, effectEnd);
  // Strip `//` line comments before asserting absence — the fix is
  // explained in a comment that necessarily *names* the calls it removed,
  // so a plain substring/regex check must only look at real code.
  const effectCode = effectBody.split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '')).join('\n');
  // Must still keep `widgets` (the committed, non-editing state) in sync.
  assert.match(effectCode, /setWidgets\(layout\)/);
  // Must NOT touch draftWidgets/draftInherits — those are modal-scoped
  // and openHomeCustomizer already re-derives them fresh from `widgets`
  // every time the modal opens (see openHomeCustomizer below).
  assert.doesNotMatch(effectCode, /setDraftWidgets/);
  assert.doesNotMatch(effectCode, /setDraftInherits/);
});

test('openHomeCustomizer re-derives draftWidgets/draftInherits fresh from the committed widgets every time the modal opens', () => {
  const openStart = dashboardSrc.indexOf('const openHomeCustomizer');
  const openBody = dashboardSrc.slice(openStart, openStart + 400);
  assert.match(openBody, /setDraftWidgets\(widgets\.map/);
  assert.match(openBody, /setDraftInherits\(layoutSource !== 'user'\)/);
});

// --- 5. VERIFY SAVE SUCCESS IS REAL (reset-to-inherit partial-failure path) ---

test('a failed reload after a successful reset-to-inherit delete does not claim "no changes were applied" (the delete already happened)', () => {
  const saveStart = dashboardSrc.indexOf('const saveHomeCustomization');
  const saveEnd = dashboardSrc.indexOf('const resetHomeCustomization');
  const saveBody = dashboardSrc.slice(saveStart, saveEnd);
  assert.match(saveBody, /await deleteUserHomeLayout/);
  // The reload after delete must be wrapped in its own try/catch that
  // falls back to the already-known inherited layout, not the outer
  // catch's generic "Salvataggio non riuscito" message.
  const deleteIdx = saveBody.indexOf('deleteUserHomeLayout');
  const innerCatchIdx = saveBody.indexOf('catch {', deleteIdx);
  const outerCatchIdx = saveBody.lastIndexOf('catch {');
  assert.ok(innerCatchIdx > -1 && innerCatchIdx < outerCatchIdx, 'expected an inner catch around the post-delete reload, separate from the outer save catch');
});

// --- 9J. save error is visible ---

test('J. save error sets layoutError, rendered as an alert inside the still-open modal', () => {
  assert.match(dashboardSrc, /catch \{\s*setLayoutError\('Salvataggio non riuscito\. Nessuna modifica è stata applicata\.'\);/);
  assert.match(dashboardSrc, /\{layoutError && <div role="alert"/);
});

// --- 8. INSTRUMENTATION (dev-only diagnostics) ---

test('dev-only diagnostic events are wired at every stage of load and save', () => {
  for (const event of [
    'HOME_LAYOUT_LOAD_START', 'HOME_LAYOUT_LOAD_SOURCE', 'HOME_LAYOUT_LOAD_SUCCESS',
    'HOME_LAYOUT_SAVE_START', 'HOME_LAYOUT_SAVE_SUCCESS', 'HOME_LAYOUT_SAVE_ERROR',
    'HOME_LAYOUT_NORMALIZED',
  ]) {
    assert.ok(dashboardSrc.includes(event), `expected ${event} to be logged from Dashboard.jsx`);
  }
});

test('logHomeLayoutEvent is inert (no throw, no side effect) outside a Vite dev build, e.g. under plain Node/test', () => {
  assert.doesNotThrow(() => logHomeLayoutEvent('HOME_LAYOUT_LOAD_START'));
  assert.doesNotThrow(() => logHomeLayoutEvent('HOME_LAYOUT_LOAD_SOURCE', 'user'));
});

test('diagnostics are gated on import.meta.env.DEV, not always-on, so production users never see internals', async () => {
  const diagnosticsSrc = await readFile(new URL('../src/lib/homeLayoutDiagnostics.js', import.meta.url), 'utf8');
  assert.match(diagnosticsSrc, /import\.meta\.env\?\.DEV/);
});

// --- E/F: save then reload keeps the exact resolved source, via the real async path ---

test('E/F. save user layout, then reload through the real async path, returns the same normalized order/size/visibility', async () => {
  let stored = null;
  const client = {
    from: (table) => ({
      select: () => ({ eq: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: table === 'user_home_layouts' ? stored : null, error: null }) }),
        maybeSingle: async () => ({ data: table === 'user_home_layouts' ? stored : null, error: null }),
      }) }),
      upsert: async (payload) => { stored = { layout: payload.layout }; return { error: null }; },
    }),
  };
  const draft = createDefaultHomeLayout().map((w) => w.id === 'richiami' ? { ...w, visible: true, size: 'medium' } : w);
  await saveUserHomeLayout(client, 'studio-a', 'user-a', draft);
  const { layout, source } = await loadResolvedHomeLayout(client, 'studio-a', 'user-a');
  assert.equal(source, 'user');
  const richiami = layout.find((w) => w.id === 'richiami');
  assert.equal(richiami.visible, true);
  assert.equal(richiami.size, 'medium');
});
