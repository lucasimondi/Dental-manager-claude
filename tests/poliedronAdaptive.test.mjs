import test from 'node:test';
import assert from 'node:assert/strict';

import { getPoliedronSafeBounds, clampToBounds, DEFAULT_SAFETY_MARGIN } from '../src/lib/poliedron/poliedronSafeBounds.js';
import { computeDragPosition, decideSnapX, fractionFromPosition, positionFromFraction, decideSideSwitch } from '../src/lib/poliedron/poliedronDragMath.js';
import { computeMobileOrbSize } from '../src/lib/poliedron/poliedronOrbSize.js';
import { COMMAND_ALIASES, resolveCommandAlias } from '../src/lib/poliedron/commandAliases.js';
import { NAVIGATION_INDEX } from '../src/lib/poliedron/navigationIndex.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';
import { buildContext } from '../src/lib/poliedron/contextEngine.js';
import { ACTION_REGISTRY } from '../src/lib/poliedron/actionRegistry.js';

const VIEWPORT_375 = { viewportWidth: 375, viewportHeight: 812, orbWidth: 100, orbHeight: 100 };

// ---------------------------------------------------------------------------
// §25 — mobile: safe clamp top/bottom/left/right
// ---------------------------------------------------------------------------

test('getPoliedronSafeBounds: clamps by the safety margin on all four sides', () => {
  const b = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  assert.equal(b.minX, 20);
  assert.equal(b.minY, 20);
  assert.equal(b.maxX, 375 - 100 - 20);
  assert.equal(b.maxY, 812 - 100 - 20);
});

test('getPoliedronSafeBounds: incorporates real device safe-area insets on all four sides', () => {
  const b = getPoliedronSafeBounds({
    ...VIEWPORT_375, additionalSafetyMargin: 20,
    safeAreaInsets: { top: 44, right: 0, bottom: 34, left: 0 }, // notch + home indicator, e.g. iPhone
  });
  assert.equal(b.minY, 44 + 20);
  assert.equal(b.maxY, 812 - 100 - 34 - 20);
});

test('getPoliedronSafeBounds: never produces an inverted range on a too-small viewport', () => {
  const b = getPoliedronSafeBounds({ viewportWidth: 50, viewportHeight: 50, orbWidth: 100, orbHeight: 100, additionalSafetyMargin: 20 });
  assert.ok(b.maxX >= b.minX);
  assert.ok(b.maxY >= b.minY);
});

test('getPoliedronSafeBounds: reserves an optional bottom strip for a future Poliedra mobile nav', () => {
  const withReserve = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20, bottomReservedExtra: 60 });
  const without = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  assert.equal(withReserve.maxY, without.maxY - 60);
});

test('clampToBounds: clamps below min and above max, passes through in range', () => {
  assert.equal(clampToBounds(-5, 0, 100), 0);
  assert.equal(clampToBounds(500, 0, 100), 100);
  assert.equal(clampToBounds(42, 0, 100), 42);
});

// ---------------------------------------------------------------------------
// §25 — grab offset preservation / exact pointer release
// ---------------------------------------------------------------------------

test('computeDragPosition: the orb tracks the exact point the user grabbed it by (grabOffset preserved)', () => {
  const bounds = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  // Grabbed 10px from the orb's own left/top edge, then dragged to (200, 300).
  const pos = computeDragPosition({ pointerX: 200, pointerY: 300, grabOffsetX: 10, grabOffsetY: 10, bounds });
  assert.equal(pos.x, 190); // 200 - 10
  assert.equal(pos.y, 290); // 300 - 10
});

test('computeDragPosition: a different grabOffset on the same pointer position gives a different, exact result — no drift', () => {
  const bounds = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  const grabbedNearEdge = computeDragPosition({ pointerX: 200, pointerY: 300, grabOffsetX: 90, grabOffsetY: 5, bounds });
  assert.equal(grabbedNearEdge.x, 110); // 200 - 90
  assert.equal(grabbedNearEdge.y, 295); // 300 - 5
});

