/* POL-AI-001 §17-18 — Poliedra AI Core: the UI-independent orchestration
   layer. PoliedronPanel only renders this module's structured output; it
   contains no business reasoning of its own (§17). Every call is a pure
   async function of (query, context, permissions, sources) — no hidden
   state, easy to unit test without mounting any component. */

import { classifyIntent, INTENT, extractAmount } from './intentEngine.js';
import { federatedSearch, suggestedIdle } from './searchEngine.js';
import { runModelTask, MODEL_TASK_TYPE } from './modelGateway.js';
import { resolveCommandAlias } from './commandAliases.js';
import { cercaPazienti } from '../ricercaPazienti.js';
import { resolvePrescriptionRequest } from './prescriptionWorkflow.js';
import {
  loadCanonicalFinancialSnapshot, selectCanonicalMetrics, MANAGEMENT_CONTROL_MODES,
} from '../canonicalFinancialSelectors.js';

// §20-21: only these keywords route to the canonical finance snapshot —
// anything else in an ANALYZE-shaped query without a real canonical metric
// behind it falls through to ASK (the model gateway) rather than a client
// guess, so numbers are never invented (§20/§21 — reuse the canonical RPC,
// no duplicate formula).
const METRIC_KEYWORDS = Object.freeze([
  { re: /incassat/i, id: 'incassato' },
  { re: /margine.*contribuzion/i, id: 'margine_contribuzione' },
  { re: /margine|ebitda/i, id: 'ebitda_operativo_gestionale' },
  { re: /break.?even/i, id: 'break_even' },
  { re: /fatturat/i, id: 'fatturato_netto_iva' },
  { re: /credito/i, id: 'credito_clienti' },
]);

const CREATE_ACTION_KEYWORDS = Object.freeze([
  { re: /\b(?:appuntament|prenotazion)\w*/i, id: 'appointment.create' },
  { re: /\b(?:paziente|anagrafica)\b/i, id: 'patient.create' },
  { re: /\b(?:preventiv|piano di cura)\w*/i, id: 'quote.create' },
  { re: /\b(?:pagament|incass)\w*/i, id: 'payment.create' },
  { re: /\b(?:richiam|promemoria|follow.?up)\w*/i, id: 'recall.create' },
  { re: /\b(?:spesa|costo|uscita)\b/i, id: 'expense.create' },
  { re: /\b(?:documento|certificato|lettera)\b/i, id: 'document.create' },
]);

const monthRange = (now = new Date()) => {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
};

const fmtEur = (n) => (typeof n === 'number' ? n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : null);

async function resolveAnalyze(entities, context, permissions, supabaseClient) {
  if (!permissions?.managementControl) {
    return { answer: 'Non hai accesso al Controllo di gestione per rispondere a questa domanda.', confirmationRequired: false };
  }
  const hit = METRIC_KEYWORDS.find((k) => k.re.test(entities.raw || ''));
  if (!hit) {
    return { answer: null, confirmationRequired: false, needsModel: true };
  }
  if (!supabaseClient) {
    return { answer: 'Dati non disponibili al momento.', confirmationRequired: false };
  }
  const { from, to } = monthRange();
  const { snapshot, error } = await loadCanonicalFinancialSnapshot(supabaseClient, from, to, context?.studioId);
  if (error || !snapshot) {
    return { answer: 'Dati non disponibili al momento.', confirmationRequired: false };
  }
  const metrics = selectCanonicalMetrics(snapshot, MANAGEMENT_CONTROL_MODES.ADVANCED);
  const metric = metrics.find((m) => m.id === hit.id);
  if (!metric || !metric.available) {
    return { answer: 'Il dato richiesto non è disponibile per il periodo corrente.', confirmationRequired: false };
  }
  const value = typeof metric.value === 'number' ? fmtEur(metric.value) : String(metric.value);
  return { answer: `${metric.label} (${from} — ${to}): ${value}`, confirmationRequired: false };
}

/**
 * processQuery({ query, context, permissions, sources, supabaseClient })
 * -> { intent, entities, searchResults, suggestedActions, answer, confirmationRequired }
 * `sources` (already permission-filtered navigation/actions; raw patients
 * list — patient-level filtering is inherent to `patients` already being
 * RLS-scoped to the caller's studio):
 *   { patients, navigationIndex, actions }
 */
