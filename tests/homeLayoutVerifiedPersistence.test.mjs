import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HOME_LAYOUT_MODERN_SENTINEL_ID, HOME_WIDGET_REGISTRY, POL_UI_015_REDEFAULTED_WIDGET_IDS,
  createDefaultHomeLayout, getHomeWidget, isLegacySavedHomeLayout, migrateSavedHomeLayout,
  normalizeHomeLayout, serializeHomeLayout, setHomeWidgetVisibility,
} from '../src/lib/homeWidgetRegistry.js';
import {
  deleteUserHomeLayout, loadResolvedHomeLayout, loadUserHomeLayout, saveUserHomeLayout,
} from '../src/lib/homeLayoutPersistence.js';
import {
  HOME_PRESETS, applyWidgetPermissions, buildHomePermissions, createRolePresetLayout,
  filterWidgetCatalog, resolveDashboardLayout,
} from '../src/lib/homeDashboardModel.js';

/* POL-UI-015 round 3 — Product Owner's §9 test list for the two defects
   confirmed in preview #51: "il widget Richiami non compare nella
   Dashboard" and "Personalizza Home non salva realmente la
   configurazione".

   Both root causes were established against the real project (read only),
   not against a stand-in store, and these tests encode exactly those
   root causes so a regression cannot pass again:

   - BUG A: an account with a saved personal layout written before
     POL-UX-001 carries an EXPLICIT `{id:'richiami', visible:false}`.
     `resolveDashboardLayout` gives that user layout absolute precedence
     and `normalizeHomeLayout` only applies `defaultVisible` to ids that
     are ABSENT, so the round-2 fixes (registry `defaultVisible:true` and
     `HOME_PRESETS.owner` gaining `'richiami'`) are both unreachable for
     that account. Round 2's browser QA ran against an empty store, so it
     never had a pre-existing saved layout and reported a false pass.
   - BUG B: `saveUserHomeLayout` returned the caller's own payload as soon
     as the upsert reported no error, so the UI could commit state, close
     the modal and claim success for a write that never landed; and both
     "Salva Home" buttons were disabled by `layoutLoading` while their
     styling only dimmed on `layoutSaving`, i.e. a control that looked
     fully enabled and silently swallowed clicks.

   The `table()` helper below is a behavioural stand-in for
   `public.user_home_layouts`: upsert on the (studio_id,user_id) primary
   key, and reads that observe what was written. It is NOT a substitute
   for authenticated QA and is not claimed as one — it exists to pin the
   client-side contract (upsert -> read-back -> compare -> throw or return
   the persisted record) that the previous code did not have. The live
   database side (PK matching `onConflict`, RLS policies, CHECKs, no
   triggers) was audited directly on the project. */

const dashboardSrc = await readFile(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const persistenceSrc = await readFile(new URL('../src/lib/homeLayoutPersistence.js', import.meta.url), 'utf8');
const premiumCss = await readFile(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');

const KEY = { studioId: 'studio-a', userId: 'user-a' };

/* POL-UI-015 round 4 — why round 3's tests passed while the real save
   failed 100% of the time: this stand-in stored and returned the payload
   object as-is, preserving JavaScript key insertion order. Postgres `jsonb`
   does NOT: it stores object keys sorted by (length, then bytewise) and
   returns them in that order. Verified read-only on the real project:

     select '[{"id":"agenda","order":0,"visible":true,"size":"large"}]'::jsonb
     -> [{"id": "agenda", "size": "large", "order": 0, "visible": true}]

   Round 3's read-back compared raw `JSON.stringify` output, so in
   production the comparison could never match and every save threw. Every
   write in this file now goes through the same key reordering a real jsonb
   column applies, so that class of bug cannot pass here again. */
const jsonbStore = (value) => {
  if (Array.isArray(value)) return value.map(jsonbStore);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0));
    return keys.reduce((out, key) => { out[key] = jsonbStore(value[key]); return out; }, {});
  }
  return value;
};