test('computeDragPosition: clamps the resulting box inside safe bounds without breaking the offset math', () => {
  const bounds = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  const offscreen = computeDragPosition({ pointerX: -500, pointerY: -500, grabOffsetX: 10, grabOffsetY: 10, bounds });
  assert.equal(offscreen.x, bounds.minX);
  assert.equal(offscreen.y, bounds.minY);
});

// ---------------------------------------------------------------------------
// §3, §25 — release: no random relocation, snap threshold, no central snap
// ---------------------------------------------------------------------------

test('decideSnapX: a release far from both edges is NOT moved — "where I drop it is where it stays"', () => {
  const bounds = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 }); // minX=20, maxX=255
  const centerX = (bounds.minX + bounds.maxX) / 2;
  assert.equal(decideSnapX({ x: centerX, bounds, snapThreshold: 48 }), centerX);
});

test('decideSnapX: a release within the snap threshold of the left edge snaps to minX', () => {
  const bounds = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  assert.equal(decideSnapX({ x: bounds.minX + 30, bounds, snapThreshold: 48 }), bounds.minX);
});

test('decideSnapX: a release within the snap threshold of the right edge snaps to maxX', () => {
  const bounds = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  assert.equal(decideSnapX({ x: bounds.maxX - 30, bounds, snapThreshold: 48 }), bounds.maxX);
});

test('decideSnapX: a release exactly AT the threshold distance still snaps (inclusive boundary)', () => {
  const bounds = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  assert.equal(decideSnapX({ x: bounds.minX + 48, bounds, snapThreshold: 48 }), bounds.minX);
});

test('decideSnapX: a release just past the threshold is left exactly where dropped', () => {
  const bounds = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  const x = bounds.minX + 49;
  assert.equal(decideSnapX({ x, bounds, snapThreshold: 48 }), x);
});

test('decideSnapX with applySnap=false semantics (pointercancel path): caller can skip snapping entirely by never calling it', () => {
  // pointercancel in the hook never calls decideSnapX at all — verified at
  // the integration level by the hook itself; this asserts the pure
  // function has no hidden default that would snap unexpectedly if some
  // future caller passed a 0 threshold instead of skipping the call.
  const bounds = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  const x = bounds.minX + 5;
  assert.equal(decideSnapX({ x, bounds, snapThreshold: 0 }), x);
});

// ---------------------------------------------------------------------------
// §6, §25 — reload/resize reclamp via fraction round-trip
// ---------------------------------------------------------------------------

test('fractionFromPosition / positionFromFraction: exact round trip on the same bounds', () => {
  const bounds = getPoliedronSafeBounds({ ...VIEWPORT_375, additionalSafetyMargin: 20 });
  const original = { x: bounds.minX + 40, y: bounds.minY + 60 };
  const frac = fractionFromPosition({ x: original.x, y: original.y, bounds });
  const back = positionFromFraction({ xFrac: frac.xFrac, yFrac: frac.yFrac, bounds });
  assert.ok(Math.abs(back.x - original.x) < 0.001);
  assert.ok(Math.abs(back.y - original.y) < 0.001);
});

test('reload reclamp: a fraction saved on a wide viewport re-expands to a valid position on a narrow one', () => {
  const wideBounds = getPoliedronSafeBounds({ viewportWidth: 1440, viewportHeight: 900, orbWidth: 100, orbHeight: 100, additionalSafetyMargin: 20 });
  const frac = fractionFromPosition({ x: wideBounds.maxX, y: wideBounds.minY, bounds: wideBounds }); // parked at the far right
  const narrowBounds = getPoliedronSafeBounds({ viewportWidth: 375, viewportHeight: 812, orbWidth: 100, orbHeight: 100, additionalSafetyMargin: 20 });
  const reclamped = positionFromFraction({ xFrac: frac.xFrac, yFrac: frac.yFrac, bounds: narrowBounds });
  assert.ok(reclamped.x >= narrowBounds.minX && reclamped.x <= narrowBounds.maxX);
  assert.ok(reclamped.y >= narrowBounds.minY && reclamped.y <= narrowBounds.maxY);
});

