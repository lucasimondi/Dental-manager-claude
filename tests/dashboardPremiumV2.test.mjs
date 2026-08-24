import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { suggestedIdle } from '../src/lib/poliedron/searchEngine.js';
import { NAVIGATION_INDEX } from '../src/lib/poliedron/navigationIndex.js';

/* POL-UI-015 — Dashboard premium v2 (persistence root cause, Richiami
   widget, mobile fullscreen, floating hero, dock clearance, Consigli
   carousel, Poliedron bell, dock Chat entry, Impostazioni via the central
   panel). Source-level tests follow the same convention already used by
   tests/dashboardPersonalization.test.mjs and tests/homeLayoutPrecedenceRace
   .test.mjs — this repo's `npm test` has no React rendering harness. */

const dashboardSrc = await readFile(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const appSrc = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const premiumCss = await readFile(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');
const bellSrc = await readFile(new URL('../src/components/poliedron/PoliedronBell.jsx', import.meta.url), 'utf8');
const poliedronSrc = await readFile(new URL('../src/components/poliedron/Poliedron.jsx', import.meta.url), 'utf8');
const dockSrc = await readFile(new URL('../src/components/poliedron/PoliedronMobileDock.jsx', import.meta.url), 'utf8');

// --- 1. PERSISTENCE ROOT CAUSE FIX -----------------------------------------

test('ROOT CAUSE: Dashboard no longer re-fetches userId via its own getSession() call — it is a prop, exactly like studioId', () => {
  assert.doesNotMatch(dashboardSrc, /setUserId/);
  assert.match(dashboardSrc, /const userId = currentUserId \|\| null;/);
  assert.match(dashboardSrc, /currentUserId(?:,|\s*})/);
});

test('App.jsx passes currentUserId to Dashboard from the same authoritative session state used for studioId', () => {
  assert.match(appSrc, /<Dashboard[\s\S]{0,600}currentUserId=\{session\?\.user\?\.id\}/);
});

test('the Home-layout load effect still guards on both studioId and userId before running (unchanged safety)', () => {
  assert.match(dashboardSrc, /if \(!studioId \|\| !userId\) return;/);
});

// --- 2. RICHIAMI WIDGET -----------------------------------------------------

test('Richiami widget shows real fields only (paziente/motivo/data/stato-derived scaduto), no invented data', () => {
  const start = dashboardSrc.indexOf("if (w.id === 'richiami')");
  const end = dashboardSrc.indexOf("if (w.id === 'scadenze')");
  const block = dashboardSrc.slice(start, end);
  assert.match(block, /RICHIAMO_CATEGORIE/);
  assert.match(block, /r\.motivo \|\| cat\.label/);
  assert.match(block, /r\.dataScadenza < t2/);
  assert.match(block, /EmptyState icon="bell" title="Nessun richiamo da gestire"/);
});

test('Richiami widget scrolls internally beyond 5 open items instead of growing the Dashboard', () => {
  const start = dashboardSrc.indexOf("if (w.id === 'richiami')");
  const end = dashboardSrc.indexOf("if (w.id === 'scadenze')");
  const block = dashboardSrc.slice(start, end);
  assert.match(block, /const hasOverflow = aperti\.length > 5;/);
  assert.match(block, /maxHeight: 272, overflowY: 'auto'/);
  assert.match(block, /aperti\.slice\(0, hasOverflow \? undefined : 5\)/);
});

test('Richiami widget reuses onGoRichiami (manage) and onOpenPaz (open patient) — never a duplicated mutation path', () => {
  const start = dashboardSrc.indexOf("if (w.id === 'richiami')");
  const end = dashboardSrc.indexOf("if (w.id === 'scadenze')");
  const block = dashboardSrc.slice(start, end);
  assert.match(block, /onGoRichiami && onGoRichiami\(\)/);
  assert.match(block, /if \(paz\) onOpenPaz\(paz, 'info'\)/);
  assert.doesNotMatch(block, /setRichiami\(/);
});

// --- 3. MOBILE FULLSCREEN ----------------------------------------------------

test('ROOT CAUSE of the grey-frame bug: the old !important rule that forced a fixed inset onto Home specifically is gone', () => {
  assert.doesNotMatch(premiumCss, /padding:\s*calc\(16px \+ env\(safe-area-inset-top/);
  assert.match(premiumCss, /body:has\(\.home-widget-grid\) #app-scroll \{\s*padding:\s*0\s*!important;\s*\}/);
});

test('App.jsx zeroes the outer #app-scroll top/left/right inset for Home on mobile, same fullscreen principle as Agenda', () => {
  assert.match(appSrc, /paddingTop:\s*isMobile \? \(\(page === 'agenda' \|\| page === 'home'\) \? 0 :/);
  assert.match(appSrc, /paddingLeft:\s*isMobile \? \(\(page === 'agenda' \|\| page === 'home'\) \?/);
});

test('.home-page owns the real content padding so widgets keep breathing room while the outer shell is edge-to-edge', () => {
  assert.match(premiumCss, /\.home-page \{ padding: 0 15px env\(safe-area-inset-bottom, 0px\); \}/);
});

// --- 4. FLOATING STICKY GREETING/DATE/TIME ----------------------------------

test('mobile hero is sticky/floating with its own top safe-area, not a reintroduced solid header', () => {
  assert.match(premiumCss, /\.home-hero \{[\s\S]*position:\s*sticky;[\s\S]*top:\s*0;[\s\S]*z-index:\s*5;/);
  assert.match(premiumCss, /backdrop-filter:\s*blur\(18px\)/);
});

test('Dashboard renders a live date/time readout alongside the greeting, mobile-only via CSS', () => {
  assert.match(dashboardSrc, /home-hero__datetime/);
  assert.match(dashboardSrc, /fmtDataOra\(now\)/);
  assert.match(premiumCss, /\.home-hero__datetime \{ display: none; \}/);
  assert.match(premiumCss, /@media \(max-width: 600px\) \{[\s\S]*\.home-hero__datetime \{ display: block;/);
});

// --- 5. DOCK CLEARANCE -------------------------------------------------------

test('dock-clearance spacer reuses the canonical dock geometry constants Agenda already imports — no per-device hack', () => {
  assert.match(dashboardSrc, /import \{ MOBILE_DOCK_BOTTOM, MOBILE_DOCK_HEIGHT, MOBILE_DOCK_PROTECTED_GAP \} from '\.\.\/lib\/poliedron\/poliedronMobileDock\.js';/);
  assert.match(dashboardSrc, /className="home-dock-clearance"/);
  assert.match(premiumCss, /\.home-dock-clearance \{ display: none; \}/);
});

// --- 6. CONSIGLI POLIEDRON MOBILE CAROUSEL ----------------------------------

test('REGRESSION GUARD: the base .home-poliedron-widget__dots{display:none} rule must precede its @media override in source order', () => {
  // CSS resolves two same-specificity rules by source position regardless
  // of which one is inside a media query — the dots were silently hidden
  // on mobile the first time this was written with the order reversed.
  const baseIdx = premiumCss.indexOf('.home-poliedron-widget__dots { display: none; }');
  const mediaBlockIdx = premiumCss.indexOf("@media (max-width: 719px) {\n  .home-poliedron-widget__track");
  assert.ok(baseIdx > -1 && mediaBlockIdx > -1, 'expected to find both the base rule and the mobile media block');
  assert.ok(baseIdx < mediaBlockIdx, 'the base display:none rule must come BEFORE the @media override in source order');
});

test('Consigli Poliedron cards sit in a scroll-snap track, one card per mobile viewport, desktop untouched (no media query = no-op)', () => {
  assert.match(dashboardSrc, /home-poliedron-widget__track/);
  assert.match(dashboardSrc, /home-poliedron-widget__card/);
  assert.match(premiumCss, /\.home-poliedron-widget__track \{\s*display: flex;\s*gap: 10px;\s*overflow-x: auto;\s*scroll-snap-type: x mandatory;/);
  assert.match(premiumCss, /\.home-poliedron-widget__card \{\s*flex: 0 0 100%;\s*scroll-snap-align: center;/);
});

// --- 7/8. POLIEDRON BELL (placeholder, same agent) --------------------------

test('PoliedronBell is a UI-only placeholder: no notification engine, unread defaults to 0 everywhere', () => {
  assert.match(bellSrc, /unreadCount = 0/);
  assert.doesNotMatch(bellSrc, /setInterval|fetch\(|supabase/);
  assert.match(poliedronSrc, /unreadCount = 0,/);
});

test('the bell opens the SAME Poliedron conversation as the Orb/Edge Dock — same open/onToggle/panelId, never a second agent', () => {
  assert.match(poliedronSrc, /<PoliedronBell variant=\{isMobile \? 'mobile' : 'desktop'\} open=\{open\} onToggle=\{onToggle\} unreadCount=\{unreadCount\} panelId=\{panelId\} \/>/);
});

test('bell positioning never shares vertical space with the mobile dock (fixed above its top edge, not beside it)', () => {
  assert.match(premiumCss, /\.poliedron-bell--mobile \{[\s\S]*bottom:\s*calc\(16px \+ 64px \+ 14px/);
});

// --- 9. DOCK: CHAT REPLACES IMPOSTAZIONI ------------------------------------

test('mobile dock no longer has a Setup/Impostazioni slot; Chat opens the same Poliedron conversation, not a second page', () => {
  assert.doesNotMatch(dockSrc, /id: 'set'/);
  assert.match(dockSrc, /id: 'chat', label: 'Chat', icon: 'chat'/);
  assert.match(dockSrc, /if \(item\.id === 'chat'\)/);
  assert.match(dockSrc, /onClick=\{onToggle\}/);
});

// --- 10/11. IMPOSTAZIONI REACHABLE FROM THE CENTRAL PANEL / DESKTOP SIDEBAR -

test('Impostazioni (set) is offered by the central Poliedron panel default suggestions now that the dock lost its slot', () => {
  const idle = suggestedIdle({ actions: [], navigationIndex: NAVIGATION_INDEX, context: {} });
  const sectionGroup = idle.find((g) => g.group === 'APRI UNA SEZIONE');
  assert.ok(sectionGroup, 'expected an APRI UNA SEZIONE group');
  assert.ok(sectionGroup.items.some((item) => item.id === 'set'), 'expected Impostazioni (set) among the default suggestions');
});

test('desktop keeps Impostazioni in the sidebar nav (App.jsx NAV, unchanged) — no change needed there', async () => {
  const utilsSrc = await readFile(new URL('../src/lib/utils.js', import.meta.url), 'utf8');
  assert.match(utilsSrc, /\{ id: 'set', l: 'Setup', ic: 'set' \}/);
});