/** Behavioural stand-in for user_home_layouts / studio_home_layouts. */
const table = ({
  userRow = null, studioRow = null,
  failUpsert = null, failReadBack = null, dropWrite = false, mutateWrite = null,
} = {}) => {
  const rows = { user_home_layouts: userRow, studio_home_layouts: studioRow };
  const calls = [];
  const client = {
    calls,
    get userRow() { return rows.user_home_layouts; },
    from: (name) => ({
      select: () => {
        const read = async () => {
          calls.push(`SELECT ${name}`);
          if (failReadBack && name === 'user_home_layouts') return { data: null, error: failReadBack };
          return { data: rows[name], error: null };
        };
        return { eq: () => ({ eq: () => ({ maybeSingle: read }), maybeSingle: read }) };
      },
      upsert: async (payload) => {
        calls.push(`UPSERT ${name}`);
        if (failUpsert) return { error: failUpsert };
        if (dropWrite) return { error: null }; // upsert reports OK, nothing lands
        const layout = mutateWrite ? mutateWrite(payload.layout) : payload.layout;
        rows[name] = { layout: jsonbStore(layout) };
        return { error: null };
      },
      delete: () => ({ eq: () => ({ eq: async () => { calls.push(`DELETE ${name}`); rows[name] = null; return { error: null }; } }) }),
    }),
  };
  return client;
};

/* A saved layout in the shape produced by the pre-POL-UX-001 registry: it
   predates `quick_actions` and the canonical financial widgets, and it
   carries an explicit `richiami: visible:false` alongside genuine user
   choices that must survive untouched. Built from the current registry
   defaults so every size is a legal size for its widget (a hand-written
   illegal size would be coerced by normalization and mask a real
   regression), then filtered down to the older generation's ids. No real
   studio/user identifiers and no clinical data. */
const LEGACY_ERA_IDS = [
  'agenda', 'consigli_ai', 'todo', 'appuntamenti', 'wa', 'economico',
  'preventivi', 'richiami', 'scadenze', 'statistiche',
];
const LEGACY_HIDDEN_BY_USER = ['wa', 'statistiche'];

const legacySavedLayout = () => serializeHomeLayout(createDefaultHomeLayout())
  .filter((item) => LEGACY_ERA_IDS.includes(item.id))
  .map((item, index) => ({
    ...item,
    order: index,
    // richiami is off because the OLD Richiami StatCard defaulted off,
    // not because this user made an informed choice about the new widget.
    visible: item.id === 'richiami' ? false : !LEGACY_HIDDEN_BY_USER.includes(item.id),
  }));

// ===================================================================
// BUG B — verified persistence
// ===================================================================

test('save returns the layout the DATABASE holds, not the caller\'s own payload', async () => {
  const client = table();
  const draft = setHomeWidgetVisibility(createDefaultHomeLayout(), 'richiami', true);
  const saved = await saveUserHomeLayout(client, KEY.studioId, KEY.userId, draft);

  // An UPSERT followed by a READ-BACK of the same record, in that order.
  assert.deepEqual(client.calls, ['UPSERT user_home_layouts', 'SELECT user_home_layouts']);
  // And the value handed back is the stored record, re-read and normalized.
  assert.deepEqual(serializeHomeLayout(saved), client.userRow.layout);
  assert.deepEqual(serializeHomeLayout(saved), serializeHomeLayout(draft));
});

test('an upsert error throws — no false success', async () => {
  const client = table({ failUpsert: { message: 'new row violates row-level security policy for table "user_home_layouts"', code: '42501' } });
  await assert.rejects(
    () => saveUserHomeLayout(client, KEY.studioId, KEY.userId, createDefaultHomeLayout()),
    // supabase-js surfaces a plain PostgrestError object, which is exactly
    // what the Dashboard's `error?.message` now shows to the user.
    (thrown) => /row-level security/.test(thrown.message) && thrown.code === '42501',
  );
  assert.equal(client.calls.filter((c) => c.startsWith('SELECT')).length, 0, 'must not read back after a failed upsert');
});

