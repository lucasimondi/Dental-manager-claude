import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getPoliedronSafeBounds, clampToBounds, DEFAULT_SAFETY_MARGIN } from '../src/lib/poliedron/poliedronSafeBounds.js';
import { computeDragPosition, fractionFromPosition, positionFromFraction, decideSideSwitch } from '../src/lib/poliedron/poliedronDragMath.js';
import { computeMobileOrbSize } from '../src/lib/poliedron/poliedronOrbSize.js';
import {
  applyRedockAttraction,
  getDockProtectionProgress,
  getPoliedronMobileDockLayout,
  MOBILE_ORB_CENTER_ELEVATION,
  shouldRedock,
} from '../src/lib/poliedron/poliedronMobileDock.js';
import { COMMAND_ALIASES, resolveCommandAlias, resolveCommandAliasSuggestions } from '../src/lib/poliedron/commandAliases.js';
import { NAVIGATION_INDEX } from '../src/lib/poliedron/navigationIndex.js';
import { classifyIntent, INTENT } from '../src/lib/poliedron/intentEngine.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';
import { buildContext } from '../src/lib/poliedron/contextEngine.js';
import { ACTION_REGISTRY } from '../src/lib/poliedron/actionRegistry.js';

const VIEWPORT_375 = { viewportWidth: 375, viewportHeight: 812, orbWidth: 100, orbHeight: 100 };
const mobileDockSource = readFileSync(new URL('../src/components/poliedron/PoliedronMobileDock.jsx', import.meta.url), 'utf8');
const mobileOrbSource = readFileSync(new URL('../src/components/poliedron/PoliedronOrb.jsx', import.meta.url), 'utf8');
const mobilePositionSource = readFileSync(new URL('../src/components/poliedron/usePoliedronPosition.js', import.meta.url), 'utf8');
const premiumCss = readFileSync(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const mobileBreakpointSource = readFileSync(new URL('../src/lib/useIsMobile.js', import.meta.url), 'utf8');

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

test('getPoliedronSafeBounds: dock protected zone keeps a detached orb above navigation icons', () => {
  const b = getPoliedronSafeBounds({
    ...VIEWPORT_375,
    protectedBottomZone: { top: 730, gap: 10 },
  });
  assert.equal(b.maxY, 730 - 100 - 10);
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

test('computeMobileOrbSize: stays within the 58-72px standalone-gem target at every required breakpoint', () => {
  for (const w of [375, 390, 430, 768, 1024, 1440]) {
    const size = computeMobileOrbSize(w);
    assert.ok(size >= 58 && size <= 72, `${w}px -> ${size}px out of range`);
  }
});

test('computeMobileOrbSize: remains balanced across the required mobile widths', () => {
  assert.equal(computeMobileOrbSize(375), 64);
  assert.equal(computeMobileOrbSize(390), 66);
  assert.equal(computeMobileOrbSize(430), 72);
});

test('computeMobileOrbSize: implements clamp(58px, 17vw, 72px) with an accessible hit target', () => {
  for (const width of [320, 375, 390, 430]) {
    assert.ok(computeMobileOrbSize(width) >= 44);
  }
});

test('mobile Poliedron renders only the official standalone gem on a transparent hit area', () => {
  assert.match(mobileOrbSource, /import poliedroGem from '\.\.\/\.\.\/assets\/icon-poliedra-gem\.png'/);
  assert.match(mobileOrbSource, /width: size, height: size, padding: 0, border: 'none', background: 'transparent', boxShadow: 'none'/);
  assert.match(mobileOrbSource, /width: '100%', height: '100%', objectFit: 'contain'/);
  assert.doesNotMatch(mobileOrbSource, /poliedron-orb__base/);
  assert.doesNotMatch(mobileOrbSource, /poliedron-orb__halo/);
});

// ---------------------------------------------------------------------------
// Product Owner revision — compact mobile dock and magnetic redock
// ---------------------------------------------------------------------------

test('mobile dock has exactly HOME, AGENDA, POLIEDRON, PAZIENTI, CHAT in that order (POL-UI-015: Setup moved to the central Poliedron panel)', () => {
  const ids = [...mobileDockSource.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(ids.slice(0, 5), ['home', 'agenda', '__poliedron__', 'paz', 'chat']);
  assert.equal(ids.slice(0, 5).length, 5);
});

/* POL-CHAT-001 merge: PR #51 shipped the Chat dock slot as a PLACEHOLDER
   that called `onToggle` (reopening the quick panel) because no Chat route
   existed yet, and its test pinned exactly that. PR #53 provides the real
   persistent Chat, so the slot now navigates to the Chat page like every
   other dock item. The "one Poliedron" principle is unchanged and is
   re-asserted here: the dock must not mount a Poliedron of its own, and the
   Chat page is a portal host the single instance renders into. */
test('mobile dock Chat button opens the real persistent Chat page, not the placeholder quick panel', () => {
  assert.doesNotMatch(mobileDockSource, /if \(item\.id === 'chat'\)[\s\S]{0,400}onClick=\{onToggle\}/);
  assert.match(mobileDockSource, /onClick=\{\(\) => setPage\(item\.id\)\}/);
  const ids = [...mobileDockSource.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
  assert.ok(ids.includes('chat'), 'the dock still routes to the chat page id');
});

/* POL-CHAT-001 §FASE 9: the unread badge belongs to the notification bell
   only. The dock's Chat slot must NOT duplicate the same count. */
test('mobile dock carries no duplicate unread badge and mounts no second Poliedron', () => {
  assert.doesNotMatch(mobileDockSource, /unreadCount/);
  assert.doesNotMatch(mobileDockSource, /poliedron-mobile-dock__badge/);
  // The only Poliedron surface the dock mounts is the shared central orb.
  assert.equal((mobileDockSource.match(/<PoliedronOrb/g) || []).length, 1);
  assert.doesNotMatch(mobileDockSource, /<Poliedron\b/);
});

test('mobile dock exposes only four icon routes plus the central Poliedron hero slot', () => {
  assert.match(mobileDockSource, /data-slot="poliedron"/);
  // POL-CHAT-001 §FASE 9: every slot keeps its plain accessible name; the
  // unread count is announced by the bell, which owns it.
  assert.match(mobileDockSource, /aria-label=\{item\.label\}/);
  assert.match(mobileDockSource, /aria-current=\{active \? 'page'/);
  assert.match(mobileDockSource, /s=\{22\}/);
  assert.match(premiumCss, /poliedron-mobile-dock__item\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
});

test('mobile dock uses semantic Light/Dark tokens, glass blur, safe-area bottom, and no layout reservation', () => {
  assert.match(premiumCss, /\.poliedron-mobile-dock\s*\{[\s\S]*bottom:\s*calc\(16px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(premiumCss, /width:\s*min\(84vw, 390px,/);
  assert.match(premiumCss, /background:\s*color-mix\(in srgb, var\(--surface-interactive\)/);
  assert.match(premiumCss, /border:\s*1px solid var\(--border-medium\)/);
  assert.match(premiumCss, /backdrop-filter:\s*blur\(18px\)/);
  assert.doesNotMatch(appSource, /paddingBottom:[\s\S]{0,100}(64px|92px|110px|120px)/);
});

test('mobile dock recedes and becomes non-interactive while the command panel is open', () => {
  assert.match(mobileDockSource, /open \? ' is-receded'/);
  assert.match(mobileDockSource, /aria-hidden=\{open \? 'true'/);
  assert.match(mobileDockSource, /tabIndex=\{open \? -1 : 0\}/);
  assert.match(premiumCss, /\.poliedron-mobile-dock\.is-receded\s*\{[\s\S]*pointer-events:\s*none;/);
});

test('mobile primary navigation closes and clears a persisted patient detail overlay', () => {
  assert.match(appSource, /const navigateFromPoliedron[\s\S]*setSchedaDashPaz\(null\);[\s\S]*pulisciPosizione\(\['schedaPazId', 'schedaPazTab'\]\);[\s\S]*setPage\(nextPage\)/);
  assert.match(appSource, /<Poliedron[\s\S]*setPage=\{navigateFromPoliedron\}/);
});

test('mobile layout defaults to a physically centered, elevated docked orb', () => {
  const size = computeMobileOrbSize(390);
  const layout = getPoliedronMobileDockLayout({ viewportWidth: 390, viewportHeight: 844, orbSize: size });
  assert.equal(layout.dockedPosition.x + size / 2, 195);
  assert.equal(
    layout.dockedPosition.y + size / 2,
    layout.dockRect.top + layout.dockRect.height / 2 - MOBILE_ORB_CENTER_ELEVATION
  );
  assert.ok(Math.abs((26 - MOBILE_ORB_CENTER_ELEVATION) - (1.5 * 96 / 25.4)) < 0.001);
  assert.ok(layout.dockRect.width >= 390 * 0.78 && layout.dockRect.width <= 390 * 0.88);
});

test('mobile dock and protected zone account for safe-area bottom without overflowing', () => {
  const size = computeMobileOrbSize(375);
  const layout = getPoliedronMobileDockLayout({
    viewportWidth: 375,
    viewportHeight: 812,
    orbSize: size,
    safeAreaInsets: { top: 44, right: 0, bottom: 34, left: 0 },
  });
  assert.equal(layout.dockRect.bottom, 812 - 34 - 16);
  const bounds = getPoliedronSafeBounds({
    viewportWidth: 375,
    viewportHeight: 812,
    orbWidth: size,
    orbHeight: size,
    safeAreaInsets: { top: 44, right: 0, bottom: 34, left: 0 },
    protectedBottomZone: layout.protectedBottomZone,
  });
  assert.ok(bounds.maxY + size < layout.dockRect.top);
});

test('magnetic redock snaps only releases inside the center slot zone', () => {
  const size = computeMobileOrbSize(390);
  const layout = getPoliedronMobileDockLayout({ viewportWidth: 390, viewportHeight: 844, orbSize: size });
  const center = {
    x: layout.dockedPosition.x + size / 2,
    y: layout.dockedPosition.y + size / 2,
  };
  assert.equal(shouldRedock({ pointerX: center.x, pointerY: center.y, layout }), true);
  assert.equal(shouldRedock({ pointerX: 24, pointerY: 220, layout }), false);
});

test('dock protection ramps continuously from docked center to detached safe bounds', () => {
  const size = computeMobileOrbSize(390);
  const layout = getPoliedronMobileDockLayout({ viewportWidth: 390, viewportHeight: 844, orbSize: size });
  const centerY = layout.dockedPosition.y + size / 2;
  const centerX = layout.dockedPosition.x + size / 2;
  const innerEdge = layout.redockZone.right;
  const outerEdge = layout.attractionZone.right;
  assert.equal(getDockProtectionProgress({ pointerX: centerX, pointerY: centerY, layout }), 0);
  assert.ok(getDockProtectionProgress({ pointerX: (innerEdge + outerEdge) / 2, pointerY: centerY, layout }) > 0);
  assert.equal(getDockProtectionProgress({ pointerX: outerEdge + 1, pointerY: centerY, layout }), 1);
  const position = { x: outerEdge - size / 2, y: layout.protectedBottomZone.top - size - layout.protectedBottomZone.gap };
  const atBoundary = applyRedockAttraction({ position, pointerX: outerEdge, pointerY: centerY, layout });
  const justOutside = applyRedockAttraction({ position, pointerX: outerEdge + 0.001, pointerY: centerY, layout });
  assert.ok(Math.abs(atBoundary.x - justOutside.x) < 0.001);
  assert.ok(Math.abs(atBoundary.y - justOutside.y) < 0.001);
});

test('outside the attraction zone a detached drop remains exactly where released with no random edge snap', () => {
  const size = computeMobileOrbSize(390);
  const layout = getPoliedronMobileDockLayout({ viewportWidth: 390, viewportHeight: 844, orbSize: size });
  const released = { x: 133, y: 240 };
  assert.deepEqual(applyRedockAttraction({
    position: released,
    pointerX: 150,
    pointerY: 280,
    layout,
  }), released);
  assert.doesNotMatch(mobilePositionSource, /decideSnapX/);
});

test('mobile drag preserves pointerStart, orbStart, grabOffset, capture, cancel, and detached persistence semantics', () => {
  for (const token of ['pointerStart', 'orbStart', 'grabOffset', 'setPointerCapture', 'releasePointerCapture', 'pointercancel']) {
    assert.match(mobilePositionSource, new RegExp(token));
  }
  assert.match(mobilePositionSource, /mode:\s*'detached'/);
  assert.match(mobilePositionSource, /positionFromFraction/);
  assert.match(mobilePositionSource, /persistDocked\(\)/);
});

test('768px is explicitly desktop mode: the existing <720 breakpoint shows Edge Dock only', () => {
  assert.match(mobileBreakpointSource, /const BREAKPOINT = 720/);
  assert.equal(768 < 720, false);
  assert.match(premiumCss, /@media \(min-width: 720px\)\s*\{[\s\S]*\.poliedron-mobile-dock \{ display: none; \}/);
});

test('desktop panel animation preserves the translateX centering contract', () => {
  assert.match(
    premiumCss,
    /@keyframes poliedron-panel-pop\s*\{[^}]*translateX\(-50%\)[^}]*\}[^}]*to\s*\{\s*transform:\s*translateX\(-50%\)/s
  );
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

test('desktop Edge Dock persists the required side and verticalPosition shape', () => {
  const source = readFileSync(new URL('../src/components/poliedron/usePoliedronEdgePosition.js', import.meta.url), 'utf8');
  assert.match(source, /const next = \{ side, verticalPosition:/);
  assert.match(source, /parsed\.verticalFrac/); // backward-compatible read of the existing v1 shape
  assert.match(source, /pendingSwitchAtRelease = shouldSwitch/);
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

test('resolveCommandAlias: ric resolves Ricette only after explicit navigation intent', () => {
  assert.deepEqual(resolveCommandAlias('ric'), { navId: 'archivio', filtroTipo: 'ricetta' });
});

test('resolveCommandAlias: rice/ricetta/ricette target the real filtered Archivio destination', () => {
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

test('resolveCommandAlias: pre, spe, and doc target verified existing destinations', () => {
  assert.equal(resolveCommandAlias('pre').navId, 'piani');
  assert.equal(resolveCommandAlias('spe').navId, 'spese');
  assert.deepEqual(resolveCommandAlias('doc'), { navId: 'archivio', filtroTipo: 'tutti' });
});

test('§19 ambiguity: "ric" suggestions include Ricette and Richiami without guessing', () => {
  const rich = resolveCommandAlias('rich');
  const suggestions = resolveCommandAliasSuggestions('ric', NAVIGATION_INDEX);
  assert.deepEqual(suggestions.slice(0, 2).map((item) => item.label), ['Ricette', 'Richiami']);
  assert.equal(rich.navId, 'richiami');
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

test('processQuery: a bare command alias stays in Poliedron as a ranked suggestion', async () => {
  const result = await processQuery({
    query: 'pag',
    context: buildContext(),
    permissions: {},
    sources: { navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
  });
  assert.equal(result.intent, INTENT.SEARCH);
  assert.equal(result.directNavigation, undefined);
  assert.equal(result.searchResults[0].items[0].label, 'Incassi e pagamenti');
  assert.equal(result.suggestionBoard, true);
});

test('processQuery: bare local aliases suggest without touching the model gateway', async () => {
  const throwingClient = new Proxy({}, {
    get() { throw new Error('model gateway must not be touched for a local alias'); },
  });
  const result = await processQuery({
    query: 'age',
    context: buildContext(),
    permissions: {},
    sources: { navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
    supabaseClient: throwingClient,
  });
  assert.equal(result.directNavigation, undefined);
  assert.equal(result.searchResults[0].items[0].label, 'Agenda');
});

test('processQuery: an exact alias never direct-opens a destination filtered out by permissions', async () => {
  const navigationIndex = NAVIGATION_INDEX.filter((item) => item.id !== 'spese');
  const result = await processQuery({
    query: 'spe',
    context: buildContext(),
    permissions: {},
    sources: { navigationIndex, actions: ACTION_REGISTRY },
  });
  assert.equal(result.directNavigation, undefined);
});

test('processQuery: ambiguous short prefix stays in normal grouped results instead of direct navigation', async () => {
  const result = await processQuery({
    query: 'ri',
    context: buildContext(),
    permissions: {},
    sources: { navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
  });
  assert.equal(result.directNavigation, undefined);
  assert.ok(Array.isArray(result.searchResults));
});

test('processQuery: "ric" suggests both Ricette and Richiami without starting a workflow', async () => {
  const result = await processQuery({
    query: 'ric',
    context: buildContext(),
    permissions: {},
    sources: { navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
  });
  assert.equal(result.directNavigation, undefined);
  assert.equal(result.intent, INTENT.SEARCH);
  assert.deepEqual(result.searchResults[0].items.slice(0, 2).map((item) => item.label), ['Ricette', 'Richiami']);
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

test('suggest-first regression matrix: bare aliases never navigate and rank authoritative destinations', async () => {
  const patients = [{ id: 'p1', nome: 'Mario', cognome: 'Rossi', cf: '', telefono: '' }];
  const sources = { patients, navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY };
  const expectedFirstSuggestion = new Map([
    ['fat', 'Fatture'],
    ['fatture', 'Fatture'],
    ['ricetta', 'Ricette'],
    ['pag', 'Incassi e pagamenti'],
    ['agenda', 'Agenda'],
  ]);

  for (const query of ['fat', 'fatture', 'ric', 'ricetta', 'pag', 'agenda', 'pazienti', 'preventivi', 'spese', 'costi', 'documenti', 'richiami']) {
    const result = await processQuery({ query, context: buildContext(), permissions: {}, sources, allowModel: false });
    assert.equal(result.directNavigation, undefined, query);
    assert.equal(result.intent, INTENT.SEARCH, query);
    if (expectedFirstSuggestion.has(query)) {
      assert.equal(result.searchResults[0].items[0].label, expectedFirstSuggestion.get(query), query);
    }
  }

  const ric = await processQuery({ query: 'ric', context: buildContext(), permissions: {}, sources, allowModel: false });
  assert.deepEqual(ric.searchResults[0].items.slice(0, 2).map((item) => item.label), ['Ricette', 'Richiami']);

  const patient = await processQuery({ query: 'Rossi', context: buildContext(), permissions: {}, sources, allowModel: false });
  assert.equal(patient.directNavigation, undefined);
  assert.equal(patient.searchResults[0].group, 'PAZIENTI');
  assert.equal(patient.searchResults[0].items[0].label, 'Mario Rossi');
});

test('explicit navigation regression matrix resolves real permission-filtered destinations', async () => {
  const sources = { navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY };
  const cases = [
    ['apri fatture', { navId: 'archivio', filtroTipo: 'fattura' }],
    ['vai ai pagamenti', { navId: 'paga', filtroTipo: null }],
    ['apri ricette', { navId: 'archivio', filtroTipo: 'ricetta' }],
    ['apri richiami', { navId: 'richiami', filtroTipo: null }],
    ['vai in agenda', { navId: 'agenda', filtroTipo: null }],
  ];
  for (const [query, destination] of cases) {
    const result = await processQuery({ query, context: buildContext(), permissions: {}, sources, allowModel: false });
    assert.equal(result.intent, INTENT.NAVIGATE, query);
    assert.deepEqual(result.directNavigation, destination, query);
  }
});

test('operational verbs gate workflows while noun-plus-patient phrases remain non-writing searches', async () => {
  const patients = [{ id: 'p1', nome: 'Mario', cognome: 'Rossi', cf: '', telefono: '' }];
  const sources = { patients, navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY };

  const prescription = await processQuery({
    query: 'crea ricetta per Rossi',
    context: buildContext(),
    permissions: {},
    sources,
    allowModel: false,
  });
  assert.equal(prescription.intent, 'WORKFLOW');
  assert.equal(prescription.suggestedActions[0].id, 'prescription.create');

  const payment = await processQuery({
    query: 'registra pagamento 300 euro Rossi',
    context: buildContext(),
    permissions: {},
    sources,
    allowModel: false,
  });
  assert.equal(payment.intent, INTENT.UPDATE);
  assert.equal(payment.suggestedActions[0].id, 'payment.create');
  assert.equal(payment.entities.amount, 300);

  const appointment = await processQuery({
    query: 'nuovo appuntamento Rossi domani alle 10',
    context: buildContext(),
    permissions: {},
    sources,
    allowModel: false,
  });
  assert.equal(appointment.intent, INTENT.CREATE);
  assert.equal(appointment.suggestedActions[0].id, 'appointment.create');

  for (const query of ['ricetta Rossi', 'pagamento Rossi']) {
    const result = await processQuery({ query, context: buildContext(), permissions: {}, sources, allowModel: false });
    assert.equal(result.intent, INTENT.SEARCH, query);
    assert.equal(result.confirmationRequired, false, query);
    assert.equal(result.directNavigation, undefined, query);
  }
});

// ---------------------------------------------------------------------------
// PO round 4 — explicit additional coverage requested by name
// ---------------------------------------------------------------------------

test('bottom safe zone: dragging the orb all the way to the bottom of the viewport never crosses the safety margin', () => {
  const bounds = getPoliedronSafeBounds({ viewportWidth: 375, viewportHeight: 812, orbWidth: 100, orbHeight: 100, additionalSafetyMargin: 20 });
  // Drag toward a pointer position far below the screen — the whole orb's
  // bounding box (not just its center) must still respect the margin.
  const pos = computeDragPosition({ pointerX: 100, pointerY: 5000, grabOffsetX: 50, grabOffsetY: 50, bounds });
  assert.equal(pos.y, bounds.maxY);
  assert.ok(pos.y + 100 <= 812 - 20); // orb's bottom edge stays inside the safety margin
});

test('bottom safe zone: an inset-heavy device (home indicator) pushes the bottom limit up further still', () => {
  const bounds = getPoliedronSafeBounds({
    viewportWidth: 375, viewportHeight: 812, orbWidth: 100, orbHeight: 100, additionalSafetyMargin: 20,
    safeAreaInsets: { top: 0, right: 0, bottom: 34, left: 0 },
  });
  const pos = computeDragPosition({ pointerX: 100, pointerY: 5000, grabOffsetX: 50, grabOffsetY: 50, bounds });
  assert.ok(pos.y + 100 <= 812 - 34 - 20); // clears both the safety margin AND the home-indicator inset
});

test('persisted position out-of-viewport (e.g. saved on a tablet, reopened on a phone) is reclamped to a valid position', () => {
  const savedOnTablet = getPoliedronSafeBounds({ viewportWidth: 1024, viewportHeight: 1366, orbWidth: 100, orbHeight: 100, additionalSafetyMargin: 20 });
  // Parked at the extreme bottom-right on the wide/tall device.
  const frac = fractionFromPosition({ x: savedOnTablet.maxX, y: savedOnTablet.maxY, bounds: savedOnTablet });
  assert.deepEqual(frac, { xFrac: 1, yFrac: 1 });

  const reopenedOnPhone = getPoliedronSafeBounds({ viewportWidth: 320, viewportHeight: 480, orbWidth: 100, orbHeight: 100, additionalSafetyMargin: 20 }); // small/legacy phone viewport
  const reclamped = positionFromFraction({ xFrac: frac.xFrac, yFrac: frac.yFrac, bounds: reopenedOnPhone });
  assert.ok(reclamped.x >= reopenedOnPhone.minX && reclamped.x <= reopenedOnPhone.maxX, 'x must be inside the new, smaller viewport');
  assert.ok(reclamped.y >= reopenedOnPhone.minY && reclamped.y <= reopenedOnPhone.maxY, 'y must be inside the new, smaller viewport');
  // 1.0 fraction re-expands to exactly maxX/maxY on the new bounds too.
  assert.equal(reclamped.x, reopenedOnPhone.maxX);
  assert.equal(reclamped.y, reopenedOnPhone.maxY);
});

test('POL-AI-002B: a permitted bare section name suggests first without a model call', async () => {
  assert.equal(resolveCommandAlias('listino'), null);
  const intent = classifyIntent('listino', { navigationIndex: NAVIGATION_INDEX });
  assert.equal(intent.type, INTENT.SEARCH);
  const result = await processQuery({
    query: 'listino',
    context: buildContext(),
    permissions: {},
    sources: { navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
  });
  assert.equal(result.directNavigation, undefined);
  assert.equal(result.searchResults[0].items[0].label, 'Listino');
});

test('rule 6: command aliases retain real destinations for explicit navigation', () => {
  for (const navItem of NAVIGATION_INDEX) {
    const bareLabelIsCommandAlias = COMMAND_ALIASES[navItem.label.toLowerCase()] != null;
    if (bareLabelIsCommandAlias) {
      // The few sections whose full label IS also a registered command
      // (e.g. "agenda") must resolve to themselves, never a different page.
      assert.equal(COMMAND_ALIASES[navItem.label.toLowerCase()].navId, navItem.id);
    }
  }
});