test('resize reclamp: the same fraction stays proportionally in place as the viewport grows', () => {
  const bounds1 = getPoliedronSafeBounds({ viewportWidth: 400, viewportHeight: 800, orbWidth: 100, orbHeight: 100, additionalSafetyMargin: 20 });
  const frac = { xFrac: 0.5, yFrac: 0.5 };
  const pos1 = positionFromFraction({ ...frac, bounds: bounds1 });
  const bounds2 = getPoliedronSafeBounds({ viewportWidth: 800, viewportHeight: 800, orbWidth: 100, orbHeight: 100, additionalSafetyMargin: 20 });
  const pos2 = positionFromFraction({ ...frac, bounds: bounds2 });
  assert.ok(pos2.x > pos1.x); // still centered, just at the wider viewport's center
  assert.ok(pos1.x >= bounds1.minX && pos1.x <= bounds1.maxX);
  assert.ok(pos2.x >= bounds2.minX && pos2.x <= bounds2.maxX);
});

// ---------------------------------------------------------------------------
// §1 — mobile orb size
// ---------------------------------------------------------------------------

test('computeMobileOrbSize: stays within the 96-108px target at every required breakpoint', () => {
  for (const w of [375, 390, 430, 768, 1024, 1440]) {
    const size = computeMobileOrbSize(w);
    assert.ok(size >= 96 && size <= 108, `${w}px -> ${size}px out of range`);
  }
});

test('computeMobileOrbSize: the narrowest supported device (375px) is not disproportionate — near the lower bound', () => {
  assert.ok(computeMobileOrbSize(375) <= 100);
});

test('computeMobileOrbSize: roughly 1.5x the previous 68px size', () => {
  const size = computeMobileOrbSize(390);
  assert.ok(Math.abs(size - 68 * 1.5) < 15);
});

// ---------------------------------------------------------------------------
// §26 — desktop: side switching
// ---------------------------------------------------------------------------

test('decideSideSwitch: dragging right-docked orb far enough LEFT proposes a switch to left', () => {
  assert.equal(decideSideSwitch({ dx: -150, side: 'right', minDragX: 120 }), true);
});

test('decideSideSwitch: dragging left-docked orb far enough RIGHT proposes a switch to right', () => {
  assert.equal(decideSideSwitch({ dx: 150, side: 'left', minDragX: 120 }), true);
});

test('decideSideSwitch: small jitter never proposes a side switch', () => {
  assert.equal(decideSideSwitch({ dx: -20, side: 'right', minDragX: 120 }), false);
  assert.equal(decideSideSwitch({ dx: 20, side: 'left', minDragX: 120 }), false);
});

test('decideSideSwitch: dragging further INTO your own side never proposes a switch', () => {
  assert.equal(decideSideSwitch({ dx: 150, side: 'right', minDragX: 120 }), false); // right-docked, dragging further right
  assert.equal(decideSideSwitch({ dx: -150, side: 'left', minDragX: 120 }), false);
});

// ---------------------------------------------------------------------------
// §26 — desktop: vertical clamp (reuses the same safe-bounds model)
// ---------------------------------------------------------------------------

test('desktop vertical clamp: a dock cannot be dragged above the top margin or below the bottom margin', () => {
  const bounds = getPoliedronSafeBounds({ viewportWidth: 1440, viewportHeight: 900, orbWidth: 56, orbHeight: 56, additionalSafetyMargin: 20 });
  assert.equal(clampToBounds(-100, bounds.minY, bounds.maxY), bounds.minY);
  assert.equal(clampToBounds(5000, bounds.minY, bounds.maxY), bounds.maxY);
});

// ---------------------------------------------------------------------------
// §27 — prefix / direct-command navigation
// ---------------------------------------------------------------------------

const REAL_NAV_IDS = new Set(NAVIGATION_INDEX.map((n) => n.id));

test('commandAliases: every registered target is a real, verified NAV id (never an invented route)', () => {
  for (const [alias, target] of Object.entries(COMMAND_ALIASES)) {
    assert.ok(REAL_NAV_IDS.has(target.navId), `"${alias}" -> "${target.navId}" is not a real NAV entry`);
  }
});

test('commandAliases: no duplicate alias across categories (module load already asserts this; re-verified structurally)', () => {
  const keys = Object.keys(COMMAND_ALIASES);
  assert.equal(new Set(keys).size, keys.length);
});

