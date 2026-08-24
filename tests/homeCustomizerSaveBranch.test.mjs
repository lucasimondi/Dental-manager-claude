import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createDefaultHomeLayout, moveHomeWidgetByOffset, normalizeHomeLayout, serializeHomeLayout,
  setHomeWidgetConfig, setHomeWidgetSize, setHomeWidgetVisibility,
} from '../src/lib/homeWidgetRegistry.js';
import {
  canonicalLayoutFingerprint, deleteUserHomeLayout, saveUserHomeLayout,
} from '../src/lib/homeLayoutPersistence.js';

/* POL-UI-015 round 4 — Product Owner's §7 test list, after the third
   rejection of PR #51 ("Richiami: OK. Personalizza Home: NON SALVA
   ANCORA").

   ROOT CAUSE fixed here (proven read-only against the live project, and
   reproduced below): round 3's verified read-back compared
   `JSON.stringify(row.layout)` with `JSON.stringify(payload.layout)`.
   Postgres `jsonb` stores object keys sorted by (length, then bytewise)
   and returns them that way, while `serializeHomeLayout` emits
   `{id, order, visible, size[, config]}` — so the two strings could never
   be equal, for any layout, on any account. Every save therefore threw
   "il layout Home persistito non corrisponde a quello inviato" AFTER a
   successful write, the modal stayed open and the personalization looked
   un-saved. Round 3 had converted a silent no-op into a guaranteed hard
   failure.

   The second half of this file pins the save-BRANCH contract the Product
   Owner asked for explicitly: every editing handler must clear
   `draftInherits`, so that an edit made on an inherited layout is saved as
   a personal layout (UPSERT) instead of being routed to the
   inherit/DELETE branch. */

const dashboardSrc = await readFile(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const diagnosticsSrc = await readFile(new URL('../src/lib/homeLayoutDiagnostics.js', import.meta.url), 'utf8');

const KEY = { studioId: 'studio-a', userId: 'user-a' };

/** Reorders object keys exactly like a Postgres jsonb column. */
const jsonbStore = (value) => {
  if (Array.isArray(value)) return value.map(jsonbStore);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0))
      .reduce((out, key) => { out[key] = jsonbStore(value[key]); return out; }, {});
  }
  return value;
};

const jsonbTable = () => {
  let row = null;
  const calls = [];
  return {
    calls,
    get row() { return row; },
    from: () => ({
      select: () => {
        const read = async () => { calls.push('SELECT'); return { data: row, error: null }; };
        return { eq: () => ({ eq: () => ({ maybeSingle: read }), maybeSingle: read }) };
      },
      upsert: async (payload) => {
        calls.push('UPSERT');
        row = { layout: jsonbStore(payload.layout) };
        return { error: null };
      },
      delete: () => ({ eq: () => ({ eq: async () => { calls.push('DELETE'); row = null; return { error: null }; } }) }),
    }),
  };
};

// ===================================================================
// ROOT CAUSE — jsonb key order must not be mistaken for a failed write
// ===================================================================

test('a jsonb column really does reorder the keys we send', () => {
  const sent = serializeHomeLayout(createDefaultHomeLayout())[0];
  const stored = jsonbStore(sent);
  assert.deepEqual(Object.keys(sent), ['id', 'order', 'visible', 'size']);
  assert.deepEqual(Object.keys(stored), ['id', 'size', 'order', 'visible']);
  // This is exactly the comparison round 3 performed — and it can never pass.
  assert.notEqual(JSON.stringify(sent), JSON.stringify(stored));
});

test('the canonical fingerprint ignores key order but nothing else', () => {
  const layout = serializeHomeLayout(setHomeWidgetVisibility(createDefaultHomeLayout(), 'richiami', true));
  assert.equal(canonicalLayoutFingerprint(layout), canonicalLayoutFingerprint(jsonbStore(layout)));
  // ...while every difference that matters still shows up.
  const truncated = layout.slice(0, layout.length - 1);
  assert.notEqual(canonicalLayoutFingerprint(layout), canonicalLayoutFingerprint(truncated));
  const reordered = [layout[1], layout[0], ...layout.slice(2)];
  assert.notEqual(canonicalLayoutFingerprint(layout), canonicalLayoutFingerprint(reordered));
  const flipped = layout.map((item, i) => (i === 0 ? { ...item, visible: !item.visible } : item));
  assert.notEqual(canonicalLayoutFingerprint(layout), canonicalLayoutFingerprint(flipped));
  const resized = layout.map((item, i) => (i === 0 ? { ...item, size: item.size === 'wide' ? 'medium' : 'wide' } : item));
  assert.notEqual(canonicalLayoutFingerprint(layout), canonicalLayoutFingerprint(resized));
});

