/* POL-UX-001 — catalog of possible Home quick actions (section J) and a
   minimal, extensible workflow contract (section K).
   `capability`: gates the action the same way HOME_WIDGET_REGISTRY's
   `permission` field gates widgets — checked against homePermissions from
   buildHomePermissions (capability-based RBAC), never the raw vertical/role.
   `feature`: optional studio feature flag key that must be truthy.
   `run(ctx)`: the action's effect. `ctx` carries the real navigation/modal
   handlers Dashboard.jsx already owns — no action invents its own routing
   or a second data source. A `workflow` array (optional) documents the
   step contract for actions that chain more than one screen; `run` is
   still the single executable entry point (steps are documentation +
   future extension points, not a separate execution path). */

export const QUICK_ACTIONS_CATALOG = Object.freeze([
  {
    id: 'nuovo_appuntamento', ic: 'cal', label: 'Nuovo appuntamento',
    run: (ctx) => ctx.openBooking(),
  },
  {
    id: 'apri_agenda', ic: 'cal', label: 'Apri agenda',
    run: (ctx) => ctx.onGoAgenda ? ctx.onGoAgenda() : ctx.onNavigate('agenda'),
  },
  {
    id: 'nuovo_paziente', ic: 'pz', label: 'Nuovo paziente',
    workflow: ['navigate:paz', 'open_new_patient_form'],
    run: (ctx) => ctx.onNavigateNew ? ctx.onNavigateNew('paz') : ctx.onNavigate('paz'),
  },
  {
    id: 'nuovo_paziente_appuntamento', ic: 'pz', label: 'Paziente e appuntamento',
    workflow: ['open_new_patient_form', 'open_booking_with_patient'],
    run: (ctx) => ctx.onNavigateNew ? ctx.onNavigateNew('paz') : ctx.onNavigate('paz'),
  },
  {
    id: 'nuovo_preventivo', ic: 'plan', label: 'Nuovo preventivo',
    run: (ctx) => ctx.onNavigateNew ? ctx.onNavigateNew('piani') : ctx.onNavigate('piani'),
  },
  {
    id: 'nuova_spesa', ic: 'box', label: 'Nuova spesa',
    feature: 'spese',
    run: (ctx) => ctx.onNavigateNew ? ctx.onNavigateNew('spese') : ctx.onNavigate('spese'),
  },
  {
    id: 'pagamento', ic: 'pay', label: 'Pagamento',
    workflow: ['navigate:paga', 'select_patient', 'register_payment'],
    run: (ctx) => ctx.onNavigateNew ? ctx.onNavigateNew('paga') : ctx.onNavigate('paga'),
  },
  {
    id: 'nuova_seduta_fisio', ic: 'pulse', label: 'Seduta Fisio',
    verticals: ['fisioterapista', 'massofisioterapista'],
    workflow: ['select_patient', 'select_episode', 'open_quick_session'],
    run: (ctx) => ctx.onNavigate('paz'),
  },
  {
    // Icon fixed (Product Owner round 3): 'doc' does not exist in Ic.jsx's
    // icon map, so this silently rendered no icon at all. 'file' is the
    // same generic-document icon DocMedico.jsx's own "Foglio bianco
    // intestato" type already uses for the same concept — no new SVG.
    id: 'documento', ic: 'file', label: 'Documento',
    feature: 'archivio_documenti',
    run: (ctx) => ctx.onNavigate('archivio'),
  },
  {
    id: 'task', ic: 'okc', label: 'Task',
    run: (ctx) => ctx.openTodoModal(),
  },
  {
    id: 'richiamo', ic: 'bell', label: 'Richiamo',
    workflow: ['navigate:richiami', 'open_new_richiamo_form'],
    run: (ctx) => ctx.onNavigateNew ? ctx.onNavigateNew('richiami') : (ctx.onGoRichiami ? ctx.onGoRichiami() : ctx.onNavigate('richiami')),
  },
  {
    id: 'controllo_gestione', ic: 'chart', label: 'Controllo di gestione',
    capability: 'managementControl',
    run: (ctx) => ctx.onNavigate('controllo'),
  },
  /* Product Owner round 3 additions. All three reuse existing, already-
     shipped destinations/icons — no new page, no new clinical/financial
     logic. Ricetta/Consenso need a patient first. */
  {
    // Product Owner round 4: "Ricetta deve aprire il tab ricetta, non
    // paziente" — a bare navigate('paz') left the user to find the
    // patient AND the Doc tab AND the Ricetta type themselves. Home has
    // no current patient, so a patient still has to be picked — but the
    // picker now lands directly on DocMedico's Ricetta tab (same 'pill'
    // icon DocMedico's own TIPI list already uses for id:'ricetta'; its
    // own puoiPrescrivere gate is unchanged and still applies) via the
    // SAME initialDocumentRequest -> documentFlow mechanism SchedaPaz
    // already exposes for the Poliedron prescription workflow — nothing
    // new was built, only wired to a second caller.
    id: 'ricetta', ic: 'pill', label: 'Ricetta',
    workflow: ['open_patient_picker', 'open_scheda_doc_tab', 'open_ricetta'],
    run: (ctx) => ctx.openRicettaPicker ? ctx.openRicettaPicker() : ctx.onNavigate('paz'),
  },
  {
    id: 'consenso', ic: 'edit', label: 'Consenso',
    workflow: ['navigate:paz', 'select_patient', 'open_scheda_doc_tab', 'open_consenso'],
    run: (ctx) => ctx.onNavigate('paz'),
  },
  /* POL-FIN-002: the receivables module now exists. Keep PR #74's action,
     visual treatment and personalization contract; only replace its
     temporary honest placeholder with the shipped destination. */
  {
    id: 'da_incassare', ic: 'eur', label: 'Da incassare',
    run: (ctx) => ctx.onNavigate('incassi'),
  },
]);

const catalogById = new Map(QUICK_ACTIONS_CATALOG.map((a) => [a.id, a]));
export const getQuickAction = (id) => catalogById.get(id) || null;

export const DEFAULT_QUICK_ACTION_IDS = Object.freeze([
  'nuovo_appuntamento', 'apri_agenda', 'nuovo_paziente', 'nuovo_preventivo', 'pagamento', 'richiamo',
]);

/* Same filtering shape as isWidgetAllowed in homeDashboardModel.js: fail
   closed unless every declared gate (capability/feature/vertical) passes. */
export const isQuickActionAllowed = (action, { permissions, features, vertical }) => {
  if (!permissions?.activeMember) return false;
  if (action.capability && permissions[action.capability] !== true) return false;
  if (action.feature && !features?.[action.feature]) return false;
  if (action.verticals && !action.verticals.includes(vertical)) return false;
  return true;
};

export const filterQuickActionsCatalog = (context) =>
  QUICK_ACTIONS_CATALOG.filter((action) => isQuickActionAllowed(action, context));

/* Resolves the user's chosen quick_actions widget config (ids + order) down
   to the real, allowed, deduplicated action objects to render — falls back
   to DEFAULT_QUICK_ACTION_IDS (filtered by the same gates) when unset. */
export const resolveQuickActions = (configuredIds, context) => {
  const allowed = new Set(filterQuickActionsCatalog(context).map((a) => a.id));
  const ids = Array.isArray(configuredIds) && configuredIds.length ? configuredIds : DEFAULT_QUICK_ACTION_IDS;
  const seen = new Set();
  const resolved = [];
  for (const id of ids) {
    if (seen.has(id) || !allowed.has(id)) continue;
    seen.add(id);
    resolved.push(getQuickAction(id));
  }
  return resolved;
};