test('resolveCommandAlias: ric -> Ricette lands on the real archivio route, filtered', () => {
  const r = resolveCommandAlias('ric');
  assert.deepEqual(r, { navId: 'archivio', filtroTipo: 'ricetta' });
});

test('resolveCommandAlias: rice/ricetta/ricette all resolve to the same destination as "ric"', () => {
  for (const q of ['rice', 'ricetta', 'ricette']) {
    assert.deepEqual(resolveCommandAlias(q), { navId: 'archivio', filtroTipo: 'ricetta' });
  }
});

test('resolveCommandAlias: fat -> Fatture lands on the real archivio route, filtered differently than Ricette', () => {
  assert.deepEqual(resolveCommandAlias('fat'), { navId: 'archivio', filtroTipo: 'fattura' });
});

test('resolveCommandAlias: pag/paga/pagamento/pagamenti all resolve to Pagamenti', () => {
  for (const q of ['pag', 'paga', 'pagamento', 'pagamenti']) {
    assert.equal(resolveCommandAlias(q).navId, 'paga');
  }
});

test('resolveCommandAlias: age/agenda resolve to Agenda', () => {
  for (const q of ['age', 'agenda']) assert.equal(resolveCommandAlias(q).navId, 'agenda');
});

test('resolveCommandAlias: paz/paziente/pazienti resolve to Pazienti', () => {
  for (const q of ['paz', 'paziente', 'pazienti']) assert.equal(resolveCommandAlias(q).navId, 'paz');
});

test('§19 ambiguity: "ric" (Ricette) and "rich" (Richiami) never collide — each resolves to its own real destination', () => {
  const ric = resolveCommandAlias('ric');
  const rich = resolveCommandAlias('rich');
  assert.equal(ric.navId, 'archivio');
  assert.equal(rich.navId, 'richiami');
  assert.notDeepEqual(ric, rich);
});

test('§19 ambiguity: richi/richiamo/richiami all resolve to Richiami, distinctly from ric/rice', () => {
  for (const q of ['richi', 'richiamo', 'richiami']) assert.equal(resolveCommandAlias(q).navId, 'richiami');
});

test('resolveCommandAlias: unknown command falls through to null (normal search territory)', () => {
  assert.equal(resolveCommandAlias('zzz'), null);
  assert.equal(resolveCommandAlias(''), null);
  assert.equal(resolveCommandAlias('   '), null);
});

test('resolveCommandAlias: is case-insensitive and trims whitespace, but still requires an exact whole-string match', () => {
  assert.equal(resolveCommandAlias('  PAG  ').navId, 'paga');
  assert.equal(resolveCommandAlias('pagam'), null); // partial — not a registered alias
});

// §21 — partial search remains distinct from a command alias
test('§21 partial search survives: a patient-name-shaped query never matches a commandAlias', () => {
  assert.equal(resolveCommandAlias('ross'), null);
  assert.equal(resolveCommandAlias('mario rossi'), null);
});

test('processQuery: an exact command alias resolves instantly, without classifyIntent/model involvement (§23 "feels fast")', async () => {
  const result = await processQuery({
    query: 'pag',
    context: buildContext(),
    permissions: {},
    sources: { navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
  });
  assert.equal(result.intent, 'DIRECT_NAVIGATE');
  assert.deepEqual(result.directNavigation, { navId: 'paga', filtroTipo: null });
  assert.deepEqual(result.searchResults, []);
});

test('processQuery: "ric" resolves with the filtroTipo hint attached for the real archivio route', async () => {
  const result = await processQuery({
    query: 'ric',
    context: buildContext(),
    permissions: {},
    sources: { navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
  });
  assert.deepEqual(result.directNavigation, { navId: 'archivio', filtroTipo: 'ricetta' });
});

test('processQuery: a live partial query ("ross") still returns normal search results, not a direct navigation', async () => {
  const patients = [{ id: 'p1', nome: 'Mario', cognome: 'Rossi', cf: '', telefono: '' }];
  const result = await processQuery({
    query: 'ross',
    context: buildContext(),
    permissions: {},
    sources: { patients, navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
  });
  assert.equal(result.directNavigation, undefined);
  assert.ok(result.searchResults.some((g) => g.group === 'PAZIENTI'));
});
