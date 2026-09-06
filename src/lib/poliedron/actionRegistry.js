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
import { VERTICALI_CON_RICETTA } from '../utils.js';

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
  'recall.create': 'richiamo',
  'expense.create': 'nuova_spesa',
  'document.create': 'documento',
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

// appointment.create is kept out of the generic CREATE_ACTION_MAP above
// because, unlike the others, it now carries real entity pre-fill
// (POL-AI-006 — see appointmentIntent.js): when chat recognized a
// patient/date/time, `navigate` threads them into the SAME
// QuickBookingModal every other "Nuovo appuntamento" entry point already
// opens (openBooking payload), instead of always opening it blank. Still
// riskLevel 1 — the human still picks the final slot and clicks "Conferma
// appuntamento"; Poliedron never books directly.
const appointmentQuickAction = getQuickAction('nuovo_appuntamento');
const APPOINTMENT_ACTION = Object.freeze({
  id: 'appointment.create',
  label: appointmentQuickAction.label.replace(/^\+\s*/, ''),
  description: 'Apre il modulo Nuovo appuntamento, con paziente/data/ora già precompilati quando riconosciuti nella richiesta.',
  category: 'appointment',
  riskLevel: 1,
  confirmationRequired: false,
  quickAction: appointmentQuickAction,
  navigate: (ctx, patient, payload = {}) => appointmentQuickAction.run(ctx, {
    patientId: patient?.id ?? null,
    data: payload.date || undefined,
    ora: payload.time || undefined,
  }),
});

// quote.create/payment.create are kept out of the generic CREATE_ACTION_MAP
// above for the same reason appointment.create is (POL-AI-007 — see
// createIntent.js's own header comment): when chat recognized a patient
// (and, for payments, an amount), `navigate` opens the SAME real "Nuovo
// piano"/"Registra incasso" forms every other entry point already opens —
// `openNewPlan`/`openNewPayment` reuse App.jsx's existing
// initPatId/autoOpenNew pre-fill mechanisms, nothing new is invented — with
// that entity pre-filled, instead of always opening them blank. Still
// riskLevel 1 — the human still reviews and submits the form themselves;
// Poliedron never writes a plan or a payment directly.
const quoteQuickAction = getQuickAction('nuovo_preventivo');
const QUOTE_ACTION = Object.freeze({
  id: 'quote.create',
  label: quoteQuickAction.label.replace(/^\+\s*/, ''),
  description: 'Apre il modulo Nuovo piano, con paziente già precompilato quando riconosciuto nella richiesta.',
  category: 'quote',
  riskLevel: 1,
  confirmationRequired: false,
  quickAction: quoteQuickAction,
  navigate: (ctx, patient) => (patient && ctx.openNewPlan) ? ctx.openNewPlan(patient.id) : quoteQuickAction.run(ctx),
});

const paymentQuickAction = getQuickAction('pagamento');
const PAYMENT_ACTION = Object.freeze({
  id: 'payment.create',
  label: paymentQuickAction.label.replace(/^\+\s*/, ''),
  description: 'Apre il modulo Registra pagamento, con paziente/importo già precompilati quando riconosciuti nella richiesta.',
  category: 'payment',
  riskLevel: 1,
  confirmationRequired: false,
  quickAction: paymentQuickAction,
  navigate: (ctx, patient, payload = {}) => (ctx.openNewPayment && (patient || payload.amount != null))
    ? ctx.openNewPayment({ patientId: patient?.id ?? null, amount: payload.amount ?? null })
    : paymentQuickAction.run(ctx),
});

const WORKFLOW_ACTIONS = Object.freeze([
  Object.freeze({
    id: 'prescription.create',
    label: 'Prepara una ricetta',
    description: 'Apre il modulo Ricetta reale con il paziente selezionato e i soli campi supportati.',
    category: 'clinical',
    kind: 'workflow',
    riskLevel: 1,
    confirmationRequired: true,
    requiresActiveMember: true,
    verticals: Object.freeze([...VERTICALI_CON_RICETTA]),
    featureNotFalse: 'documenti',
    navigate: (ctx, patient, payload = {}) => {
      if (ctx.openPrescription && patient) ctx.openPrescription({ patient, drug: payload.drug || '' });
    },
  }),
]);

export const ACTION_REGISTRY = Object.freeze([...OPEN_ACTIONS, ...CREATE_ACTIONS, APPOINTMENT_ACTION, QUOTE_ACTION, PAYMENT_ACTION, ...WORKFLOW_ACTIONS]);

export const findAction = (id) => ACTION_REGISTRY.find((a) => a.id === id) || null;
