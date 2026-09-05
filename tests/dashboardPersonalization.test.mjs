import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HOME_WIDGET_REGISTRY, createDefaultHomeLayout, getHomeWidget, moveHomeWidget,
  normalizeHomeLayout, setHomeWidgetSize, setHomeWidgetVisibility,
} from '../src/lib/homeWidgetRegistry.js';
import { loadUserHomeLayout, saveUserHomeLayout } from '../src/lib/homeLayoutPersistence.js';

/* POL-UI-013 §23 — the Product Owner's explicit test list for the
   Dashboard modular workspace / personalization fix. Where a fact is
   about component behavior (this repo has no React rendering harness —
   `npm test` is plain `node --test`, see package.json) it is verified at
   the source level, the same pattern already used by
   tests/archivioDocsResponsive.test.mjs and the "desktop and mobile
   previews..." test in tests/homeWidgetRegistry.test.mjs. */

const dashboardSrc = await readFile(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const workspaceSrc = await readFile(new URL('../src/components/WidgetWorkspace.jsx', import.meta.url), 'utf8');
const workspaceCss = await readFile(new URL('../src/components/WidgetWorkspace.css', import.meta.url), 'utf8');
const premiumCss = await readFile(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');

/* POL-UI-015 round 3: this double used to answer every read with a fixed
   `row` regardless of what had just been written, which let a save be
   called "persisted" without anything ever storing it. `saveUserHomeLayout`
   now READS THE RECORD BACK and refuses to report success unless the
   store really holds it, so the double has to behave like the table it
   stands for: an upsert on the (studio_id,user_id) primary key that later
   reads observe. */
const fakeClient = (row = null, { failLoad = false, failSave = false } = {}) => {
  let stored = row;
  return {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({
        maybeSingle: async () => failLoad
          ? { data: null, error: { message: 'relation "public.user_home_layouts" does not exist', code: '42P01' } }
          : { data: stored, error: null },
      }) }) }),
      upsert: async (payload) => {
        if (failSave) return { error: { message: 'relation "public.user_home_layouts" does not exist', code: '42P01' } };
        stored = { layout: payload.layout };
        return { error: null };
      },
      delete: () => ({ eq: () => ({ eq: async () => { stored = null; return { error: null }; } }) }),
    }),
  };
};

// --- personalization save + reload persistence ---

test('personalization save persists the exact draft layout, and a fresh load round-trips it', async () => {
  const draft = setHomeWidgetVisibility(setHomeWidgetSize(createDefaultHomeLayout(), 'todo', 'wide'), 'richiami', true);
  const client = fakeClient();
  const saved = await saveUserHomeLayout(client, 'studio-a', 'user-a', draft);
  assert.equal(saved.find((w) => w.id === 'todo').size, 'wide');
  assert.equal(saved.find((w) => w.id === 'richiami').visible, true);

  const reloadClient = fakeClient({ layout: saved });
  const reloaded = await loadUserHomeLayout(reloadClient, 'studio-a', 'user-a');
  assert.deepEqual(reloaded, normalizeHomeLayout(saved));
});

// --- widget order persists ---

test('widget order set via drag/move is preserved through save -> load', async () => {
  let layout = moveHomeWidget(createDefaultHomeLayout(), 'todo', 'agenda');
  const orderedIds = layout.map((w) => w.id);
  const client = fakeClient();
  const saved = await saveUserHomeLayout(client, 'studio-a', 'user-a', layout);
  const reloaded = await loadUserHomeLayout(fakeClient({ layout: saved }), 'studio-a', 'user-a');
  assert.deepEqual(reloaded.map((w) => w.id), orderedIds);
});

// --- widget size persists ---

test('widget size set via resize is preserved through save -> load', async () => {
  const layout = setHomeWidgetSize(createDefaultHomeLayout(), 'agenda', 'medium');
  const client = fakeClient();
  const saved = await saveUserHomeLayout(client, 'studio-a', 'user-a', layout);
  const reloaded = await loadUserHomeLayout(fakeClient({ layout: saved }), 'studio-a', 'user-a');
  assert.equal(reloaded.find((w) => w.id === 'agenda').size, 'medium');
});

// --- hidden/visible state persists ---

test('hidden/visible state set via add/remove is preserved through save -> load', async () => {
  const layout = setHomeWidgetVisibility(createDefaultHomeLayout(), 'agenda', false);
  const client = fakeClient();
  const saved = await saveUserHomeLayout(client, 'studio-a', 'user-a', layout);
  const reloaded = await loadUserHomeLayout(fakeClient({ layout: saved }), 'studio-a', 'user-a');
  assert.equal(reloaded.find((w) => w.id === 'agenda').visible, false);
});

// --- invalid widget size falls back safely ---

test('an invalid/unknown persisted size falls back to the widget default, not a crash', () => {
  const layout = normalizeHomeLayout([{ id: 'agenda', visible: true, size: 'gigantic' }]);
  assert.equal(layout[0].size, getHomeWidget('agenda').defaultSize);
});

test('a persisted size no longer in a widget\'s allowed set falls back safely (schema narrowed)', () => {
  // 'richiami' only allows small/medium — 'wide' was never valid for it.
  const layout = normalizeHomeLayout([{ id: 'richiami', visible: true, size: 'wide' }]);
  assert.equal(layout.find((w) => w.id === 'richiami').size, getHomeWidget('richiami').defaultSize);
});

// --- permission-hidden widget remains hidden ---

