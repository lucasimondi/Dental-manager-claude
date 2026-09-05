import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  HOME_ATTENTION_EMPTY_LABEL, HOME_ATTENTION_MAX_ITEMS,
  buildHomeAttentionItems, findNextAppointmentToday,
} from '../src/lib/homeAttention.js';
import {
  DEFAULT_QUICK_ACTION_IDS, QUICK_ACTIONS_CATALOG, getQuickAction, resolveQuickActions,
} from '../src/lib/quickActionsCatalog.js';
import { HOME_WIDGET_REGISTRY, createDefaultHomeLayout, setHomeWidgetConfig } from '../src/lib/homeWidgetRegistry.js';
import { getMobileShellMode } from '../src/lib/mobileShell.js';
import { MOBILE_DOCK_BOTTOM, MOBILE_DOCK_HEIGHT, MOBILE_DOCK_PROTECTED_GAP } from '../src/lib/poliedron/poliedronMobileDock.js';

/* POL-UI-017 ROUND 2 — mobile Home and navigation refresh.

   Behavioral facts (the priority-area selector, the shell boundaries, the
   dock geometry) are tested as real units. Facts that are about rendered
   markup or stylesheet contracts are verified at the source level, the
   same convention every other Home test in this repo already uses —
   `npm test` is plain `node --test`, there is no React rendering harness
   (see package.json). */