export async function processQuery({ query, context, permissions, sources = {}, supabaseClient, allowModel = true } = {}) {
  const q = (query || '').trim();
  if (!q) {
    return {
      intent: null, entities: {}, answer: null, confirmationRequired: false,
      searchResults: suggestedIdle({
        actions: sources.actions || [],
        navigationIndex: sources.navigationIndex || [],
        context,
      }),
      suggestedActions: [],
    };
  }

  const prescriptionRequest = resolvePrescriptionRequest(q, sources.patients || []);
  if (prescriptionRequest) {
    const prescriptionAction = (sources.actions || []).find((action) => action.id === 'prescription.create');
    if (!prescriptionAction) {
      return {
        intent: INTENT.CREATE,
        entities: {},
        answer: 'Non posso aprire il workflow Ricetta con i permessi e la configurazione attuali.',
        confirmationRequired: false,
        suggestedActions: [],
        searchResults: [],
      };
    }
    return {
      intent: 'WORKFLOW',
      entities: prescriptionRequest,
      answer: null,
      confirmationRequired: true,
      selectionRequired: prescriptionRequest.patientCandidates.length !== 1,
      suggestedActions: [prescriptionAction],
      searchResults: [],
    };
  }

  // POL-AI-002A §18-23 — deterministic direct-open command, checked
  // BEFORE classifyIntent: an exact commandAlias match never reaches the
  // model, never shows an intermediate results screen, and never risks
  // classifyIntent's fuzzier NAVIGATE path (which still returns grouped
  // search results for the user to click, see below) — it's resolved and
  // returned instantly. Partial/fuzzy queries never match here (§21) —
  // resolveCommandAlias only accepts an exact, whole-string alias.
  const direct = resolveCommandAlias(q);
  const directIsPermitted = direct && (sources.navigationIndex || []).some((item) => item.id === direct.navId);
  if (directIsPermitted) {
    return {
      intent: 'DIRECT_NAVIGATE', entities: { navId: direct.navId, filtroTipo: direct.filtroTipo },
      answer: null, confirmationRequired: false, suggestedActions: [], searchResults: [],
      directNavigation: direct,
    };
  }

  const intent = classifyIntent(q, { navigationIndex: sources.navigationIndex || [] });
  const base = { intent: intent.type, entities: intent.entities, answer: null, confirmationRequired: false, suggestedActions: [] };

  if (intent.type === INTENT.NAVIGATE || intent.type === INTENT.SEARCH) {
    if (intent.type === INTENT.NAVIGATE) {
      const target = (intent.entities.target || '').toLowerCase();
      const exact = (sources.navigationIndex || []).find((item) =>
        item.label.toLowerCase() === target || item.aliases.some((alias) => alias.toLowerCase() === target)
      );
      if (exact) {
        return {
          ...base,
          searchResults: [],
          directNavigation: { navId: exact.id, filtroTipo: null },
        };
      }
    }
    const { groups, hasResults } = federatedSearch(q, sources);
    if (!hasResults && allowModel) {
      const modelResult = await runModelTask({ taskType: MODEL_TASK_TYPE.ASK, input: q, context, supabaseClient });
      return { ...base, searchResults: [], answer: modelResult.text || 'Non sono riuscito a rispondere in questo momento.' };
    }
    if (!hasResults) return { ...base, searchResults: [], awaitingSubmit: true };
    return { ...base, searchResults: groups };
  }

  if (intent.type === INTENT.CREATE || intent.type === INTENT.UPDATE) {
    // §19 preview: try to resolve a patient + amount from free text so the
    // panel can show a real confirmation preview before navigating to the
    // existing form (see actionRegistry.js — Phase 1 still submits through
    // that form, this is presentation only, per §14).
    const amount = intent.entities.amount ?? extractAmount(intent.entities.raw || q);
    const patientMatches = sources.patients?.length ? cercaPazienti(sources.patients, intent.entities.raw || q).slice(0, 3) : [];
    const relevantActions = sources.actions || [];
    const actionId = CREATE_ACTION_KEYWORDS.find(({ re }) => re.test(q))?.id || null;
    const suggested = actionId ? relevantActions.filter((a) => a.id === actionId) : [];
    return {
      ...base,
      searchResults: [],
      suggestedActions: suggested.length ? suggested : relevantActions.slice(0, 3),
      entities: { ...intent.entities, amount, patientCandidates: patientMatches },
      confirmationRequired: suggested.length > 0 && (amount != null || patientMatches.length > 0),
    };
  }

  if (intent.type === INTENT.ANALYZE) {
    if (!allowModel) return { ...base, searchResults: [], awaitingSubmit: true };
    const result = await resolveAnalyze(intent.entities, context, permissions, supabaseClient);
    if (result.needsModel) {
      const modelResult = await runModelTask({ taskType: MODEL_TASK_TYPE.ANSWER, input: q, context, supabaseClient });
      return { ...base, searchResults: [], answer: modelResult.text || 'Non sono riuscito a rispondere in questo momento.' };
    }
    return { ...base, searchResults: [], answer: result.answer };
  }

  if (intent.type === INTENT.ASK) {
    if (!allowModel) return { ...base, searchResults: [], awaitingSubmit: true };
    const modelResult = await runModelTask({ taskType: MODEL_TASK_TYPE.ASK, input: q, context, supabaseClient });
    return { ...base, searchResults: [], answer: modelResult.text || 'Non sono riuscito a rispondere in questo momento.' };
  }

  // AUTOMATE: reserved intent, not offered in Phase 1 (§36 — no autonomous
  // agent yet). Falls back to search so a query never dead-ends silently.
  const { groups } = federatedSearch(q, sources);
  return { ...base, searchResults: groups };
}