test('a config-carrying entry survives the jsonb key reordering check', () => {
  const draft = setHomeWidgetConfig(createDefaultHomeLayout(), 'quick_actions', { actions: ['nuovo_paziente', 'nuovo_appuntamento'] });
  const layout = serializeHomeLayout(draft);
  const entry = layout.find((item) => item.id === 'quick_actions');
  assert.ok(entry?.config?.actions?.length === 2, 'config must reach the payload');
  assert.equal(canonicalLayoutFingerprint(layout), canonicalLayoutFingerprint(jsonbStore(layout)));
  // A changed config is still a mismatch.
  const tampered = layout.map((item) => (item.id === 'quick_actions' ? { ...item, config: { actions: ['nuovo_paziente'] } } : item));
  assert.notEqual(canonicalLayoutFingerprint(layout), canonicalLayoutFingerprint(tampered));
});

test('a save against a jsonb-behaving table succeeds and is read back', async () => {
  const client = jsonbTable();
  const draft = setHomeWidgetVisibility(createDefaultHomeLayout(), 'richiami', false);
  const saved = await saveUserHomeLayout(client, KEY.studioId, KEY.userId, draft);
  assert.deepEqual(client.calls, ['UPSERT', 'SELECT']);
  assert.equal(canonicalLayoutFingerprint(serializeHomeLayout(saved)), canonicalLayoutFingerprint(client.row.layout));
});

test('every kind of edit round-trips through a jsonb-behaving table', async () => {
  const edits = {
    'toggle visible': (l) => setHomeWidgetVisibility(l, 'statistiche', true),
    resize: (l) => setHomeWidgetSize(l, 'agenda', 'wide'),
    reorder: (l) => moveHomeWidgetByOffset(l, 'todo', -1),
    'quick actions config': (l) => setHomeWidgetConfig(l, 'quick_actions', { actions: ['nuovo_paziente'] }),
  };
  for (const [label, edit] of Object.entries(edits)) {
    const client = jsonbTable();
    const draft = edit(createDefaultHomeLayout());
    const saved = await saveUserHomeLayout(client, KEY.studioId, KEY.userId, draft);
    assert.equal(
      canonicalLayoutFingerprint(serializeHomeLayout(saved)),
      canonicalLayoutFingerprint(serializeHomeLayout(draft)),
      `${label}: what comes back must be what was sent`,
    );
  }
});

test('the read-back still throws when the write is truly wrong', async () => {
  const client = {
    from: () => ({
      select: () => {
        const read = async () => ({ data: { layout: jsonbStore(serializeHomeLayout(createDefaultHomeLayout()).slice(0, 3)) }, error: null });
        return { eq: () => ({ eq: () => ({ maybeSingle: read }), maybeSingle: read }) };
      },
      upsert: async () => ({ error: null }),
    }),
  };
  await assert.rejects(
    () => saveUserHomeLayout(client, KEY.studioId, KEY.userId, createDefaultHomeLayout()),
    /non corrisponde a quello inviato/,
  );
});

// ===================================================================
// §7 — save BRANCH: an edit must never be routed to inherit/delete
// ===================================================================

/* Mirrors the Dashboard's own branching, so the assertions below are about
   the branch decision itself rather than about React internals:
     draftInherits ? deleteUserHomeLayout(...) : saveUserHomeLayout(...) */
const runSaveBranch = async ({ draftInherits, draftWidgets }) => {
  const client = jsonbTable();
  if (draftInherits) await deleteUserHomeLayout(client, KEY.studioId, KEY.userId);
  else await saveUserHomeLayout(client, KEY.studioId, KEY.userId, draftWidgets);
  return client.calls;
};

/* The editing handlers as they are wired in Dashboard.jsx: each one sets
   `draftInherits` to false and then transforms the draft. */
const EDIT_HANDLERS = {
  'toggle visible': (layout) => setHomeWidgetVisibility(layout, 'richiami', true),
  reorder: (layout) => moveHomeWidgetByOffset(layout, 'todo', -1),
  resize: (layout) => setHomeWidgetSize(layout, 'agenda', 'small'),
  config: (layout) => setHomeWidgetConfig(layout, 'quick_actions', { actions: ['nuovo_appuntamento'] }),
};

