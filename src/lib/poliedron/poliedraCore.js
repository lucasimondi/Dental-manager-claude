/* POL-AI-001 §17-18 — Poliedra AI Core: the UI-independent orchestration
   layer. PoliedronPanel only renders this module's structured output; it
   contains no business reasoning of its own (§17). Every call is a pure
   async function of (query, context, permissions, sources) — no hidden
   state, easy to unit test without mounting any component. */

import { classifyIntent, INTENT, extractAmount } from './intentEngine.js';
import { federatedSearch, suggestedIdle } from './searchEngine.js';
import { runModelTask, MODEL_TASK_TYPE } from './modelGateway.js';
import { isSaveToRecordRequest, saveTargetCandidates } from './attachmentToPatient.js';

/* POL-AI-009: a prescription prepared by agente-assistente (prepara_ricetta).
   Only the shape is checked here; Poliedron.jsx opens it only for a patient
   in its own studio-scoped list and with the Ricetta action allowed. */
export function documentRequestFromModel(modelResult) {
  const doc = modelResult?.raw?.documento;
  if (!doc || doc.tipo !== 'ricetta' || doc.paziente_id == null || !Array.isArray(doc.farmaci)) return null;
  const farmaci = doc.farmaci
    .filter((f) => typeof f?.farmaco === 'string' && f.farmaco.trim())
    .slice(0, 10)
    .map((f) => ({
      farmaco: f.farmaco.trim(),
      dosaggio: typeof f.dosaggio === 'string' ? f.dosaggio : '',
      posologia: typeof f.posologia === 'string' ? f.posologia : '',
      durata: typeof f.durata === 'string' ? f.durata : '',
      note: typeof f.note === 'string' ? f.note : '',
    }));
  if (!farmaci.length) return null;
  return { type: 'ricetta', patientId: doc.paziente_id, patientName: typeof doc.paziente_nome === 'string' ? doc.paziente_nome : '', farmaci };
}
import { resolveCommandAlias } from './commandAliases.js';
import { cercaPazienti } from '../ricercaPazienti.js';
import { resolvePrescriptionRequest } from './prescriptionWorkflow.js';
import { parseAppointmentRequest } from './planner/appointmentIntent.js';
import { parseCreatePlanRequest, parseRegisterPaymentRequest } from './planner/createIntent.js';
import { classifyIntelligenceQuery, scanPatientOpportunities } from './intelligence/index.js';
import { parseCommand } from './planner/commandParser.js';
import { buildActionPlan } from './planner/actionPlanner.js';
import {
  loadCanonicalFinancialSnapshot, selectCanonicalMetrics, MANAGEMENT_CONTROL_MODES,
} from '../canonicalFinancialSelectors.js';