test('an upsert that reports success while nothing lands throws instead of reporting saved', async () => {
  // This is the exact false-success shape the old code could not detect:
  // `{ error: null }` with no row behind it.
  const client = table({ dropWrite: true });
  await assert.rejects(
    () => saveUserHomeLayout(client, KEY.studioId, KEY.userId, createDefaultHomeLayout()),
    /Salvataggio non confermato dal database/,
  );
  assert.deepEqual(client.calls, ['UPSERT user_home_layouts', 'SELECT user_home_layouts']);
});

test('a read-back that fails throws instead of reporting saved', async () => {
  const client = table({ failReadBack: { message: 'permission denied for table user_home_layouts', code: '42501' } });
  await assert.rejects(
    () => saveUserHomeLayout(client, KEY.studioId, KEY.userId, createDefaultHomeLayout()),
    (thrown) => /permission denied/.test(thrown.message),
  );
});

test('a read-back whose content differs from what was sent throws — partial writes are not success', async () => {
  // Truncation is the case a NORMALIZED comparison cannot see, because
  // normalization re-appends every missing registry id. The check compares
  // the raw stored jsonb, so it catches it.
  const truncated = table({ mutateWrite: (layout) => layout.slice(0, 3) });
  await assert.rejects(
    () => saveUserHomeLayout(truncated, KEY.studioId, KEY.userId, createDefaultHomeLayout()),
    (thrown) => /non corrisponde a quello inviato/.test(thrown.message),
  );

  // Same for a stored record whose visibility silently differs.
  const altered = table({ mutateWrite: (layout) => layout.map((item) => (item.id === 'richiami' ? { ...item, visible: false } : item)) });
  await assert.rejects(
    () => saveUserHomeLayout(altered, KEY.studioId, KEY.userId, setHomeWidgetVisibility(createDefaultHomeLayout(), 'richiami', true)),
    (thrown) => /non corrisponde a quello inviato/.test(thrown.message),
  );
});

test('reset (delete) is also confirmed by a read-back before being reported as done', async () => {
  const ok = table({ userRow: { layout: serializeHomeLayout(createDefaultHomeLayout()) } });
  await deleteUserHomeLayout(ok, KEY.studioId, KEY.userId);
  assert.deepEqual(ok.calls, ['DELETE user_home_layouts', 'SELECT user_home_layouts']);
  assert.equal(ok.userRow, null);

  // A delete that reports OK while the row survives must throw.
  const stubborn = {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { layout: [] }, error: null }) }) }) }),
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  };
  await assert.rejects(
    () => deleteUserHomeLayout(stubborn, KEY.studioId, KEY.userId),
    /Ripristino non confermato dal database/,
  );
});

test('a save is observable by a completely fresh load of the same record', async () => {
  const client = table();
  const draft = setHomeWidgetVisibility(createDefaultHomeLayout(), 'richiami', true);
  await saveUserHomeLayout(client, KEY.studioId, KEY.userId, draft);
  const reloaded = await loadUserHomeLayout(client, KEY.studioId, KEY.userId);
  assert.deepEqual(serializeHomeLayout(reloaded), serializeHomeLayout(draft));
  const resolved = await loadResolvedHomeLayout(client, KEY.studioId, KEY.userId, createRolePresetLayout(['home.owner']));
  assert.equal(resolved.source, 'user');
  assert.equal(resolved.layout.find((w) => w.id === 'richiami').visible, true);
});

