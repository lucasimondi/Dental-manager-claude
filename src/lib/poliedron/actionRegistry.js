/* POL-AI-001 §10-11 — central action registry.
   No business logic is duplicated here: "open" actions call the exact
   navigation handlers App.jsx already passes down everywhere else
   (setPage/goSchedaPaz), and "create" actions reuse QUICK_ACTIONS_CATALOG
   verbatim (the same catalog/gates/`run(ctx)` Dashboard's own quick actions
   already use) instead of a second definition of what "new appointment"
   means.

   riskLevel (§11):
   0 = read/search/navigation, executes immediately
   1 = opens an existing create/edit form for the human to fill and submit
       themselves — Poliedron never writes data directly at this level, so
       no confirmation step is required (the existing form's own Save
       button remains the actual write path)
   2 = would create/update a business record — reserved for a future phase
       once entity pre-fill exists end-to-end (see FUTURE_PHASES); not
       reachable from any registry entry in Phase 1
   3 = delete / irreversible clinical or financial action — not
       implemented in Phase 1; no such action exists in this registry yet */

import { getQuickAction } from '../quickActionsCatalog.js';

const OPEN_ACTIONS = Object.freeze([
  {
    id: 'patient.open', label: 'Apri paziente', description: 'Apre la scheda del paziente selezionato.',
    category: 'patient', riskLevel: 0, confirmationRequired: false,
    navigate: (ctx, entity) => { if (ctx.goSchedaPaz && entity) ctx.goSchedaPaz(entity); },
  },
  {
    id: 'appointment.open', label: 'Apri agenda', description: 'Va alla sezione Agenda.',
    category: 'appointment', riskLevel: 0, confirmationRequired: false, navId: 'agenda',
    navigate: (ctx) => ctx.setPage('agenda'),
  },
  {
    id: 'quote.open', label: 'Apri piani', description: 'Va alla sezione Piani/Preventivi.',
    category: 'quote', riskLevel: 0, confirmationRequired: false, navId: 'piani',
    navigate: (ctx) => ctx.setPage('piani'),
  },
  {
    id: 'payment.open', label: 'Apri pagamenti', description: 'Va alla sezione Pagamenti.',
    category: 'payment', riskLevel: 0, confirmationRequired: false, navId: 'paga',
    navigate: (ctx) => ctx.setPage('paga'),
  },
  {
    id: 'recall.open', label: 'Apri richiami', description: 'Va alla sezione Richiami.',
    category: 'recall', riskLevel: 0, confirmationRequired: false, navId: 'richiami',
    navigate: (ctx) => ctx.setPage('richiami'),
  },
  {
    id: 'document.search', label: 'Cerca nei documenti', description: 'Va all’Archivio documenti.',
    category: 'document', riskLevel: 0, confirmationRequired: false, navId: 'archivio',
    navigate: (ctx) => ctx.setPage('archivio'),
  },
  {
    id: 'finance.open', label: 'Apri controllo di gestione', description: 'Va al Controllo di gestione.',
    category: 'finance', riskLevel: 0, confirmationRequired: false, navId: 'controllo',
    navigate: (ctx) => ctx.setPage('controllo'),
  },
]);

// id -> quickActionsCatalog id: reuse, don't redefine, what "create" means
// for each entity. Level 1: opens the real form via the same autoOpenNew
// mechanism Dashboard's quick actions already use; the human still fills
// and submits it themselves.
const CREATE_ACTION_MAP = Object.freeze({
  'patient.create': 'nuovo_paziente',
  'appointment.create': 'nuovo_appuntamento',
  'quote.create': 'nuovo_preventivo',
  'payment.create': 'pagamento',
  'recall.create': 'richiamo',
});

const CREATE_ACTIONS = Object.freeze(
  Object.entries(CREATE_ACTION_MAP).map(([id, quickActionId]) => {
    const qa = getQuickAction(quickActionId);
    return Object.freeze({
      id,
      label: qa.label.replace(/^\+\s*/, ''),
      description: `Apre il modulo per ${qa.label.replace(/^\+\s*/, '').toLowerCase()}.`,
      category: id.split('.')[0],
      riskLevel: 1,
      confirmationRequired: false,
      quickAction: qa,
      navigate: (ctx) => qa.run(ctx),
    });
  })
);

export const ACTION_REGISTRY = Object.freeze([...OPEN_ACTIONS, ...CREATE_ACTIONS]);

export const findAction = (id) => ACTION_REGISTRY.find((a) => a.id === id) || null;