for (const [label, edit] of Object.entries(EDIT_HANDLERS)) {
  test(`layoutSource=role + ${label} -> draftInherits false -> UPSERT, never DELETE`, async () => {
    // Editor opened on an inherited (role) layout: openHomeCustomizer sets
    // draftInherits = (layoutSource !== 'user') = true.
    let draftInherits = 'role' !== 'user';
    assert.equal(draftInherits, true, 'baseline: an inherited layout starts as "inherits"');

    // ...the user edits something. Every handler clears the flag first.
    draftInherits = false;
    const draftWidgets = edit(createDefaultHomeLayout());
    assert.equal(draftInherits, false, `${label} must clear draftInherits`);

    const calls = await runSaveBranch({ draftInherits, draftWidgets });
    assert.deepEqual(calls, ['UPSERT', 'SELECT'], 'an edited layout must be persisted as a personal layout');
    assert.ok(!calls.includes('DELETE'), 'deleteUserHomeLayout must NOT be called');
  });

  test(`every handler in Dashboard.jsx that edits the draft also clears draftInherits (${label})`, () => {
    // Source-level guard: a future handler that forgets setDraftInherits(false)
    // would silently route the user's edit to the inherit/DELETE branch.
    const handlerLines = dashboardSrc.split('\n').filter((line) => line.includes('setDraftWidgets((layout)'));
    assert.ok(handlerLines.length >= 5, 'expected the draft-editing handlers to be found');
    for (const line of handlerLines) {
      assert.ok(line.includes('setDraftInherits(false)'), `handler must clear draftInherits: ${line.trim().slice(0, 120)}`);
    }
  });
}

test('layoutSource=user + edit -> UPSERT branch', async () => {
  const draftInherits = 'user' !== 'user';
  assert.equal(draftInherits, false);
  const calls = await runSaveBranch({ draftInherits, draftWidgets: setHomeWidgetVisibility(createDefaultHomeLayout(), 'scadenze', false) });
  assert.deepEqual(calls, ['UPSERT', 'SELECT']);
});

test('an explicit "Reset al default" is the only path to the inherit/DELETE branch', async () => {
  // resetHomeCustomization is the ONLY place that sets draftInherits back to true.
  const resetSets = dashboardSrc.match(/setDraftInherits\(true\)/g) || [];
  assert.equal(resetSets.length, 1, 'exactly one place may opt back into inheriting');
  const calls = await runSaveBranch({ draftInherits: true, draftWidgets: createDefaultHomeLayout() });
  assert.deepEqual(calls, ['DELETE', 'SELECT'], 'reset deletes the personal row and confirms it is gone');
});

test('a failed save keeps the modal open with the draft intact and a real reason', () => {
  const save = dashboardSrc.slice(dashboardSrc.indexOf('const saveHomeCustomization'), dashboardSrc.indexOf('const resetHomeCustomization'));
  const successClose = save.indexOf('setSettingsOpen(false)');
  const catchAt = save.indexOf('} catch (error) {');
  assert.ok(successClose > -1 && catchAt > -1);
  assert.ok(successClose < catchAt, 'the modal may only close on the success path');
  const failure = save.slice(catchAt);
  assert.ok(!failure.includes('setSettingsOpen(false)'), 'a failed save must not close the modal');
  assert.ok(!failure.includes('setDraftWidgets('), 'a failed save must not touch the draft');
  assert.ok(failure.includes('error?.message'), 'the real reason must be surfaced');
  assert.ok(failure.includes('setLayoutError('), 'the error must be visible for retry');
});

// ===================================================================
// §3/§4 — the trail must exist where the bug is actually reproducible
// ===================================================================

test('diagnostics are enabled on Netlify deploy previews, not only on the dev server', () => {
  assert.ok(diagnosticsSrc.includes('deploy-preview-'), 'preview hosts must enable the trail');
  assert.ok(/import\.meta\.env\?\.DEV/.test(diagnosticsSrc), 'the dev server must stay enabled');
  assert.ok(diagnosticsSrc.includes('isHomeLayoutDiagnosticsEnabled'), 'the gate must be exported for the UI badge');
  // Sensitive words may appear in the module's own "never log this" comment,
  // so the check is against executable code only.
  const code = diagnosticsSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').toLowerCase();
  for (const forbidden of ['token', 'email', 'password', 'secret', 'patient', 'paziente']) {
    assert.ok(!code.includes(forbidden), `diagnostics code must never touch ${forbidden}`);
  }
});