// §20-21: only these keywords route to the canonical finance snapshot —
// anything else in an ANALYZE-shaped query without a real canonical metric
// behind it falls through to ASK (the model gateway) rather than a client
// guess, so numbers are never invented (§20/§21 — reuse the canonical RPC,
// no duplicate formula).
const METRIC_KEYWORDS = Object.freeze([
  { re: /produzion.*ora|produttivit.*ora/i, id: 'produzione_ora' },
  { re: /prodott/i, id: 'prodotto' },
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

export const financialMonthRange = (now = new Date()) => {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const localYmd = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: localYmd(from), to: localYmd(to) };
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
  const { from, to } = financialMonthRange();
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

const AGENT_ACTION_RE = /\b(?:ricordami|promemoria|ferie|blocca|impegn[oi]|consenso|sposta|anticipa|posticipa|disdic\w*|richiam\w*|annota\w*|nota)\b/i;
const PATIENT_DATA_RE = /\b(?:telefono|cellulare|numero|e-?mail|indirizzo|codice fiscale)\b.*(?:\s(?:è|e')\s|\bdiventa\b|\bnuov[oa]\b|:)/i;
// Domains still served by their dedicated modules (POL-AI-010 steps 3-4).
const MODULE_ONLY_RE = /preventiv|piano di cura|pagament|incass|spes[ae]|cost[oi]\b|uscit|document|certificat|lettera|ricett|fattur/i;
// POL-AI-010 passo 4a: "Mario Rossi ha pagato 120 euro con carta".
const PAID_RE = /\b(?:ha|hanno)\s+(?:pagato|versato|saldato|lasciato)\b[^?]*\d/i;
const AUTONOMY_RANK = { consulente: 0, medio: 1, su_richiesta: 2, completo: 3 };

// Mirrors the server gate in agente-assistente: premium plan and an autonomy
// level above "consulente" (studio choice capped by the super-admin ceiling).
// The server re-checks everything; this only decides where the request goes.
export function agentCanWrite(context) {
  const f = context?.features || {};
  if (f.assistente_ai !== 'premium') return false;
  const rank = (v) => AUTONOMY_RANK[v ?? 'completo'] ?? 0;
  return Math.min(rank(f.agente_azione), rank(f.agente_azione_max)) > 0;
}

/**
 * processQuery({ query, context, permissions, sources, conversationHistory, supabaseClient })
 * -> { intent, entities, searchResults, suggestedActions, answer, confirmationRequired }
 * `sources` (already permission-filtered navigation/actions; raw patients
 * list — patient-level filtering is inherent to `patients` already being
 * RLS-scoped to the caller's studio):
 *   { patients, navigationIndex, actions }
 */
export async function processQuery({
  query,
  context,
  permissions,
  sources = {},
  conversationHistory = [],
  supabaseClient,
  allowModel = true,
  attachment = null,
} = {}) {
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

  // POL-AI-008: a message with a file attached always goes to the model
  // with the file — the deterministic routes below read only text and would
  // answer without ever looking at the document.
  if (attachment) {
    // POL-AI-011: "salvalo nella scheda di …" — no model call: the app asks
    // which patient (pre-selected when the name is unambiguous) and saves the
    // file in that patient's "Foto" section after an explicit confirmation.
    if (isSaveToRecordRequest(q)) {
      return {
        intent: 'SAVE_ATTACHMENT', entities: {}, answer: null, confirmationRequired: false, suggestedActions: [], searchResults: [],
        attachmentSave: { candidates: saveTargetCandidates(q, sources.patients || []) },
      };
    }
    const base = { intent: INTENT.ASK, entities: {}, answer: null, confirmationRequired: false, suggestedActions: [], searchResults: [] };
    if (!allowModel) return { ...base, awaitingSubmit: true };
    const modelResult = await runModelTask({
      taskType: MODEL_TASK_TYPE.ASK,
      input: q,
      history: conversationHistory,
      context,
      supabaseClient,
      attachment,
    });
    return {
      ...base,
      answer: modelResult.text || 'Non sono riuscito a leggere il file in questo momento.',
      modelError: modelResult.error || null,
      modelConfirmation: modelResult.raw?.needsConfirmation || null,
      dataChanged: modelResult.raw?.changed || null,
      dataRecords: modelResult.raw?.records || null,
      documentRequest: documentRequestFromModel(modelResult),
    };
  }

  // Explicit agenda requests and their conversational follow-ups use the same
  // authenticated gateway. Never call a model during keystroke previews.
  const agendaRequest = /appuntament|prenot|sposta.*visita|annulla.*visita/i.test(q)
    || conversationHistory.slice(-2).some(m => /appuntament|prenot/i.test(m.content || ''));
  const preliminaryIntent = classifyIntent(q, { navigationIndex: sources.navigationIndex || [] });
  // POL-AI-010: when the studio's agent may write, patient and agenda commands
  // ("aggiungi una nota…", "ricordami…", "ferie dal…") are executed by Poliedron
  // instead of opening a form. Prescriptions, plans and payments keep their
  // dedicated workflows until their own steps.
  const agentWriteRequest = agentCanWrite(context) && !MODULE_ONLY_RE.test(q) && (
    [INTENT.CREATE, INTENT.UPDATE].includes(preliminaryIntent.type) || AGENT_ACTION_RE.test(q) || PATIENT_DATA_RE.test(q)
  );
  // POL-AI-010 passo 4a: with the agent allowed to write, a patient payment
  // is prepared by Poliedron and registered only after the user confirms the
  // summary (server-side, always). Otherwise the "Registra incasso" form opens.
  const agentPaymentRequest = agentCanWrite(context) && !/\?\s*$/.test(q)
    && Boolean(parseRegisterPaymentRequest(q) || PAID_RE.test(q));
  if (agentPaymentRequest && allowModel) {
    const result = await runModelTask({ taskType: MODEL_TASK_TYPE.ASK, input: q, history: conversationHistory, context, supabaseClient });
    return { intent: 'AGENT', answer: result.text, modelError: result.error,
      modelConfirmation: result.raw?.needsConfirmation || null, dataChanged: result.raw?.changed || null, dataRecords: result.raw?.records || null,
      searchResults: [], suggestedActions: [] };
  }
  const dedicatedRoute = [INTENT.NAVIGATE, INTENT.ANALYZE].includes(preliminaryIntent.type)
    || resolvePrescriptionRequest(q, sources.patients || [])
    || parseCreatePlanRequest(q) || parseRegisterPaymentRequest(q);
  if ((agendaRequest || agentWriteRequest) && allowModel && !dedicatedRoute && !classifyIntelligenceQuery(q) && !parseCommand(q)) {
    const result = await runModelTask({ taskType: MODEL_TASK_TYPE.ASK, input: q, history: conversationHistory, context, supabaseClient });
    return { intent: agendaRequest ? 'AGENDA' : 'AGENT', answer: result.text, modelError: result.error,
      modelConfirmation: result.raw?.needsConfirmation || null, dataChanged: result.raw?.changed || null, dataRecords: result.raw?.records || null,
      searchResults: [], suggestedActions: [] };
  }

  // POL-AI-005B: deterministic Level-2 (real write) commands are checked
  // FIRST — most specific, zero-ambiguity, zero Model Gateway calls (see
  // commandParser.js's own doc comment). `buildActionPlan` is pure/
  // read-only: it never writes, only produces a preview the human must
  // still explicitly confirm (§7 safety boundary) via runActionPlan
  // (called from Poliedron.jsx, never from here).
  const parsedCommand = parseCommand(q);
  if (parsedCommand) {
    const actionPlan = buildActionPlan(parsedCommand, {
      patients: sources.patients || [],
      plans: sources.plans || [],
      payments: sources.payments || [],
      pricelist: sources.pricelist || [],
      homePermissions: permissions?.homePermissions || {},
      studioId: context?.studioId,
      currentPatient: context?.currentPatient || null,
    });
    if (actionPlan) {
      return {
        intent: 'ACTION_PLAN', entities: {}, answer: null, confirmationRequired: true,
        actionPlan, suggestedActions: [], searchResults: [],
      };
    }
  }

  const intelligenceIntent = classifyIntelligenceQuery(q);
  if (intelligenceIntent) {
    const intelligence = scanPatientOpportunities({
      studioId: context?.studioId,
      vertical: context?.vertical,
      permissions: permissions?.intelligence,
      sources,
    });
    return {
      intent: intelligenceIntent.type,
      entities: intelligenceIntent.entities,
      answer: null,
      confirmationRequired: false,
      suggestedActions: [],
      searchResults: [],
      intelligence,
    };
  }

  const prescriptionRequest = resolvePrescriptionRequest(q, sources.patients || []);
  // POL-AI-009: a prescription with posology, duration or several drugs is
  // prepared by the model (prepara_ricetta fills every field of the form);
  // the deterministic workflow below would only carry the drug name.
  if (prescriptionRequest?.hasDetails && allowModel && supabaseClient) {
    const modelResult = await runModelTask({
      taskType: MODEL_TASK_TYPE.ASK,
      input: q,
      history: conversationHistory,
      context,
      supabaseClient,
    });
    return {
      intent: INTENT.ASK,
      entities: {},
      answer: modelResult.text || 'Non sono riuscito a preparare la ricetta in questo momento.',
      confirmationRequired: false,
      suggestedActions: [],
      searchResults: [],
      modelError: modelResult.error || null,
      documentRequest: documentRequestFromModel(modelResult),
    };
  }
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

  // POL-AI-006 — appointment booking, real entity pre-fill (§ see
  // appointmentIntent.js's own header comment for why this exists and why
  // it still isn't a Level-2 direct write). Checked before classifyIntent
  // for the same reason the prescription branch above is: its own verb/
  // noun vocabulary is more specific than intentEngine.js's anchored
  // CREATE_VERBS, so it must get first refusal rather than risk losing to
  // a worse-fitting generic classification.
  const appointmentRequest = parseAppointmentRequest(q);
  if (appointmentRequest) {
    const appointmentAction = (sources.actions || []).find((action) => action.id === 'appointment.create');
    if (!appointmentAction) {
      return {
        intent: INTENT.CREATE,
        entities: {},
        answer: 'Non posso aprire il modulo Nuovo appuntamento con i permessi e la configurazione attuali.',
        confirmationRequired: false,
        suggestedActions: [],
        searchResults: [],
      };
    }
    const patientCandidates = sources.patients?.length
      ? cercaPazienti(sources.patients, appointmentRequest.patientText).slice(0, 5)
      : [];
    return {
      intent: 'WORKFLOW',
      entities: {
        patientCandidates,
        patientOptions: patientCandidates.length ? patientCandidates : (sources.patients || []).slice(0, 8),
        appointmentDate: appointmentRequest.date,
        appointmentTime: appointmentRequest.time,
        appointmentDateText: appointmentRequest.dateText,
        appointmentTimeText: appointmentRequest.timeText,
      },
      answer: null,
      confirmationRequired: true,
      selectionRequired: patientCandidates.length !== 1,
      suggestedActions: [appointmentAction],
      searchResults: [],
    };
  }

  // POL-AI-007 — plan/payment creation, real entity pre-fill. Same
  // precedence reasoning as the appointment branch above: these two
  // parsers' own verb+noun vocabulary is more specific (and, unlike
  // cercaPazienti() fed the whole sentence, actually finds the patient —
  // see createIntent.js's own header comment) than intentEngine.js's
  // generic CREATE/UPDATE classification, so they get first refusal.
  const planRequest = parseCreatePlanRequest(q);
  if (planRequest) {
    const planAction = (sources.actions || []).find((action) => action.id === 'quote.create');
    if (!planAction) {
      return {
        intent: INTENT.CREATE, entities: {}, answer: 'Non posso aprire il modulo Nuovo piano con i permessi e la configurazione attuali.',
        confirmationRequired: false, suggestedActions: [], searchResults: [],
      };
    }
    const patientCandidates = sources.patients?.length
      ? cercaPazienti(sources.patients, planRequest.patientText).slice(0, 5)
      : [];
    return {
      intent: 'WORKFLOW',
      entities: {
        patientCandidates,
        patientOptions: patientCandidates.length ? patientCandidates : (sources.patients || []).slice(0, 8),
      },
      answer: null,
      confirmationRequired: true,
      selectionRequired: patientCandidates.length !== 1,
      suggestedActions: [planAction],
      searchResults: [],
    };
  }

  const paymentRequest = parseRegisterPaymentRequest(q);
  if (paymentRequest) {
    const paymentAction = (sources.actions || []).find((action) => action.id === 'payment.create');
    if (!paymentAction) {
      return {
        intent: INTENT.CREATE, entities: {}, answer: 'Non posso aprire il modulo Registra pagamento con i permessi e la configurazione attuali.',
        confirmationRequired: false, suggestedActions: [], searchResults: [],
      };
    }
    const patientCandidates = sources.patients?.length
      ? cercaPazienti(sources.patients, paymentRequest.patientText).slice(0, 5)
      : [];
    return {
      intent: 'WORKFLOW',
      entities: {
        patientCandidates,
        patientOptions: patientCandidates.length ? patientCandidates : (sources.patients || []).slice(0, 8),
        amount: paymentRequest.amount,
      },
      answer: null,
      confirmationRequired: true,
      selectionRequired: patientCandidates.length !== 1,
      suggestedActions: [paymentAction],
      searchResults: [],
    };
  }

  const intent = classifyIntent(q, { navigationIndex: sources.navigationIndex || [] });
  const base = { intent: intent.type, entities: intent.entities, answer: null, confirmationRequired: false, suggestedActions: [] };

  if (intent.type === INTENT.NAVIGATE || intent.type === INTENT.SEARCH) {
    if (intent.type === INTENT.NAVIGATE) {
      const target = (intent.entities.target || '')
        .toLowerCase()
        .replace(/^(?:a|ai|al|alla|alle|allo|in|su|i|il|la|le|lo|gli)\s+/i, '')
        .trim();
      const aliasDestination = resolveCommandAlias(target);
      const aliasIsPermitted = aliasDestination
        && (sources.navigationIndex || []).some((item) => item.id === aliasDestination.navId);
      if (aliasIsPermitted) {
        return {
          ...base,
          searchResults: [],
          directNavigation: aliasDestination,
        };
      }
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
      const modelResult = await runModelTask({
        taskType: MODEL_TASK_TYPE.ASK,
        input: q,
        history: conversationHistory,
        context,
        supabaseClient,
      });
      return {
        ...base,
        searchResults: [],
        answer: modelResult.text || 'Non sono riuscito a rispondere in questo momento.',
        modelError: modelResult.error || null,
        modelConfirmation: modelResult.raw?.needsConfirmation || null,
        dataChanged: modelResult.raw?.changed || null,
        dataRecords: modelResult.raw?.records || null,
        documentRequest: documentRequestFromModel(modelResult),
      };
    }
    if (!hasResults) return { ...base, searchResults: [], awaitingSubmit: true };
    const hasPatientResults = groups.some((group) => group.group === 'PAZIENTI');
    const searchResults = hasPatientResults
      ? groups
      : groups.map((group) => ({
          ...group,
          group: group.group === 'SEZIONI' ? 'APRI UNA SEZIONE' : group.group === 'AZIONI' ? 'AZIONI E WORKFLOW' : group.group,
        }));
    return { ...base, searchResults, suggestionBoard: !hasPatientResults };
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
      const modelResult = await runModelTask({
        taskType: MODEL_TASK_TYPE.ANSWER,
        input: q,
        history: conversationHistory,
        context,
        supabaseClient,
      });
      return {
        ...base,
        searchResults: [],
        answer: modelResult.text || 'Non sono riuscito a rispondere in questo momento.',
        modelError: modelResult.error || null,
        modelConfirmation: modelResult.raw?.needsConfirmation || null,
        dataChanged: modelResult.raw?.changed || null,
        dataRecords: modelResult.raw?.records || null,
        documentRequest: documentRequestFromModel(modelResult),
      };
    }
    return { ...base, searchResults: [], answer: result.answer };
  }

  if (intent.type === INTENT.ASK) {
    if (!allowModel) return { ...base, searchResults: [], awaitingSubmit: true };
    const modelResult = await runModelTask({
      taskType: MODEL_TASK_TYPE.ASK,
      input: q,
      history: conversationHistory,
      context,
      supabaseClient,
    });
    return {
      ...base,
      searchResults: [],
      answer: modelResult.text || 'Non sono riuscito a rispondere in questo momento.',
      modelError: modelResult.error || null,
      modelConfirmation: modelResult.raw?.needsConfirmation || null,
      dataChanged: modelResult.raw?.changed || null,
      dataRecords: modelResult.raw?.records || null,
      documentRequest: documentRequestFromModel(modelResult),
    };
  }

  // AUTOMATE: reserved intent, not offered in Phase 1 (§36 — no autonomous
  // agent yet). Falls back to search so a query never dead-ends silently.
  const { groups } = federatedSearch(q, sources);
  return { ...base, searchResults: groups };
}