const dashboardSrc = await readFile(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const premiumCss = await readFile(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');
const dockSrc = await readFile(new URL('../src/components/poliedron/PoliedronMobileDock.jsx', import.meta.url), 'utf8');
const bellSrc = await readFile(new URL('../src/components/poliedron/PoliedronBell.jsx', import.meta.url), 'utf8');
const quickActionsCatalogSrc = await readFile(new URL('../src/lib/quickActionsCatalog.js', import.meta.url), 'utf8');
const impostazioniSrc = await readFile(new URL('../src/components/Impostazioni.jsx', import.meta.url), 'utf8');
const appSrc = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const docMedicoSrc = await readFile(new URL('../src/components/DocMedico.jsx', import.meta.url), 'utf8');
const schedaPazSrc = await readFile(new URL('../src/components/SchedaPaz.jsx', import.meta.url), 'utf8');

const round2Css = premiumCss.slice(premiumCss.indexOf('POL-UI-017 ROUND 2'));

const MOBILE_MEDIA = "@media (max-width: 719px), (pointer: coarse) and (max-width: 1024px) and (max-height: 600px) {";

const richiamo = (id, dataScadenza, stato = 'da_fare') => ({ id, dataScadenza, stato, pazienteId: 'p1' });

// ===========================================================================
// §2 — "Richiede attenzione": the priority area
// ===========================================================================

test('the priority area raises overdue richiami first, using the same open/overdue rule the Richiami widget uses', () => {
  const items = buildHomeAttentionItems({
    today: '2026-08-28',
    richiami: [
      richiamo('a', '2026-08-20'),          // overdue
      richiamo('b', '2026-08-27'),          // overdue
      richiamo('c', '2026-08-28'),          // due today
      richiamo('d', '2026-09-10'),          // future -> not raised
      richiamo('e', '2026-08-01', 'fatto'), // closed -> never raised
    ],
  });
  assert.equal(items[0].id, 'richiami_scaduti');
  assert.equal(items[0].count, 2);
  assert.equal(items[0].tone, 'danger');
  assert.equal(items[0].action, 'richiami');
  const dueToday = items.find((i) => i.id === 'richiami_oggi');
  assert.equal(dueToday.count, 1);
  assert.equal(dueToday.tone, 'warn');
});

test('urgency ordering is danger before warning before informational', () => {
  const items = buildHomeAttentionItems({
    today: '2026-08-28',
    nowTime: '09:00',
    richiami: [richiamo('a', '2026-08-01'), richiamo('b', '2026-08-28')],
    todayAppointments: [{ id: 1, ora: '11:30', tipo: 'Visita' }],
    overduePlanDeadlines: 3,
  });
  assert.deepEqual(items.map((i) => i.tone), ['danger', 'danger', 'warn', 'info']);
});

test('an imminent appointment is raised from the SAME today-list the Agenda widget renders, never re-queried', () => {
  const todayAppointments = [
    { id: 1, ora: '08:00', tipo: 'Igiene', pazienteId: 'p1' },
    { id: 2, ora: '15:30', tipo: 'Controllo', pazienteId: 'p2' },
  ];
  assert.equal(findNextAppointmentToday(todayAppointments, '09:10').id, 2);
  assert.equal(findNextAppointmentToday(todayAppointments, '18:00'), null);

  const items = buildHomeAttentionItems({
    today: '2026-08-28', nowTime: '09:10', todayAppointments,
    patientNameOfAppointment: () => 'Mario Rossi',
  });
  const next = items.find((i) => i.id === 'prossimo_appuntamento');
  assert.equal(next.label, 'Prossimo appuntamento 15:30');
  assert.equal(next.detail, 'Mario Rossi');
  assert.equal(next.action, 'agenda');
});

test('a day whose appointments have all passed raises no appointment row at all', () => {
  const items = buildHomeAttentionItems({
    today: '2026-08-28', nowTime: '20:00',
    todayAppointments: [{ id: 1, ora: '08:00', tipo: 'Igiene' }],
  });
  assert.equal(items.length, 0);
});

test('FAIL CLOSED: families the caller cannot read contribute nothing (0 in, no row out)', () => {
  // Dashboard passes 0 for scadenze when homePermissions.managementControl
  // is false (useControlloDati is not even enabled then), 0 for advice when
  // the Poliedron advice feature is off, and 0 for reminders when the
  // Attività widget is not on this user's Home.
  const items = buildHomeAttentionItems({
    today: '2026-08-28',
    overduePlanDeadlines: 0,
    unreadAdvice: 0,
    overdueReminders: 0,
  });
  assert.deepEqual(items, []);
});

test('nothing to flag returns an empty list, which the Home renders as ONE compact positive line', () => {
  assert.deepEqual(buildHomeAttentionItems({ today: '2026-08-28' }), []);
  assert.equal(HOME_ATTENTION_EMPTY_LABEL, 'Tutto sotto controllo');
  assert.match(dashboardSrc, /attentionItems\.length === 0 \? \(/);
  assert.match(dashboardSrc, /className="home-attention__clear"/);
  assert.match(dashboardSrc, /\{HOME_ATTENTION_EMPTY_LABEL\}/);
  // The positive state is a single line, not a full-height empty card.
  assert.match(round2Css, /\.home-attention__clear \{[^}]*font-size: 12px;/s);
  assert.doesNotMatch(round2Css, /\.home-attention__clear \{[^}]*min-height/s);
});

test('the priority area never grows back into a long list', () => {
  const items = buildHomeAttentionItems({
    today: '2026-08-28', nowTime: '00:00',
    richiami: [richiamo('a', '2026-08-01'), richiamo('b', '2026-08-28')],
    todayAppointments: [{ id: 1, ora: '10:00', tipo: 'Visita' }],
    overduePlanDeadlines: 2,
    overdueReminders: 4,
    unreadAdvice: 5,
  });
  assert.equal(items.length, HOME_ATTENTION_MAX_ITEMS);
  assert.ok(HOME_ATTENTION_MAX_ITEMS <= 4);
});

test('the priority area owns no data source of its own — it only re-reads what Home already has', async () => {
  const attentionSrc = await readFile(new URL('../src/lib/homeAttention.js', import.meta.url), 'utf8');
  assert.doesNotMatch(attentionSrc, /supabase|fetch\(|from\('|\.select\(|useEffect/);
});

test('every priority row lands on an EXISTING destination, never a duplicated implementation', () => {
  const run = dashboardSrc.slice(dashboardSrc.indexOf('const runAttentionAction'), dashboardSrc.indexOf('const ATTENTION_TONE'));
  assert.match(run, /onGoRichiami && onGoRichiami\(\)/);
  assert.match(run, /onGoAgenda && onGoAgenda\(\)/);
  assert.match(run, /setDetailModal\('scadenze'\)/);
  assert.doesNotMatch(run, /supabase|setRichiami\(|setAppointments\(/);
});

test('rows that point at a widget are only raised when that widget is actually on this user\'s Home', () => {
  assert.match(dashboardSrc, /const isHomeWidgetOnScreen = \(id\) => visibleWidgets\.some/);
  assert.match(dashboardSrc, /overdueReminders: isHomeWidgetOnScreen\('todo'\) \?/);
  // POL-UI-025: the 'consigli' unreadAdvice row was retired along with the
  // consigli_ai Home widget (moved to PoliedronHub.jsx) — Dashboard no
  // longer passes unreadAdvice at all, buildHomeAttentionItems' own
  // default (0) applies.
  assert.doesNotMatch(dashboardSrc, /unreadAdvice:/);
});

test('scadenze are only raised for a user who actually holds the management-control capability', () => {
  assert.match(dashboardSrc, /overduePlanDeadlines: homePermissions\.managementControl \?/);
});

// ===========================================================================
// §11 — hierarchy and the first viewport
// ===========================================================================

test('HIERARCHY: hero, then the priority area, then the widget workspace — in that source order', () => {
  const hero = dashboardSrc.indexOf('<div className="home-hero">');
  const attention = dashboardSrc.indexOf('<section className="home-attention"');
  const workspace = dashboardSrc.indexOf('<div className="home-workspace">');
  const clearance = dashboardSrc.indexOf('className="home-dock-clearance"');
  assert.ok(hero > -1 && attention > -1 && workspace > -1 && clearance > -1);
  assert.ok(hero < attention, 'the priority area must render after the hero');
  assert.ok(attention < workspace, 'the priority area must render BEFORE the widget workspace');
  assert.ok(workspace < clearance, 'the dock clearance stays last');
});

test('the first viewport still carries the Poliedra identity — the hero keeps a real brand mark', () => {
  assert.match(dashboardSrc, /className="home-hero__mark"/);
  assert.match(dashboardSrc, /<img src=\{poliedroGem\}[^>]*className="home-hero__mark"/);
  // Mobile-only: desktop already carries the brand in the premium sidebar.
  assert.match(round2Css, /\.home-hero__mark \{ display: none; \}/);
  assert.match(round2Css, /\.home-hero__mark \{ display: block;/);
});

test('the mobile hero is compact: one row, one greeting line, one info line — no 32px display type', () => {
  const mobileBlock = round2Css.slice(round2Css.indexOf(MOBILE_MEDIA));
  assert.match(mobileBlock, /\.home-hero \{[^}]*flex-wrap: nowrap;/s);
  assert.match(mobileBlock, /\.home-hero__greeting \{[^}]*font-size: 17px;/s);
  assert.match(mobileBlock, /\.home-hero__meta \{ display: none; \}/);
  assert.match(mobileBlock, /\.home-hero__datetime \{[^}]*display: block;/s);
});

test('the hero line reports something operational (today\'s appointment count) without a second row', () => {
  const hero = dashboardSrc.slice(dashboardSrc.indexOf('className="home-hero__datetime"'), dashboardSrc.indexOf('home-hero__actions'));
  assert.match(hero, /fmtDataOra\(now\)/);
  assert.match(hero, /todayApps\.length > 0 \?/);
});

// ===========================================================================
// §3 — quick actions: curated via "Personalizza azioni rapide" in Setup,
// no more on-widget "+"/"Altro" expand toggle (Product Owner follow-up)
// ===========================================================================

test('the default quick-action set is untouched: round 3 only adds new, addable catalog entries', () => {
  // Round 3 grew the catalog (Ricetta/Consenso/Da incassare — see
  // quickActionsCatalog.test.mjs for their own dedicated coverage) but
  // must not change what shows without explicit configuration.
  assert.equal(QUICK_ACTIONS_CATALOG.length, 15);
  assert.deepEqual([...DEFAULT_QUICK_ACTION_IDS],
    ['nuovo_appuntamento', 'apri_agenda', 'nuovo_paziente', 'nuovo_preventivo', 'pagamento', 'richiamo']);
});

test('the mobile progressive-disclosure heuristic (partition/"Altro") is removed as dead code, not just hidden', () => {
  for (const removed of ['partitionQuickActionsForMobile', 'MOBILE_PRIMARY_QUICK_ACTION_IDS', 'MOBILE_QUICK_ACTION_PRIMARY_LIMIT']) {
    assert.doesNotMatch(quickActionsCatalogSrc, new RegExp(removed), `${removed} must be gone from the catalog module`);
    assert.doesNotMatch(dashboardSrc, new RegExp(removed), `${removed} must not be referenced from Home any more`);
  }
  assert.doesNotMatch(dashboardSrc, /quickActionsExpanded|home-quick-actions__more|data-quick-action-overflow|qa-mobile-order/,
    'the on-widget expand toggle and its wiring must be fully gone');
  assert.doesNotMatch(round2Css, /home-quick-actions__more|data-quick-action-overflow|qa-mobile-order|is-expanded/);
});

test('Home renders every configured, allowed quick action directly — no truncation on any breakpoint', () => {
  assert.match(dashboardSrc, /const activeActions = resolveQuickActions\(w\.config\?\.actions, \{ permissions: homePermissions, features, vertical: si\?\.vertical \}\);/);
  assert.match(dashboardSrc, /\{activeActions\.map\(\(action\) => \(/);
  // Same grid/context contract as before: nothing re-routed.
  assert.match(dashboardSrc, /onClick=\{\(\) => action\.run\(quickActionContext\)\}/);
});

test('Home offers a discreet "Personalizza" entry into Impostazioni instead of an inline expand', () => {
  const block = dashboardSrc.slice(dashboardSrc.indexOf("key=\"quick_actions\""), dashboardSrc.indexOf('home-quick-actions__grid'));
  assert.match(block, /onClick=\{\(\) => onNavigate\('set'\)\}/);
  assert.match(block, /Personalizza/);
  assert.match(block, /className="home-list-link"/, 'reuses the same discreet link style Agenda/Richiami already use, no new component');
});

test('the quick-action icon chip no longer uses a filled blue-gradient background — minimal, token-based instead', () => {
  const start = premiumCss.indexOf('.home-quick-actions__icon {');
  const iconRule = premiumCss.slice(start, premiumCss.indexOf('}', start) + 1);
  assert.doesNotMatch(iconRule, /gradient|--pol-blue-50|#dbeafe/);
  assert.match(iconRule, /var\(--pol-bg-alt\)/);
  // No dark-only icon override needed any more — the token already adapts.
  assert.doesNotMatch(premiumCss, /:root\[data-theme="dark"\] \.home-quick-actions__icon/);
});

// ===========================================================================
// §3 follow-up — "Personalizza azioni rapide" relocated to Setup
// (Impostazioni), Product Owner round 2 feedback on the preview
// ===========================================================================

test('Impostazioni gained a dedicated "Azioni rapide" section, reusing the same persistence path Home uses', () => {
  assert.match(impostazioniSrc, /\['azioni_rapide', 'zap', 'Azioni rapide'\]/, 'must be a real tab in the section switcher, not a hidden feature');
  assert.match(impostazioniSrc, /sezione === 'azioni_rapide'/);
  // Same underlying source of truth as Home's own "Personalizza Home" ->
  // "Azioni rapide" tab: full-layout load, config patch, full-layout save.
  // Two entry points, one persisted value — never a second system.
  assert.match(impostazioniSrc, /loadResolvedHomeLayout\(supabase, studioId, currentUserId, createRolePresetLayout\(studioMembership\?\.capabilities\)\)/);
  assert.match(impostazioniSrc, /setHomeWidgetConfig\(qaLayout, 'quick_actions', \{ actions: activeQuickActionIds \}\)/);
  assert.match(impostazioniSrc, /saveUserHomeLayout\(supabase, studioId, currentUserId, nextLayout\)/);
  // Permission-aware, same as Home: an action gated by capability/feature/
  // vertical must not be offered here just because Home hides it too.
  assert.match(impostazioniSrc, /filterQuickActionsCatalog\(\{ permissions: homePermissions, features, vertical: studioInfo\?\.vertical \}\)/);
});

test('App.jsx passes the real studioMembership into Impostazioni so its permission gating is not stubbed', () => {
  const line = appSrc.split('\n').find((l) => l.includes('<Impostazioni '));
  assert.ok(line, 'expected to find the Impostazioni element');
  assert.match(line, /studioMembership=\{studioMembership\}/);
});

test('Impostazioni reserves floating-dock clearance for its own long/scrollable content, on the same canonical mobile contract Home uses', () => {
  assert.match(impostazioniSrc, /className="page-dock-clearance"/);
  assert.match(impostazioniSrc, /MOBILE_DOCK_BOTTOM \+ MOBILE_DOCK_HEIGHT \+ MOBILE_DOCK_PROTECTED_GAP/);
  assert.match(premiumCss, /\.page-dock-clearance \{ display: none; \}/);
  const mobileBlock = round2Css.slice(round2Css.indexOf(MOBILE_MEDIA));
  assert.match(mobileBlock, /\.page-dock-clearance \{ display: block; \}/);
  // The spacer is rendered once, unconditionally, at the end of the whole
  // component's JSX — so it applies to EVERY `sezione` tab (Studio, Team,
  // Azioni rapide, ...), not only the new one.
  assert.ok(impostazioniSrc.indexOf('className="page-dock-clearance"') > impostazioniSrc.lastIndexOf("sezione === '"),
    'the clearance spacer must be outside/after every sezione-gated block, not nested inside one');
});

test('REGRESSION GUARD (round 3 hardening): .page-dock-clearance is declared display:block in BOTH mobile media queries, exact parity with .home-dock-clearance', () => {
  const legacyBlock = premiumCss.slice(premiumCss.indexOf('@media (max-width: 600px)'), premiumCss.indexOf(MOBILE_MEDIA));
  assert.match(legacyBlock, /\.home-dock-clearance \{ display: block; \}/);
  assert.match(legacyBlock, /\.page-dock-clearance \{ display: block; \}/);
  const canonicalBlock = round2Css.slice(round2Css.indexOf(MOBILE_MEDIA));
  assert.match(canonicalBlock, /\.home-dock-clearance \{ display: block; \}/);
  assert.match(canonicalBlock, /\.page-dock-clearance \{ display: block; \}/);
});

test('shared Home Toast remains available for inline patient creation after Da incassare gains a real route', () => {
  assert.match(dashboardSrc, /import \{ [^}]*\bToast\b[^}]*\} from '\.\/ui';/);
  // Round 6 renamed comingSoonMsg -> homeToastMsg, a generic Home toast
  // state now also used to confirm inline patient creation (see below).
  assert.match(dashboardSrc, /const \[homeToastMsg, setHomeToastMsg\] = useState\(''\);/);
  assert.match(dashboardSrc, /\{homeToastMsg && <Toast msg=\{homeToastMsg\} onDone=\{\(\) => setHomeToastMsg\(''\)\} \/>\}/);
});

// ===========================================================================
// ROUND 4 — "Ricetta deve aprire il tab ricetta, non paziente"
// ===========================================================================

test('ROUND 4: Home wires a real patient picker for Ricetta, landing on DocMedico\'s Ricetta tab via the existing initialDocumentRequest mechanism', () => {
  assert.match(dashboardSrc, /openRicettaPicker: \(\) => setRicettaPickerOpen\(true\)/);
  assert.match(dashboardSrc, /const \[ricettaPickerOpen, setRicettaPickerOpen\] = useState\(false\);/);
  const modalBlock = dashboardSrc.slice(dashboardSrc.indexOf('{ricettaPickerOpen && ('), dashboardSrc.indexOf('{bookingOpen && ('));
  assert.match(modalBlock, /<SelettorePaziente/);
  // Must call the SAME goSchedaPaz path every other "open this patient at
  // a specific tab" caller in this file already uses (onOpenPaz), with the
  // document-request payload that seeds SchedaPaz's existing documentFlow.
  assert.match(modalBlock, /onOpenPaz\(paz, 'doc', \{ type: 'ricetta' \}\)/);
});

test('ROUND 4: App.jsx\'s goSchedaPaz forwards an optional documentRequest into the SAME initialDocumentRequest prop SchedaPaz already consumes — no new plumbing invented', () => {
  assert.match(appSrc, /const goSchedaPaz = \(paz, tab = 'paga', documentRequest = null\) => \{/);
  assert.match(appSrc, /setSchedaDashPaz\(\{ paz, tab, documentRequest \}\)/);
  assert.match(appSrc, /initialDocumentRequest=\{schedaDashPaz\.documentRequest\}/);
  // Every pre-existing goSchedaPaz caller keeps working with its old
  // 2-argument call unchanged — documentRequest defaults to null.
  assert.match(appSrc, /onOpenPaz=\{goSchedaPaz\}/);
});

// ===========================================================================
// ROUND 5 — "il tab ricetta deve essere aperto più in alto"
// ===========================================================================

test('ROUND 5: DocMedico scrolls the Farmaci prescritti section into view on open when the type was already decided by the caller', () => {
  assert.match(docMedicoSrc, /const farmaciSectionRef = useRef\(null\);/);
  assert.match(docMedicoSrc, /if \(initialType !== 'ricetta' \|\| !puoiPrescrivere\) return;/);
  assert.match(docMedicoSrc, /farmaciSectionRef\.current\?\.scrollIntoView\(\{ block: 'start' \}\)/);
  // The ref must actually be attached to the Farmaci prescritti block, and
  // the effect must run once on mount (not on every tipo change), or it
  // would fight the user scrolling back up to change type.
  assert.match(docMedicoSrc, /<div ref=\{farmaciSectionRef\}>\s*<Crd style=\{\{ marginBottom: 14 \}\}>\s*<div[^>]*>[^<]*<Ic n="pill"[^/]*\/>Farmaci prescritti<\/div>/);
  const refStart = docMedicoSrc.indexOf('const farmaciSectionRef');
  const effectBlock = docMedicoSrc.slice(refStart, refStart + 600);
  assert.match(effectBlock, /\}, \[\]\);/, 'must be an empty-deps mount-only effect');
  // The selector itself is not hidden or removed — the user can still
  // scroll up and change type.
  assert.match(docMedicoSrc, /tipiDisponibili\.map\(t =>/);
});

// ===========================================================================
// ROUND 6 — "il modulo ricetta deve essere aperto piu in alto del dock" +
// inline "create new patient" in the Ricetta picker
// ===========================================================================

test('ROUND 6: DocMedico opens ABOVE the floating dock/orb, not underneath it', () => {
  // Dock: 1100, PoliedronOrb/EdgeDock: 1200, PoliedronPanel: 1300/1301 —
  // DocMedico must clear all of them. 9999 is the same tier this app's
  // own Modal.jsx already uses for a real full-screen takeover.
  assert.match(docMedicoSrc, /zIndex: 9999, display: 'flex', flexDirection: 'column' \}\}>/);
  assert.doesNotMatch(docMedicoSrc, /zIndex: 500/, 'the old under-the-dock z-index must be gone');
  // The loading fallback (before DocMedico itself has mounted) must match,
  // or the dock would briefly cover the spinner then jump behind it.
  const fallbackBlock = schedaPazSrc.slice(schedaPazSrc.indexOf('Caricamento editor ricetta') - 120, schedaPazSrc.indexOf('Caricamento editor ricetta'));
  assert.match(fallbackBlock, /zIndex: 9999/);
});

test('ROUND 6: the Ricetta picker lets you create a brand-new patient inline (name/surname), then opens Ricetta for them immediately', () => {
  // Reuses SelettorePaziente's own existing onCreaPaziente contract — the
  // exact same "no results -> create inline" UI/flow Agenda.jsx's
  // creaPazienteRapido already ships. No new patient-creation UI invented.
  assert.match(dashboardSrc, /onCreaPaziente=\{setPatients \? creaPazienteRapidoRicetta : undefined\}/);
  assert.match(dashboardSrc, /const creaPazienteRapidoRicetta = \(nome, cognome\) => \{/);
  assert.match(dashboardSrc, /const id = uid\(\);/);
  // Same plan-limit fail-closed guard Agenda.jsx's own creaPazienteRapido
  // uses — no bypass of the studio's max_pazienti cap via this new path.
  assert.match(dashboardSrc, /if \(limitePazienti != null && patients\.length >= limitePazienti\) \{/);
  // The just-created patient must be usable immediately even though
  // setPatients hasn't flushed into a re-render yet — SelettorePaziente
  // calls onChange(id) synchronously right after onCreaPaziente returns.
  assert.match(dashboardSrc, /const ricettaJustCreatedRef = useRef\(null\);/);
  assert.match(dashboardSrc, /ricettaJustCreatedRef\.current = nuovoPaziente;/);
  const modalBlock = dashboardSrc.slice(dashboardSrc.indexOf('{ricettaPickerOpen && ('), dashboardSrc.indexOf('{bookingOpen && ('));
  assert.match(modalBlock, /ricettaJustCreatedRef\.current && String\(ricettaJustCreatedRef\.current\.id\) === String\(id\)/);
  assert.match(modalBlock, /onOpenPaz\(paz, 'doc', \{ type: 'ricetta' \}\)/);
});

test('App.jsx passes setPatients into Dashboard, mirroring Agenda/Pazienti — required for the inline patient-creation path to exist at all', () => {
  const line = appSrc.split('\n').find((l) => l.includes('page === \'home\' && <Dashboard'));
  assert.ok(line, 'expected to find the Dashboard element');
  assert.match(line, /setPatients=\{setPatientsSync\}/);
});

test('REGRESSION GUARD: saving quick_actions from Setup can only ever touch that one widget entry — every other widget survives byte-for-byte', () => {
  const before = createDefaultHomeLayout();
  const after = setHomeWidgetConfig(before, 'quick_actions', { actions: ['task', 'apri_agenda'] });
  for (const item of before) {
    if (item.id === 'quick_actions') continue;
    const match = after.find((x) => x.id === item.id);
    assert.deepEqual(match, item, `${item.id} must be untouched when only quick_actions is reconfigured`);
  }
  const patched = after.find((x) => x.id === 'quick_actions');
  assert.deepEqual(patched.config?.actions, ['task', 'apri_agenda']);
});

// ===========================================================================
// §4/§5 — TODAY / OVERVIEW banding, and personalization preservation
// ===========================================================================

test('the mobile priority banding puts actions, then today, then overview, then deeper detail', () => {
  const mobileBlock = round2Css.slice(round2Css.indexOf(MOBILE_MEDIA));
  const orderOf = (id) => {
    const match = new RegExp(`\\[data-widget-id='${id}'\\][^{]*\\{ order: (\\d+); \\}`).exec(mobileBlock)
      || new RegExp(`\\[data-widget-id='${id}'\\],[\\s\\S]{0,320}?\\{ order: (\\d+); \\}`).exec(mobileBlock);
    return match ? Number(match[1]) : null;
  };
  assert.equal(orderOf('quick_actions'), 10);
  assert.equal(orderOf('agenda'), 20);
  assert.equal(orderOf('appuntamenti'), 20);
  assert.equal(orderOf('richiami'), 30);
  assert.equal(orderOf('grafici'), 50);
  assert.match(mobileBlock, /\.home-workspace \.home-widget-frame \{ order: 40; \}/);
});

test('CRITICAL: the banding is presentation only — the persisted registry contract is byte-for-byte unchanged', () => {
  // Widget ids, their catalog order and the default layout order are the
  // persisted contract every saved layout is normalized against.
  assert.deepEqual(HOME_WIDGET_REGISTRY.map((w) => w.id), [
    'agenda', 'todo', 'appuntamenti', 'wa', 'economico', 'preventivi',
    'richiami', 'scadenze', 'ortodonzia', 'fisio', 'statistiche', 'grafici',
    'fin_preventivato', 'fin_accettato', 'fin_prodotto', 'fin_fatturato', 'fin_incassato',
    'fin_credito_clienti', 'fin_costi_fissi', 'fin_costi_variabili', 'fin_margine_contribuzione',
    'fin_ebitda', 'fin_break_even', 'fin_costo_orario', 'fin_ore_disponibili',
    'fin_produzione_ora', 'fin_incasso_ora', 'quick_actions',
  ]);
  const layout = createDefaultHomeLayout();
  assert.deepEqual(layout.map((w) => w.order), layout.map((_, i) => i));
});

test('the priority area is NOT a widget: it can never be reordered, hidden, resized or persisted', () => {
  assert.ok(!HOME_WIDGET_REGISTRY.some((w) => w.id === 'attention' || w.id === 'home_attention'),
    'the priority area must stay out of the persisted registry');
  assert.doesNotMatch(dashboardSrc, /setHomeWidgetVisibility\(layout, ?'home_attention'/);
  // It renders outside WidgetWorkspace entirely.
  const attention = dashboardSrc.indexOf('<section className="home-attention"');
  const workspaceOpen = dashboardSrc.indexOf('<WidgetWorkspace layout={visibleWidgets}');
  assert.ok(attention < workspaceOpen);
});

test('the banding cannot reach the "Personalizza Home" preview, where the saved order must be shown as saved', () => {
  const mobileBlock = round2Css.slice(round2Css.indexOf(MOBILE_MEDIA));
  const bandingRules = mobileBlock.match(/^\s*\.[^\n]*\[data-widget-id='[^']+'\][^\n]*$/gm) || [];
  assert.ok(bandingRules.length > 0, 'expected the banding rules to be found');
  for (const rule of bandingRules) {
    assert.ok(rule.includes('.home-workspace '), `banding must be scoped to the live Home: ${rule.trim()}`);
  }
  // The live workspace is the only thing wrapped in .home-workspace.
  assert.equal((dashboardSrc.match(/className="home-workspace"/g) || []).length, 1);
});

test('the customizer save/load path is completely untouched by this round', () => {
  assert.match(dashboardSrc, /const layoutSaveEpochRef = useRef\(0\)/);
  assert.match(dashboardSrc, /if \(layoutLoading\) return;/);
  assert.match(dashboardSrc, /await saveUserHomeLayout\(supabase, studioId, userId, draftWidgets\)/);
  assert.match(dashboardSrc, /await deleteUserHomeLayout\(supabase, studioId, userId\)/);
  assert.equal((dashboardSrc.match(/setDraftInherits\(true\)/g) || []).length, 1);
  assert.equal((dashboardSrc.match(/onClick=\{saveHomeCustomization\}/g) || []).length, 2);
});

test('"Personalizza Home" becomes discreet on mobile WITHOUT losing its accessible name', () => {
  const button = dashboardSrc.slice(dashboardSrc.indexOf('className="home-hero__customize"'));
  const head = button.slice(0, 420);
  assert.match(head, /disabled=\{layoutLoading\}/);
  assert.match(head, /aria-label=\{layoutLoading \? 'Caricamento della personalizzazione della Home' : 'Personalizza Home'\}/);
  assert.match(head, /title="Personalizza Home"/);
  assert.match(head, /className="home-hero__customize-label"/);
  const mobileBlock = round2Css.slice(round2Css.indexOf(MOBILE_MEDIA));
  // Visually hidden, still in the accessibility tree (no display:none).
  assert.match(mobileBlock, /\.home-hero__customize-label \{[^}]*clip-path: inset\(50%\);/s);
  assert.doesNotMatch(mobileBlock, /\.home-hero__customize-label \{[^}]*display: none/s);
});

// ===========================================================================
// §7 — dock clearance, touch contract, shell boundaries
// ===========================================================================

test('the dock-clearance spacer still derives from the canonical dock geometry — the math is unchanged', () => {
  assert.equal(MOBILE_DOCK_BOTTOM + MOBILE_DOCK_HEIGHT + MOBILE_DOCK_PROTECTED_GAP, 90);
  assert.match(dashboardSrc, /import \{ MOBILE_DOCK_BOTTOM, MOBILE_DOCK_HEIGHT, MOBILE_DOCK_PROTECTED_GAP \} from '\.\.\/lib\/poliedron\/poliedronMobileDock\.js';/);
  assert.match(dashboardSrc, /height: `calc\(\$\{MOBILE_DOCK_BOTTOM \+ MOBILE_DOCK_HEIGHT \+ MOBILE_DOCK_PROTECTED_GAP\}px \+ env\(safe-area-inset-bottom, 0px\)\)`/);
});

test('BUGFIX: the clearance spacer now also applies on landscape phones, where Home used to lose it entirely', () => {
  // The spacer was only revealed by `@media (max-width: 600px)`, so a
  // coarse-pointer landscape phone (844x390 and friends) — which the React
  // shell already treats as mobile, and which therefore still gets the
  // floating dock — rendered its last widget underneath that dock.
  for (const [width, height] of [[844, 390], [852, 393], [932, 430]]) {
    assert.equal(getMobileShellMode({ width, height, coarsePointer: true }), true, `${width}x${height} is mobile`);
  }
  const mobileBlock = round2Css.slice(round2Css.indexOf(MOBILE_MEDIA));
  assert.match(mobileBlock, /\.home-dock-clearance \{ display: block; \}/);
  assert.match(mobileBlock, /\.home-page \{ padding: 0 15px env\(safe-area-inset-bottom, 0px\); \}/);
});

test('Home now uses the SAME mobile condition the React shell implements — no second definition of "mobile"', () => {
  assert.ok(round2Css.includes(MOBILE_MEDIA), 'expected the Round 1 canonical mobile media query');
  const shellSrc = 'max-width: 719px';
  assert.ok(MOBILE_MEDIA.includes(shellSrc));
  // ...and the shell boundaries themselves are untouched by this round.
  assert.equal(getMobileShellMode({ width: 768, height: 1024, coarsePointer: true }), false);
  assert.equal(getMobileShellMode({ width: 1440, height: 900, coarsePointer: false }), false);
  for (const [width, height] of [[320, 568], [360, 800], [375, 667], [390, 844], [393, 852], [430, 932]]) {
    assert.equal(getMobileShellMode({ width, height, coarsePointer: true }), true, `${width}x${height}`);
  }
});

test('TOUCH CONTRACT: every interactive element this round adds or restyles is at least 44px', () => {
  const mobileBlock = round2Css.slice(round2Css.indexOf(MOBILE_MEDIA));
  // Priority rows: 56px, comfortably above the floor.
  assert.match(round2Css, /\.home-attention__item \{[^}]*min-height: 56px;/s);
  // "Personalizza Home" icon button on mobile.
  assert.match(mobileBlock, /\.home-hero__customize \{[^}]*min-width: var\(--pol-touch-min\);[^}]*min-height: var\(--pol-touch-min\);/s);
  // Quick-action tiles (including "Altro", which shares the grid styling).
  assert.match(mobileBlock, /\.home-quick-actions__grid button \{[^}]*min-height: 60px;/s);
  // The bell was 40x40 — below the Round 1 floor. Raised to the token.
  assert.match(round2Css, /\.poliedron-bell \{[^}]*width: var\(--pol-touch-min\);[^}]*height: var\(--pol-touch-min\);/s);
});

test('DOCK: structure, order, destinations and geometry are unchanged; only the active state gained contrast', () => {
  assert.match(dockSrc, /\{ id: 'home', label: 'Home', icon: 'home' \}/);
  assert.match(dockSrc, /\{ id: 'agenda', label: 'Agenda', icon: 'cal' \}/);
  assert.match(dockSrc, /\{ id: '__poliedron__', label: 'Poliedron', icon: null \}/);
  assert.match(dockSrc, /\{ id: 'paz', label: 'Pazienti', icon: 'pz' \}/);
  assert.match(dockSrc, /\{ id: 'chat', label: 'Chat', icon: 'chat' \}/);
  assert.doesNotMatch(dockSrc, /id: 'set'/, 'Impostazioni must not come back to the dock');
  // Geometry constants untouched.
  assert.equal(MOBILE_DOCK_BOTTOM, 16);
  assert.equal(MOBILE_DOCK_HEIGHT, 64);
  // Contrast raised on the active slot only.
  assert.match(round2Css, /\.poliedron-mobile-dock__item\.is-active \{[^}]*var\(--brand-primary\) 18%/s);
  assert.match(round2Css, /\.poliedron-mobile-dock__item\.is-active::after/);
});

test('§8: the Chat slot still carries NO duplicate unread badge — the bell owns the count', () => {
  assert.doesNotMatch(dockSrc, /poliedron-mobile-dock__badge/);
  // The dock's own "the badge lives on the bell only" comment legitimately
  // says the word, so the check is against executable code only.
  const dockCode = dockSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(dockCode, /unread/i);
  assert.match(bellSrc, /poliedron-bell__badge/);
  assert.match(bellSrc, /unreadCount/);
  // This round did not add a badge anywhere on Home either.
  assert.doesNotMatch(dashboardSrc, /poliedron-mobile-dock__badge|poliedron-bell__badge/);
});

// ===========================================================================
// §6 — Poliedron invariants
// ===========================================================================

test('POLIEDRON INVARIANT: this round adds no second AI surface and touches no engine module', () => {
  for (const forbidden of ['PoliedronOrb', 'usePoliedronPosition', 'poliedronDragMath', 'poliedronSafeBounds', 'poliedronOrbSize', 'usePoliedronEdgePosition']) {
    assert.ok(!dashboardSrc.includes(forbidden), `Dashboard must not reach into ${forbidden}`);
  }
  // The only Poliedron surfaces Home owns stay exactly the two it already
  // had: the Consigli widget and its gem mark.
  assert.match(dashboardSrc, /className="home-poliedron-widget"/);
  assert.doesNotMatch(round2Css, /\.poliedron-orb/);
  assert.doesNotMatch(round2Css, /poliedron-mobile-dock \{/, 'the dock container itself must not be restyled');
});

// ===========================================================================
// §12 — light/dark
// ===========================================================================

test('LIGHT/DARK: every color this round adds is a semantic token or a color-mix of one', () => {
  assert.doesNotMatch(round2Css, /#[0-9a-fA-F]{3,8}\b/, 'no hardcoded hex colors in the Round 2 stylesheet');
  assert.doesNotMatch(round2Css, /rgba?\(/, 'no hardcoded rgb/rgba colors in the Round 2 stylesheet');
  for (const token of ['--surface-card', '--surface-base', '--text-primary', '--text-secondary', '--border-soft', '--brand-primary', '--success']) {
    assert.ok(round2Css.includes(token), `expected ${token} to be used`);
  }
  // No dark-only patch-up was needed, precisely because only token VALUES
  // change between themes (POL-UX-002 §3).
  assert.doesNotMatch(round2Css, /:root\[data-theme="dark"\]/);
});

test('the shared spacing/radius/touch scale from Round 1 is what the new CSS measures with', () => {
  for (const token of ['--pol-space-1', '--pol-space-2', '--pol-space-3', '--pol-space-4', '--pol-radius-control', '--pol-radius-card', '--pol-touch-min']) {
    assert.ok(round2Css.includes(token), `expected ${token} to be used`);
  }
});