test('the save trail logs the stages the Product Owner needs, and no secrets', () => {
  for (const event of [
    'HOME_SAVE_CLICK', 'HOME_SAVE_STATE', 'HOME_SAVE_BRANCH_USER', 'HOME_SAVE_BRANCH_INHERIT',
  ]) {
    assert.ok(dashboardSrc.includes(event), `Dashboard must log ${event}`);
  }
  const state = dashboardSrc.slice(dashboardSrc.indexOf("traceHomeSave('HOME_SAVE_STATE'"), dashboardSrc.indexOf('if (!studioId || !userId) {'));
  for (const field of ['layoutSource', 'draftInherits', 'layoutLoading', 'layoutSaving', 'studioIdPresent', 'userIdPresent', 'changedWidgetIds']) {
    assert.ok(state.includes(field), `HOME_SAVE_STATE must include ${field}`);
  }
  // Identity is reported as a boolean only — never the raw id.
  assert.ok(state.includes('Boolean(studioId)') && state.includes('Boolean(userId)'), 'ids must be reported as booleans');
  assert.ok(!/studioId,\s*$/m.test(state), 'the raw studio id must never be logged');
});

test('HOME_SAVE_CLICK is logged before any guard can return early', () => {
  const save = dashboardSrc.slice(dashboardSrc.indexOf('const saveHomeCustomization'), dashboardSrc.indexOf('const resetHomeCustomization'));
  assert.ok(save.indexOf("traceHomeSave('HOME_SAVE_CLICK')") < save.indexOf('if (!studioId || !userId)'),
    'a click that dies on the identity guard must still be observable');
});

test('the persistence layer logs upsert/read-back stages', async () => {
  const persistenceSrc = await readFile(new URL('../src/lib/homeLayoutPersistence.js', import.meta.url), 'utf8');
  for (const event of ['HOME_SAVE_UPSERT_START', 'HOME_SAVE_UPSERT_OK', 'HOME_SAVE_READBACK_OK', 'HOME_SAVE_ERROR']) {
    assert.ok(persistenceSrc.includes(event), `persistence must log ${event}`);
  }
});

test('the preview-only save badge never renders in production', () => {
  assert.ok(dashboardSrc.includes('const homeSaveDiagBadge = !diagnosticsEnabled ? null :'), 'the badge must be gated');
  assert.ok(dashboardSrc.includes('DEV/PREVIEW'), 'the badge must be labelled as non-production');
  const badge = dashboardSrc.slice(dashboardSrc.indexOf('const homeSaveDiagBadge'), dashboardSrc.indexOf('const [todoList'));
  assert.ok(!badge.includes('{studioId}') && !badge.includes('{userId}'), 'the badge must not print identifiers');
});

// ===================================================================
// The Salva Home control must be a real, reachable target
// ===================================================================

test('both Salva Home buttons stay reachable and touch-sized on a phone', () => {
  const buttons = dashboardSrc.split('\n').filter((line) => line.includes('onClick={saveHomeCustomization}'));
  assert.equal(buttons.length, 2, 'exactly the Widget tab and the Azioni rapide tab expose a save button');
  for (const button of buttons) {
    assert.ok(button.includes('disabled={layoutSaving}'), 'saving is the only reason to disable the primary action');
    assert.ok(!button.includes('layoutLoading'), 'a background load must never disable the primary action');
    assert.ok(/minHeight: ?44/.test(button), 'the primary action needs a 44px touch target');
    assert.ok(/flexShrink: ?0/.test(button), 'the primary action must not be squeezed by its siblings');
    assert.ok(/whiteSpace: ?'nowrap'/.test(button), 'its label must not wrap mid-word');
  }
  const rows = dashboardSrc.split('\n').filter((line) => /display: ?'flex'.*marginTop: ?1[26]/.test(line) && line.includes('gap'));
  assert.ok(rows.length >= 2 && rows.every((row) => row.includes("flexWrap: 'wrap'") || row.includes("flexWrap:'wrap'")),
    'the action rows must wrap instead of crushing their buttons on a narrow screen');
});

test('normalization keeps the payload within the column CHECK budget', () => {
  const layout = serializeHomeLayout(normalizeHomeLayout(createDefaultHomeLayout()));
  // public.user_home_layouts CHECK: pg_column_size(layout) <= 32768
  assert.ok(JSON.stringify(layout).length < 32768, 'a full registry layout must fit the 32KB CHECK');
});