test('saveUserHomeLayout never returns its own payload object', () => {
  const body = persistenceSrc.slice(persistenceSrc.indexOf('export async function saveUserHomeLayout'));
  const fn = body.slice(0, body.indexOf('export async function deleteUserHomeLayout'));
  assert.doesNotMatch(fn, /return payload\.layout/, 'must return the read-back record, not the optimistic payload');
  assert.match(fn, /const row = await readUserHomeLayoutRow\(/);
  assert.match(fn, /throw new Error\('Salvataggio non confermato dal database/);
  assert.match(fn, /return migrateSavedHomeLayout\(row\.layout\);/);
  /* The comparison must be on the STORED jsonb, never on normalized forms —
     but round 4 replaced round 3's `JSON.stringify` fingerprint with a
     canonical one, because a jsonb column legitimately returns the same
     data with its object keys reordered and the raw string comparison
     therefore failed every single save. */
  assert.match(persistenceSrc, /export const canonicalLayoutFingerprint = /);
  assert.doesNotMatch(persistenceSrc, /const rawLayoutFingerprint = /, 'the raw string fingerprint was the round-3 regression');
  assert.doesNotMatch(persistenceSrc, /serializeHomeLayout\(persisted\)/);
});

test('the modal closes only after a verified save, and stays open with the draft on error', () => {
  const saveBody = dashboardSrc.slice(
    dashboardSrc.indexOf('const saveHomeCustomization'),
    dashboardSrc.indexOf('const resetHomeCustomization'),
  );
  const awaitIdx = saveBody.indexOf('await saveUserHomeLayout');
  const closeIdx = saveBody.indexOf('setSettingsOpen(false)');
  const catchIdx = saveBody.lastIndexOf('catch (error) {');
  assert.ok(awaitIdx > -1 && closeIdx > awaitIdx, 'the modal must close after the awaited, verified save');
  assert.ok(catchIdx > closeIdx, 'the only setSettingsOpen(false) must sit on the success path');
  const catchBlock = saveBody.slice(catchIdx);
  assert.doesNotMatch(catchBlock, /setSettingsOpen\(false\)/, 'never close the modal on error');
  assert.doesNotMatch(catchBlock, /setDraftWidgets/, 'never discard the user draft on error — they must be able to retry');
  assert.match(catchBlock, /setLayoutError\(/);
  assert.match(catchBlock, /error\?\.message/, 'the real reason must reach the user');
});

test('neither "Salva Home" button can be disabled while looking enabled', () => {
  const saveButtons = dashboardSrc.match(/<button[^>]*onClick=\{saveHomeCustomization\}[^>]*>/g) || [];
  assert.equal(saveButtons.length, 2, 'expected the Widget tab and Azioni rapide tab save buttons');
  for (const button of saveButtons) {
    // The regression: disabled on layoutLoading, dimmed only on layoutSaving.
    assert.doesNotMatch(button, /disabled=\{layoutSaving \|\| layoutLoading\}/);
    assert.match(button, /disabled=\{layoutSaving\}/);
    // disabled state and its visual signal must come from the same flag
    assert.match(button, /opacity: ?layoutSaving ?\? ?0\.6 ?: ?1/);
    assert.doesNotMatch(button, /cursor: ?'pointer'/, 'cursor must reflect the disabled state too');
  }
});

test('a background layout reload cannot overwrite a newer verified save', () => {
  assert.match(dashboardSrc, /const layoutSaveEpochRef = useRef\(0\)/);
  const loadEffect = dashboardSrc.slice(
    dashboardSrc.indexOf('logHomeLayoutEvent(\'HOME_LAYOUT_LOAD_START\')'),
    dashboardSrc.indexOf('const homePeriod = resolveHomePeriod'),
  );
  assert.match(loadEffect, /layoutSaveEpochRef\.current !== startEpoch/,
    'the load effect must compare the epoch it started with before committing state');
  assert.match(dashboardSrc, /const startEpoch = layoutSaveEpochRef\.current/);
  const saveBody = dashboardSrc.slice(
    dashboardSrc.indexOf('const saveHomeCustomization'),
    dashboardSrc.indexOf('const resetHomeCustomization'),
  );
  assert.equal((saveBody.match(/layoutSaveEpochRef\.current \+= 1/g) || []).length, 2,
    'the epoch must be bumped both when the save starts and when it is confirmed');
});

// ===================================================================
// BUG A — Richiami really reaches the Dashboard
// ===================================================================

test('registry: richiami is visible by default and offers small/medium', () => {
  const widget = getHomeWidget('richiami');
  assert.ok(widget, 'richiami must exist in the registry');
  assert.equal(widget.defaultVisible, true);
  assert.deepEqual(widget.sizes, ['small', 'medium']);
});

test('owner/admin role preset includes richiami', () => {
  assert.ok(HOME_PRESETS.owner.includes('richiami'));
  const preset = createRolePresetLayout(['home.owner', 'studio.owner']);
  assert.equal(preset.find((w) => w.id === 'richiami').visible, true);
});

test('ROOT CAUSE: a pre-POL-UX-001 saved layout hides richiami and outranks every default', () => {
  // Without the migration, the user layout wins and its explicit false survives.
  const rawUser = normalizeHomeLayout(legacySavedLayout());
  const resolved = resolveDashboardLayout({
    userLayout: rawUser, studioLayout: null, roleLayout: createRolePresetLayout(['home.owner']),
  });
  assert.equal(resolved.source, 'user');
  assert.equal(resolved.layout.find((w) => w.id === 'richiami').visible, false,
    'this is the defect: the registry default and the owner preset are both unreachable here');
});

test('a pre-POL-UX-001 saved layout is detected as legacy; a modern one is not', () => {
  assert.equal(isLegacySavedHomeLayout(legacySavedLayout()), true);
  assert.equal(isLegacySavedHomeLayout(serializeHomeLayout(createDefaultHomeLayout())), false);
  assert.equal(isLegacySavedHomeLayout([]), false, 'an empty/absent layout is not a legacy layout');
  assert.ok(createDefaultHomeLayout().some((w) => w.id === HOME_LAYOUT_MODERN_SENTINEL_ID),
    'the sentinel must be part of what a modern save writes, otherwise the migration would never stop applying');
});

test('the migration re-defaults richiami for a legacy layout WITHOUT resetting anything else', () => {
  const before = legacySavedLayout();
  const after = migrateSavedHomeLayout(before);

  assert.equal(after.find((w) => w.id === 'richiami').visible, true, 'richiami becomes visible for owner/admin');
  // POL-UI-025: 'consigli_ai' was removed from the registry (moved to its
  // own dedicated Poliedron page), so it no longer appears in
  // legacySavedLayout() at all — richiami's position among the remaining
  // legacy-era ids shifts down by one, from 7 to 6.
  assert.equal(after.find((w) => w.id === 'richiami').order, 6, 'in place — position is not reshuffled');
  assert.equal(after.find((w) => w.id === 'richiami').size, 'small', 'size is left exactly as the user had it');

  // Every other user choice is byte-for-byte preserved.
  for (const original of before) {
    if (POL_UI_015_REDEFAULTED_WIDGET_IDS.includes(original.id)) continue;
    const migrated = after.find((w) => w.id === original.id);
    assert.ok(migrated, `${original.id} must not be dropped`);
    assert.equal(migrated.visible, original.visible, `${original.id} visibility must be preserved`);
    assert.equal(migrated.size, original.size, `${original.id} size must be preserved`);
    assert.equal(migrated.order, original.order, `${original.id} order must be preserved`);
  }
  assert.equal(after.find((w) => w.id === 'wa').visible, false, 'a widget the user deliberately removed stays removed');
  assert.equal(after.find((w) => w.id === 'statistiche').visible, false);
});

test('the migration respects a deliberate choice made in the current UI, and is idempotent', () => {
  // A modern layout (contains the sentinel) with richiami switched off is
  // an informed choice and must be honoured forever.
  const modern = serializeHomeLayout(setHomeWidgetVisibility(createDefaultHomeLayout(), 'richiami', false));
  assert.equal(migrateSavedHomeLayout(modern).find((w) => w.id === 'richiami').visible, false);

  // And once a legacy layout has been migrated and saved, re-running the
  // migration changes nothing (the saved layout now carries the sentinel).
  const migratedOnce = migrateSavedHomeLayout(legacySavedLayout());
  const persisted = serializeHomeLayout(migratedOnce);
  assert.deepEqual(serializeHomeLayout(migrateSavedHomeLayout(persisted)), persisted);
  const hiddenAfterwards = serializeHomeLayout(setHomeWidgetVisibility(migratedOnce, 'richiami', false));
  assert.equal(migrateSavedHomeLayout(hiddenAfterwards).find((w) => w.id === 'richiami').visible, false,
    'after the one-shot migration the user can hide richiami again and it stays hidden');
});

test('the load path applies the migration, so the fix reaches an existing account', async () => {
  const client = table({ userRow: { layout: legacySavedLayout() } });
  const loaded = await loadUserHomeLayout(client, KEY.studioId, KEY.userId);
  assert.equal(loaded.find((w) => w.id === 'richiami').visible, true);

  const resolved = await loadResolvedHomeLayout(client, KEY.studioId, KEY.userId, createRolePresetLayout(['home.owner']));
  assert.equal(resolved.source, 'user', 'the user still keeps their own layout as the source of truth');
  assert.equal(resolved.layout.find((w) => w.id === 'richiami').visible, true);
  assert.match(persistenceSrc, /return data \? migrateSavedHomeLayout\(data\.layout\) : null/);
});

test('normalization keeps a widget id that is missing from a saved layout at its registry default', () => {
  const withoutRichiami = legacySavedLayout().filter((w) => w.id !== 'richiami');
  const normalized = normalizeHomeLayout(withoutRichiami);
  assert.equal(normalized.find((w) => w.id === 'richiami').visible, true);
});

test('permissions never strip richiami for an owner/admin, and it is offered in Personalizza Home', () => {
  const permissions = buildHomePermissions({
    membership: { ruolo: 'admin', stato: 'attivo', capabilities: ['home.owner', 'studio.owner'] },
    features: {}, vertical: 'dentista',
  });
  const layout = migrateSavedHomeLayout(legacySavedLayout());
  const visible = applyWidgetPermissions(layout, HOME_WIDGET_REGISTRY, permissions);
  const richiami = visible.find((w) => w.id === 'richiami');
  assert.ok(richiami, 'richiami must survive applyWidgetPermissions');
  assert.equal(richiami.visible, true, 'and reach the render loop as visible');
  assert.ok(filterWidgetCatalog(HOME_WIDGET_REGISTRY, permissions).some((w) => w.id === 'richiami'),
    'richiami must be listed in the Personalizza Home widget catalog');
  assert.ok(getHomeWidget('richiami').permission === undefined,
    'richiami must not be gated behind a capability the owner may not hold');
});

test('the Dashboard shows at most 5 richiami and scrolls beyond that, on desktop and mobile', () => {
  const block = dashboardSrc.slice(dashboardSrc.indexOf("if (w.id === 'richiami')"));
  const widget = block.slice(0, block.indexOf("if (w.id === 'scadenze')"));
  assert.match(widget, /const hasOverflow = aperti\.length > 5/);
  assert.match(widget, /maxHeight: 272, overflowY: 'auto'/, 'the visible area is capped and scrolls');
  assert.match(widget, /\.slice\(0, hasOverflow \? undefined : 5\)/, 'at most 5 rendered when there is no overflow');
  assert.match(widget, /className="home-richiami-list"/);
  // The class must actually be styled, so touch scrolling works on mobile.
  assert.match(premiumCss, /\.home-richiami-list \{/);
  assert.match(premiumCss, /-webkit-overflow-scrolling: touch/);
  assert.match(premiumCss, /overscroll-behavior: contain/);
  assert.match(premiumCss, /\.home-richiami-list > \[role='button'\] \{ min-height: 48px; \}/,
    'mobile touch targets inside the scroll area must stay large enough');
});
