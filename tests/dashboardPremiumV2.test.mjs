import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { suggestedIdle } from '../src/lib/poliedron/searchEngine.js';
import { NAVIGATION_INDEX } from '../src/lib/poliedron/navigationIndex.js';
import { createDefaultHomeLayout, getHomeWidget } from '../src/lib/homeWidgetRegistry.js';
import { createRolePresetLayout, HOME_PRESETS } from '../src/lib/homeDashboardModel.js';

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
const poliedronHubSrc = await readFile(new URL('../src/components/PoliedronHub.jsx', import.meta.url), 'utf8');

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
  const mediaBlockMatch = /@media \(max-width: 719px\) \{\r?\n\s*\.home-poliedron-widget__track/.exec(premiumCss);
  const mediaBlockIdx = mediaBlockMatch?.index ?? -1;
  assert.ok(baseIdx > -1 && mediaBlockIdx > -1, 'expected to find both the base rule and the mobile media block');
  assert.ok(baseIdx < mediaBlockIdx, 'the base display:none rule must come BEFORE the @media override in source order');
});

test('Consigli Poliedron cards sit in a scroll-snap track, one card per mobile viewport, desktop untouched (no media query = no-op)', () => {
  // POL-UI-025: Consigli Poliedron moved off Home into its own dedicated
  // page (PoliedronHub.jsx) — the CSS classes/rules are unchanged and
  // reused as-is, only the component that renders them moved.
  assert.match(poliedronHubSrc, /home-poliedron-widget__track/);
  assert.match(poliedronHubSrc, /home-poliedron-widget__card/);
  assert.match(dashboardSrc, /home-poliedron-widget__gem/); // the fixed "Poliedron" teaser card on Home still uses the same family
  assert.match(premiumCss, /\.home-poliedron-widget__track \{\s*display: flex;\s*gap: 10px;\s*overflow-x: auto;\s*scroll-snap-type: x mandatory;/);
  assert.match(premiumCss, /\.home-poliedron-widget__card \{\s*flex: 0 0 100%;\s*scroll-snap-align: center;/);
});

// --- 7/8. POLIEDRON BELL (real Chat entry point after POL-CHAT-001) --------
// POL-CHAT-001 merge: POL-UI-015 could only ship the bell as a UI-only
// placeholder (unreadCount had no producer, the click reopened the quick
// panel). PR #53 supplies both: the real unread count and the real Chat
// destination. The approved component and its approved positioning stay.

test('the bell itself still owns no notification engine — the count is supplied by the conversation layer, not polled here', () => {
  assert.doesNotMatch(bellSrc, /setInterval|fetch\(|supabase/);
  assert.match(bellSrc, /unreadCount = 0/); // safe default when no count is passed
  // the placeholder PROP on the controller is gone: the real value comes from
  // usePoliedronConversation(), and re-declaring it would freeze it at 0.
  assert.doesNotMatch(poliedronSrc, /unreadCount = 0,/);
  assert.match(poliedronSrc, /usePoliedronConversation\(/);
});

test('the bell opens the SAME single Poliedron — now its persistent Chat page — carrying the real unread count, never a second agent', () => {
  assert.match(poliedronSrc, /\{page !== 'chat' && \(\s*<PoliedronBell/);
  assert.match(poliedronSrc, /variant=\{isMobile \? 'mobile' : 'desktop'\}/);
  assert.match(poliedronSrc, /unreadCount=\{unreadCount\}/);
  assert.match(poliedronSrc, /onOpenChat=\{\(\) => setPage\('chat'\)\}/);
  assert.match(bellSrc, /onClick=\{onOpenChat\}/);
  // the Chat page is this same instance portalled into App.jsx's host
  assert.match(poliedronSrc, /ReactDOM\.createPortal\(/);
});

test('bell positioning never shares vertical space with the mobile dock (fixed above its top edge, not beside it)', () => {
  assert.match(premiumCss, /\.poliedron-bell--mobile \{[\s\S]*bottom:\s*calc\(16px \+ 64px \+ 14px/);
});

// --- 9. DOCK: CHAT REPLACES IMPOSTAZIONI ------------------------------------

test('mobile dock no longer has a Setup/Impostazioni slot; Chat opens the same Poliedron conversation, not a second page', () => {
  assert.doesNotMatch(dockSrc, /id: 'set'/);
  assert.match(dockSrc, /id: 'chat', label: 'Chat', icon: 'chat'/);
  // POL-CHAT-001 merge: the placeholder branch that reopened the quick panel
  // (`if (item.id === 'chat') ... onClick={onToggle}`) is gone. Chat now uses
  // the same generic navigation path as every other slot — still ONE
  // Poliedron, because the Chat page is that same instance portalled into
  // App.jsx's chat host. POL-CHAT-001 §FASE 9: the unread badge lives on the
  // bell only, so this slot must not carry a duplicate of the same count.
  assert.doesNotMatch(dockSrc, /if \(item\.id === 'chat'\) \{[\s\S]*onToggle/);
  assert.match(dockSrc, /onClick=\{\(\) => setPage\(item\.id\)\}/);
  assert.doesNotMatch(dockSrc, /poliedron-mobile-dock__badge/);
  assert.match(bellSrc, /poliedron-bell__badge/);
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

// =============================================================================
// ROUND 2 — Product Owner rejected the first draft PR: the Richiami widget
// was still invisible in the real preview, and personalization still didn't
// save. Both were real, found via a proper end-to-end browser QA harness
// (open editor → toggle → save → reload), not by re-reading the same code.
// =============================================================================

// --- BUG 1: Richiami widget invisible in the real Dashboard preview --------

test('ROOT CAUSE 1: richiami is defaultVisible so it shows up out of the box, not only when manually added via Personalizza Home', () => {
  const widget = getHomeWidget('richiami');
  assert.equal(widget.defaultVisible, true);
});

test('richiami is visible in the platform-default layout (no role, no saved layout)', () => {
  const layout = createDefaultHomeLayout();
  const richiami = layout.find((w) => w.id === 'richiami');
  assert.equal(richiami.visible, true);
});

test('ROOT CAUSE 1b: the owner/admin role preset — the Product Owner\'s own likely test account — was missing richiami entirely, hiding an otherwise fully-working widget', () => {
  assert.ok(HOME_PRESETS.owner.includes('richiami'), 'expected richiami in the owner preset');
  const ownerLayout = createRolePresetLayout(['home.owner']);
  const richiami = ownerLayout.find((w) => w.id === 'richiami');
  assert.equal(richiami.visible, true, 'richiami must be visible for an owner-role Dashboard by default');
});

test('richiami stays visible by default for front_desk too (already correct, unchanged)', () => {
  const layout = createRolePresetLayout(['home.front_desk']);
  assert.equal(layout.find((w) => w.id === 'richiami').visible, true);
});

// --- BUG 2: personalization still not saving — the open-before-load race ---

test('ROOT CAUSE 2: opening "Personalizza Home" is blocked while the initial layout load is still in flight', () => {
  // This is the actual exploitable race: draftWidgets used to be seeded
  // from `widgets` (still the stale platform-default at that point) the
  // instant the user opened the editor, and — by POL-UI-013C's own
  // deliberate design — never resynced while the modal stayed open. The
  // Save button already correctly disabled during layoutLoading, but by
  // the time it re-enabled, the draft had long since been captured stale.
  // Saving from there silently reverted every other already-saved
  // customization back to its default. Verified live via a temporary QA
  // harness with an artificially delayed load: a pre-saved `wa:true`
  // layout was wiped back to `false` on the real backend by this exact
  // sequence before the fix below.
  const buttonBlock = dashboardSrc.slice(dashboardSrc.indexOf('className="home-hero__customize"') - 50, dashboardSrc.indexOf('className="home-hero__customize"') + 300);
  assert.match(buttonBlock, /disabled=\{layoutLoading\}/);
  const openStart = dashboardSrc.indexOf('const openHomeCustomizer');
  const openBody = dashboardSrc.slice(openStart, openStart + 400);
  assert.match(openBody, /if \(layoutLoading\) return;/);
});

test('the load-blocking guard runs before draftWidgets is ever seeded from widgets', () => {
  const openStart = dashboardSrc.indexOf('const openHomeCustomizer');
  const openBody = dashboardSrc.slice(openStart, openStart + 400);
  const guardIdx = openBody.indexOf('if (layoutLoading) return;');
  const seedIdx = openBody.indexOf('setDraftWidgets(widgets.map');
  assert.ok(guardIdx > -1 && seedIdx > -1 && guardIdx < seedIdx, 'the layoutLoading guard must run before draftWidgets is seeded');
});

// --- Salva UX contract (verified already correct, guarded against regressing) -

test('Salva: on success, widgets is updated and the modal closes automatically — before any error path could run', () => {
  const saveStart = dashboardSrc.indexOf('const saveHomeCustomization');
  const saveEnd = dashboardSrc.indexOf('const resetHomeCustomization');
  const saveBody = dashboardSrc.slice(saveStart, saveEnd);
  const setWidgetsIdx = saveBody.indexOf('setWidgets(saved)');
  const closeIdx = saveBody.indexOf('setSettingsOpen(false)');
  assert.ok(setWidgetsIdx > -1 && closeIdx > -1 && setWidgetsIdx < closeIdx, 'expected widgets to update before the modal closes');
});

test('Salva: on failure, the modal stays open and a real error is shown — never a false success', () => {
  const saveStart = dashboardSrc.indexOf('const saveHomeCustomization');
  const saveEnd = dashboardSrc.indexOf('const resetHomeCustomization');
  const saveBody = dashboardSrc.slice(saveStart, saveEnd);
  // POL-UI-015 round 3: the outer catch now receives the error so the real
  // reason (including the new database read-back failures) reaches the user.
  const catchIdx = saveBody.lastIndexOf('catch (error) {');
  assert.ok(catchIdx > -1, 'expected the outer save catch to receive the error');
  const catchBlock = saveBody.slice(catchIdx);
  assert.doesNotMatch(catchBlock, /setSettingsOpen\(false\)/);
  assert.match(catchBlock, /setLayoutError\(/);
  assert.match(catchBlock, /error\?\.message/);
});