test('a management_control-gated widget is force-hidden without that permission, even if persisted visible=true', async () => {
  const { applyWidgetPermissions, buildHomePermissions } = await import('../src/lib/homeDashboardModel.js');
  const layout = setHomeWidgetVisibility(createDefaultHomeLayout(), 'statistiche', true);
  const noPermissions = buildHomePermissions({ membership: { stato: 'attivo', capabilities: [] }, features: { controllo_gestione: true }, vertical: 'dentistico' });
  const filtered = applyWidgetPermissions(layout, HOME_WIDGET_REGISTRY, noPermissions);
  assert.equal(filtered.find((w) => w.id === 'statistiche').visible, false);
});

// --- layout config backward compatibility ---

test('a layout persisted before the `config` field existed (no config key at all) still normalizes cleanly', () => {
  const legacy = [{ id: 'agenda', order: 0, visible: true, size: 'wide' }, { id: 'todo', order: 1, visible: true, size: 'medium' }];
  const normalized = normalizeHomeLayout(legacy);
  assert.equal(normalized.length, createDefaultHomeLayout().length);
  assert.equal(normalized[0].id, 'agenda');
  assert.ok(!('config' in normalized[0]));
});

test('a layout persisted with an id no longer in the registry is dropped, not thrown', () => {
  const legacy = [{ id: 'agenda', visible: true, size: 'wide' }, { id: 'retired_widget_id', visible: true, size: 'medium' }];
  assert.doesNotThrow(() => normalizeHomeLayout(legacy));
  assert.ok(!normalizeHomeLayout(legacy).some((w) => w.id === 'retired_widget_id'));
});

test('every registry entry now carries minSize/maxSize derived from its own sizes, in sync by construction', () => {
  for (const widget of HOME_WIDGET_REGISTRY) {
    assert.equal(widget.minSize, widget.sizes[0]);
    assert.equal(widget.maxSize, widget.sizes[widget.sizes.length - 1]);
  }
});

// --- root-cause fix: load failures are visible on the page, not swallowed ---

test('a failed background load rejects (root cause: production tables were never applied remotely — see docs/coordination/handoffs.md POL-UI-001 entries)', async () => {
  const client = fakeClient(null, { failLoad: true });
  await assert.rejects(() => loadUserHomeLayout(client, 'studio-a', 'user-a'));
});

test('Dashboard.jsx keeps load errors in a state separate from the modal-scoped save error, and renders them page-level', () => {
  assert.match(dashboardSrc, /const \[loadError, setLoadError\] = useState/);
  assert.match(dashboardSrc, /data-testid="home-layout-load-error"/);
  assert.match(dashboardSrc, /retryHomeLayoutLoad/);
});

test('openHomeCustomizer does not clear the page-level load error on open (only the modal-scoped save error)', () => {
  const openFn = dashboardSrc.slice(dashboardSrc.indexOf('const openHomeCustomizer'), dashboardSrc.indexOf('const openHomeCustomizer') + 600);
  assert.match(openFn, /setLayoutError\(''\)/);
  assert.doesNotMatch(openFn, /setLoadError/);
});

// --- Poliedron naming/centrality ---

test('POL-UI-025: "consigli_ai" was deliberately removed from the Home registry (moved to the dedicated Poliedron page) — normalizeHomeLayout already drops unknown ids gracefully, so this is a safe removal, not a stale reference', () => {
  assert.equal(getHomeWidget('consigli_ai'), null);
  const layout = normalizeHomeLayout([{ id: 'consigli_ai', visible: true, size: 'medium' }, { id: 'agenda', visible: true, size: 'wide' }]);
  assert.ok(!layout.some((item) => item.id === 'consigli_ai'));
});

test('no generic "Consigli AI" wording remains anywhere in Dashboard.jsx or its stylesheet', () => {
  assert.doesNotMatch(dashboardSrc, /Consigli AI/);
  assert.doesNotMatch(premiumCss, /Consigli AI/);
});

test('the rendered Consigli Poliedron widget uses the dedicated premium surface + the real Poliedron gem asset', () => {
  assert.match(dashboardSrc, /className="home-poliedron-widget"/);
  assert.match(dashboardSrc, /poliedroGem/);
  assert.match(dashboardSrc, /import poliedroGem from '\.\.\/assets\/icon-poliedra-gem\.png'/);
  assert.match(premiumCss, /\.home-poliedron-widget\s*\{/);
  assert.match(premiumCss, /var\(--pol-indigo-500\)/);
});

test('Consigli Poliedron stays contained in a narrow mobile widget frame', () => {
  assert.match(premiumCss, /\.home-poliedron-widget\s*\{[^}]*box-sizing:\s*border-box/s);
  assert.match(premiumCss, /\.home-poliedron-widget\s*\{[^}]*max-width:\s*100%/s);
  assert.match(premiumCss, /\.home-poliedron-widget__title\s*>\s*div\s*\{[^}]*min-width:\s*0/s);
  assert.match(premiumCss, /\.home-poliedron-widget__heading\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});

// --- drag & drop is touch-compatible ---

test('WidgetWorkspace supports pointer-based (touch-compatible) reordering alongside native HTML5 drag', () => {
  assert.match(workspaceSrc, /onPointerDown/);
  assert.match(workspaceSrc, /elementFromPoint/);
  assert.match(workspaceSrc, /draggable=\{editing\}/); // native mouse DnD kept, not replaced
  assert.match(workspaceCss, /touch-action:\s*none/);
});

// --- widget size modes are small/medium/large, exposed via the existing S/M/L control ---

test('the resize control exposes small/medium/large as accessible, labeled options (not developer-style raw values)', () => {
  assert.match(workspaceSrc, /aria-label=\{`\$\{widget\.label\}: dimensione \$\{size === 'small' \? 'piccola' : size === 'medium' \? 'media' : 'grande'\}`\}/);
  assert.match(workspaceSrc, /aria-pressed=\{item\.size === size\}/);
});
