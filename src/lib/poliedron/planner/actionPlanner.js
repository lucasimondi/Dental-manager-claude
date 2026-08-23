/* POL-AI-005A — provider-independent, non-executing Action Plan contract.
   UNDERSTAND (commandParser.js) -> RESOLVE (patientResolver.js/
   procedureResolver.js) -> PLAN (this file). CONFIRM/ACT/VERIFY are
   explicitly Phase B — see docs/architecture/POL-AI-005A-planner-
   foundation.md. Every function here is pure and read-only: it accepts
   already-loaded, already-tenant-scoped arrays (`patients`, `plans`,
   `payments`, `pricelist`) exactly like every existing page already
   receives them, and returns a plain, serializable Action Plan object. No
   function in this module ever calls Supabase, and executeActionPlan()
   below is an explicit, tested no-op stub. */

import { COMMAND_INTENT, ITALIAN_MONTHS, resolveStartDateIso } from './commandParser.js';
import { resolvePatient, resolveContextualPatient, PATIENT_RESOLUTION_STATUS } from './patientResolver.js';
import { resolveProcedure, PROCEDURE_RESOLUTION_STATUS } from './procedureResolver.js';
import { createTooth, isToothIncomplete, TOOTH_STATE } from './toothModel.js';
import { buildIntelligencePermissions } from '../permissionEngine.js';
import { normalizza } from '../../ricercaPazienti.js';
import { today } from '../../utils.js';
import { amountsEqual, roundMoney } from '../../domain/money.js';
import { PLAN_TYPE, PLAN_STATUS, buildInstallmentDeadlines, deadlineRemainingAmount } from '../../domain/paymentPlanService.js';
import { computePatientFinancialSummary } from '../../domain/patientFinancialSummary.js';

export const PLAN_STEP_TYPE = Object.freeze({
  RESOLVE_PATIENT: 'RESOLVE_PATIENT',
  RESOLVE_PROCEDURE: 'RESOLVE_PROCEDURE',
  CHECK_EXISTING_TREATMENT: 'CHECK_EXISTING_TREATMENT',
  ENSURE_TREATMENT_ITEM: 'ENSURE_TREATMENT_ITEM',
  MARK_TREATMENT_COMPLETED: 'MARK_TREATMENT_COMPLETED',
  CHECK_EXISTING_PENDING_PAYMENT: 'CHECK_EXISTING_PENDING_PAYMENT',
  ENSURE_PENDING_PAYMENT: 'ENSURE_PENDING_PAYMENT',
  VERIFY_REQUIRED_LATER: 'VERIFY_REQUIRED_LATER',
  // POL-AI-005B Workflow G:
  TARGET_PLAN_AMBIGUOUS: 'TARGET_PLAN_AMBIGUOUS', // recorded when a new item would need a target plan and more than one plausible plan exists — see pickTargetPlanForNewItem.
  RESOLVE_INCOMPLETE_TREATMENT: 'RESOLVE_INCOMPLETE_TREATMENT', // records how "Era il 46" resolved: single match / ambiguous / no match / already complete / conflicting value.
  COMPLETE_TREATMENT_TOOTH: 'COMPLETE_TREATMENT_TOOTH', // the actual write step: update ONLY the tooth field on an already-identified existing item.
  // POL-FIN-001:
  CHECK_EXISTING_PAYMENT_PLAN: 'CHECK_EXISTING_PAYMENT_PLAN', // records whether the patient already has an ACTIVE payment plan (at most one is the business rule).
  CREATE_PAYMENT_PLAN: 'CREATE_PAYMENT_PLAN', // the write step: creates one payment_plans row plus its deadlines.
  RESOLVE_PAYMENT_ALLOCATION: 'RESOLVE_PAYMENT_ALLOCATION', // records how a payment-received command resolved: single open deadline / ambiguous / no deadline (general balance).
  RECORD_PAYMENT_ALLOCATION: 'RECORD_PAYMENT_ALLOCATION', // the write step: creates the payments row + a payment_allocations row (deadline-linked or general).
});

export const PRICE_UNRESOLVED = 'PRICE_UNRESOLVED';

// Reused, not reinvented: the exact computed capability flags
// permissionEngine.js already exposes from the caller's real
// homePermissions. Phase A DELIBERATELY gates clinical/financial planner
// steps more strictly than the current human-driven forms do today (see
// docs/architecture/POL-AI-005A-domain-audit.md MISSING_ABSTRACTIONS #3 —
// Piani.jsx/Pagamenti.jsx only require `activeMember`). This is a
// conservative Phase A default for an AI-INITIATED write plan, not a
// discovered existing gate, and is called out as
// PRODUCT_OWNER_DECISION_REQUIRED before Phase B builds a real executor.
export const REQUIRED_PERMISSION = Object.freeze({ CLINICAL: 'clinical', FINANCIAL: 'financial' });

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

// POL-AI-005B: exported so the domain-service/executor layer
// (src/lib/domain/treatmentPlanService.js, actionExecutor.js) re-checks
// idempotency with the EXACT same rule the planner used to build the
// preview — a single source of truth for "is this the same treatment
// item", never two subtly different definitions between plan time and
// write time.
export const sameProcedureAndTooth = (voce, procedureNormalizedText, tooth) => {
  if (normalizza(voce.prestazione) !== procedureNormalizedText) return false;
  const voceHasTooth = !!voce.dente;
  if (tooth.state === 'known') return voceHasTooth && String(voce.dente) === tooth.value;
  // Both "unknown" here means: an existing item for the same procedure
  // that also has no tooth recorded — a plausible, not certain, reuse
  // candidate. Never collapsed automatically without being surfaced.
  return !voceHasTooth;
};

/** Finds a same-patient plan item that already represents this procedure/
 *  tooth, so MARK_TREATMENT_COMPLETED can reuse it instead of planning a
 *  duplicate ENSURE_TREATMENT_ITEM (§17/§18 idempotency). Only matches
 *  against already-persisted `plans` — never against sibling items being
 *  planned in the same request (see §18: two explicit incomplete fillings
 *  must stay two distinct planned items). */
export const findExistingTreatmentItem = (plans, patientId, procedureNormalizedText, tooth) => {
  for (const plan of plans) {
    if (String(plan.pazienteId) !== String(patientId)) continue;
    const index = (plan.voci || []).findIndex((v) => sameProcedureAndTooth(v, procedureNormalizedText, tooth));
    if (index >= 0) return { plan, voceIndex: index, voce: plan.voci[index] };
  }
  return null;
};

/** Finds an existing payment that plausibly already represents the same
 *  pending amount for this patient (§18: flag, never silently duplicate).
 *  This is explicitly a best-effort match (see domain audit RISKS —
 *  payments have no structural link to a treatment item), surfaced as a
 *  warning, never used to silently suppress the step. */
export const findLikelyDuplicatePendingPayment = (payments, patientId, amount) => {
  if (amount === null || amount === undefined) return null;
  return (payments || []).find((p) => String(p.pazienteId) === String(patientId)
    && Number(p.importo) === Number(amount)
    && p.stato !== 'pagato') || null;
};

export const TARGET_PLAN_STATUS = Object.freeze({ NONE: 'NONE', SINGLE: 'SINGLE', AMBIGUOUS: 'AMBIGUOUS' });

/** POL-AI-005B Workflow-G hardening — explicit Product Owner decision:
 *  "may use a conservative deterministic rule only when there is exactly
 *  one clearly appropriate target plan... if multiple plausible plans
 *  exist, DO NOT choose arbitrarily." This used to silently pick "most
 *  recently updated" when several open plans existed for the patient —
 *  exactly the arbitrary-order guess the Product Owner ruled out. It now
 *  returns a `{status, plan, candidates}` triple — `NONE` (zero open
 *  plans, caller creates a new one — unambiguous), `SINGLE` (exactly one —
 *  use it, unambiguous), or `AMBIGUOUS` (two or more — the caller MUST NOT
 *  write; it must surface `candidates` and ask). No "latest wins" or
 *  score-based tiebreaker is applied anywhere in this function — that
 *  would just be the same silent guess wearing a different name. Used both
 *  at PLAN time (to make an ambiguous plan non-executable before it is
 *  ever shown) and again at EXECUTE time (TOCTOU: state can change between
 *  preview and confirm). */
export const pickTargetPlanForNewItem = (plans, patientId) => {
  const candidates = (plans || [])
    .filter((p) => String(p.pazienteId) === String(patientId) && p.stato !== 'concluso');
  if (candidates.length === 0) return { status: TARGET_PLAN_STATUS.NONE, plan: null, candidates: [] };
  if (candidates.length === 1) return { status: TARGET_PLAN_STATUS.SINGLE, plan: candidates[0], candidates };
  return { status: TARGET_PLAN_STATUS.AMBIGUOUS, plan: null, candidates };
};

/** POL-AI-005B Workflow G — the three candidate buckets
 *  `planCompleteMissingTooth` needs to decide, without ever guessing, what
 *  "Era il 46" refers to. All three share the same "completed treatment,
 *  optionally filtered to one procedure" scope — they differ only in what
 *  the item's CURRENT `dente` looks like. `procedureNormalizedText` is
 *  `null` for the generic phrasing ("Era il 46", no procedure named) and
 *  matches any procedure; a real value (from the PROCEDURE command shape,
 *  e.g. "la devitalizzazione era il 46") narrows to that procedure only —
 *  two different incomplete procedures for the same patient are never
 *  conflated (see the WORKFLOWS_G "different incomplete procedures"
 *  test). */
const patientCompletedVoci = (plans, patientId, procedureNormalizedText) => {
  const results = [];
  for (const plan of plans || []) {
    if (String(plan.pazienteId) !== String(patientId)) continue;
    (plan.voci || []).forEach((voce, voceIndex) => {
      if (voce.eseguita !== true) return;
      if (procedureNormalizedText && normalizza(voce.prestazione) !== procedureNormalizedText) return;
      results.push({ plan, voceIndex, voce });
    });
  }
  return results;
};

/** Candidates with NO tooth recorded at all — the genuine "missing data"
 *  case Workflow G exists to complete. */
export const findIncompleteToothCandidates = (plans, patientId, procedureNormalizedText) =>
  patientCompletedVoci(plans, patientId, procedureNormalizedText).filter((c) => !c.voce.dente);

/** Candidates whose tooth is ALREADY exactly the value the user just
 *  supplied — repeating "Era il 46" after it already succeeded lands
 *  here, not in NO_MATCH, so it can be reported as a safe no-op instead
 *  of a false "nothing found". */
export const findAlreadyAtToothCandidates = (plans, patientId, procedureNormalizedText, toothValue) =>
  patientCompletedVoci(plans, patientId, procedureNormalizedText).filter((c) => c.voce.dente === toothValue);

/** Candidates whose tooth is already a DIFFERENT known value than the one
 *  just supplied — "Era il 36" after the tooth is already "46" is a
 *  correction/edit request, never a silent overwrite under the "complete
 *  missing data" intent (see CONFLICTING_REPEAT in the task spec). */
export const findConflictingToothCandidates = (plans, patientId, procedureNormalizedText, toothValue) =>
  patientCompletedVoci(plans, patientId, procedureNormalizedText).filter((c) => c.voce.dente && c.voce.dente !== toothValue);

const resolveProcedureStep = (procedureText, { pricelist }) => {
  const resolution = resolveProcedure(procedureText, pricelist);
  const step = Object.freeze({
    type: PLAN_STEP_TYPE.RESOLVE_PROCEDURE,
    procedureText,
    status: resolution.status,
    normalizedText: resolution.normalizedText,
  });
  return { step, resolution };
};

/** Builds the CHECK_EXISTING_TREATMENT / ENSURE_TREATMENT_ITEM /
 *  MARK_TREATMENT_COMPLETED step sequence for one clinical item, given an
 *  already-resolved patient. `markCompleted`: whether this item should
 *  also be marked as executed (workflows A/B/C/E all mark completed;
 *  a plain CREATE_TREATMENT_PLAN item, per §16, does not). */
function buildTreatmentItemSteps({ patientId, procedureText, toothText, markCompleted }, { plans, pricelist }) {
  const steps = [];
  const warnings = [];
  const assumptions = [];
  const blockingReasons = [];

  const { step: resolveProcStep, resolution: procRes } = resolveProcedureStep(procedureText, { pricelist });
  steps.push(resolveProcStep);
  if (procRes.status === PROCEDURE_RESOLUTION_STATUS.AMBIGUOUS) {
    warnings.push(`Prestazione "${procedureText}" ambigua: più voci di listino corrispondono.`);
  }
  if (procRes.status === PROCEDURE_RESOLUTION_STATUS.NOT_FOUND) {
    assumptions.push(`Prestazione "${procedureText}" non trovata nel listino: prezzo non risolvibile.`);
  }

  const tooth = createTooth(toothText);
  if (isToothIncomplete(tooth)) assumptions.push(`Dente non specificato per "${procedureText}": registrato come incompleto, non inventato.`);

  // Match/store by the RESOLVED canonical pricelist name when resolution
  // succeeded, not the raw query text — otherwise "otturazione" and an
  // existing item literally stored as "Otturazione composita" (its real
  // pricelist name) would never recognize each other as the same
  // treatment, breaking idempotency across equally-valid phrasings that
  // resolve to the same procedure. Falls back to the raw text only when
  // NOT_FOUND (nothing canonical to prefer).
  const canonicalProcedureName = procRes.candidate ? procRes.candidate.nome : procedureText;
  const procedureNormalizedText = normalizza(canonicalProcedureName);
  const existing = patientId ? findExistingTreatmentItem(plans, patientId, procedureNormalizedText, tooth) : null;

  steps.push(Object.freeze({
    type: PLAN_STEP_TYPE.CHECK_EXISTING_TREATMENT,
    procedureText,
    tooth,
    found: !!existing,
    existingPlanId: existing ? existing.plan.id : null,
  }));

  const procedureRef = Object.freeze({
    text: procedureText,
    canonicalName: canonicalProcedureName,
    resolutionStatus: procRes.status,
    pricelistItem: procRes.candidate || null,
    price: procRes.candidate ? procRes.candidate.prezzo : PRICE_UNRESOLVED,
  });

  if (!existing) {
    // POL-AI-005B Workflow-G hardening (PO decision 1): a brand-new item
    // needs a target plan to land in. Resolve that NOW, at plan/preview
    // time — not deferred to execution — so an ambiguous target makes the
    // whole Action Plan non-confirmable (`blocked`) instead of silently
    // guessing later. `pickTargetPlanForNewItem` never picks "latest" on
    // its own; the executor re-checks the same thing again immediately
    // before writing (TOCTOU: a second open plan could appear between
    // preview and confirm).
    const targetPlan = patientId ? pickTargetPlanForNewItem(plans, patientId) : { status: TARGET_PLAN_STATUS.NONE, plan: null, candidates: [] };
    if (targetPlan.status === TARGET_PLAN_STATUS.AMBIGUOUS) {
      blockingReasons.push(`Più piani di cura attivi trovati per il paziente: specifica in quale piano inserire "${procedureText}" prima di confermare.`);
      steps.push(Object.freeze({
        type: PLAN_STEP_TYPE.TARGET_PLAN_AMBIGUOUS,
        procedureText,
        candidatePlanIds: targetPlan.candidates.map((p) => p.id),
      }));
    }
    steps.push(Object.freeze({
      type: PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM,
      procedureRef,
      tooth,
      targetPlanId: targetPlan.status === TARGET_PLAN_STATUS.SINGLE ? targetPlan.plan.id : null,
      requiredPermissions: [REQUIRED_PERMISSION.CLINICAL],
    }));
  }

  if (markCompleted) {
    steps.push(Object.freeze({
      type: PLAN_STEP_TYPE.MARK_TREATMENT_COMPLETED,
      procedureRef,
      tooth,
      existingPlanId: existing ? existing.plan.id : null,
      existingVoceIndex: existing ? existing.voceIndex : null,
      requiredPermissions: [REQUIRED_PERMISSION.CLINICAL],
    }));
  }

  return { steps, warnings, assumptions, blockingReasons, procedureRef, tooth };
}

function buildPendingPaymentSteps({ patientId, amount }, { payments }) {
  const steps = [];
  const warnings = [];
  if (amount === null || amount === undefined) return { steps, warnings };

  const duplicate = patientId ? findLikelyDuplicatePendingPayment(payments, patientId, amount) : null;
  steps.push(Object.freeze({
    type: PLAN_STEP_TYPE.CHECK_EXISTING_PENDING_PAYMENT,
    amount,
    found: !!duplicate,
    existingPaymentId: duplicate ? duplicate.id : null,
  }));
  if (duplicate) warnings.push(`Possibile pagamento in sospeso già registrato per lo stesso importo (${amount} €).`);

  steps.push(Object.freeze({
    type: PLAN_STEP_TYPE.ENSURE_PENDING_PAYMENT,
    amount,
    existingPaymentId: duplicate ? duplicate.id : null,
    requiredPermissions: [REQUIRED_PERMISSION.FINANCIAL],
  }));
  return { steps, warnings };
}

const permissionWarnings = (steps, homePermissions) => {
  const flags = buildIntelligencePermissions(homePermissions);
  const warnings = [];
  const requiredPermissions = new Set();
  for (const step of steps) {
    for (const permission of step.requiredPermissions || []) {
      requiredPermissions.add(permission);
      if (!flags[permission]) {
        warnings.push(`Permesso mancante per lo step ${step.type}: richiede "${permission}".`);
      }
    }
  }
  return { requiredPermissions: [...requiredPermissions], warnings, blocked: warnings.length > 0 };
};

const finalizePlan = ({
  intent, patientText, patientResolution, steps, warnings, assumptions, confidence, homePermissions,
  blockingReasons = [], patientRefMechanism = 'text', patientRefContextId = null,
}) => {
  const patientOk = patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED;
  const patientId = patientOk ? patientResolution.candidate.id : null;
  const allSteps = [Object.freeze({
    type: PLAN_STEP_TYPE.RESOLVE_PATIENT,
    patientText,
    status: patientResolution.status,
    candidateCount: patientResolution.candidates.length,
  }), ...steps];
  if (!patientOk) {
    allSteps.push(Object.freeze({ type: PLAN_STEP_TYPE.VERIFY_REQUIRED_LATER, reason: `Paziente non risolto (${patientResolution.status}).` }));
  }
  const { requiredPermissions, warnings: permWarnings, blocked: permBlocked } = permissionWarnings(allSteps, homePermissions || {});
  return Object.freeze({
    actionId: uid('plan'),
    intent,
    patientRef: Object.freeze({
      text: patientText,
      status: patientResolution.status,
      candidate: patientResolution.candidate,
      candidates: patientResolution.candidates,
      // POL-AI-005B Workflow G: 'context' means this patient was resolved
      // from the app's current-patient context (no name in the command
      // text at all) — see resolveContextualPatient. `contextPatientId`
      // freezes the id that resolution actually landed on, so
      // checkPreconditions can re-verify `entities.patientId` still
      // matches it rather than trusting either blindly (the same
      // tampering-defense pattern as the text-based re-resolution).
      mechanism: patientRefMechanism,
      contextPatientId: patientRefContextId,
    }),
    entities: Object.freeze({ patientId }),
    steps: Object.freeze(allSteps),
    warnings: Object.freeze([...warnings, ...blockingReasons, ...permWarnings]),
    assumptions: Object.freeze(assumptions),
    confidence,
    requiredPermissions: Object.freeze(requiredPermissions),
    requiresConfirmation: true, // Phase A invariant: every plan requires human confirmation before any future executor may act — see §7.
    blocked: permBlocked || blockingReasons.length > 0,
  });
};

/** Workflow A/E — RECORD_TREATMENT_AND_PENDING_PAYMENT /
 *  RECORD_MULTIPLE_TREATMENTS_AND_PAYMENT (§15). One or more clinical
 *  items, each marked completed, plus a single pending-payment step for
 *  the stated total amount. */
function planTreatmentAndPayment(parsed, context) {
  const patientResolution = resolvePatient(parsed.patientText, context.patients, { studioId: context.studioId });
  const patientId = patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED ? patientResolution.candidate.id : null;
  const steps = [];
  const warnings = [];
  const assumptions = [];
  const blockingReasons = [];
  for (const item of parsed.items) {
    const built = buildTreatmentItemSteps({ patientId, procedureText: item.procedureText, toothText: item.toothText, markCompleted: parsed.executionCompleted }, context);
    steps.push(...built.steps);
    warnings.push(...built.warnings);
    assumptions.push(...built.assumptions);
    blockingReasons.push(...built.blockingReasons);
  }
  const payment = buildPendingPaymentSteps({ patientId, amount: parsed.amount }, context);
  steps.push(...payment.steps);
  warnings.push(...payment.warnings);

  return finalizePlan({
    intent: parsed.commandIntent,
    patientText: parsed.patientText,
    patientResolution,
    steps,
    warnings,
    assumptions,
    blockingReasons,
    confidence: patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED ? 0.9 : 0.4,
    homePermissions: context.homePermissions,
  });
}

/** Workflow B — CREATE_TREATMENT_PLAN (§16). Each item preserves its own
 *  procedure/tooth/price-resolution state; items are never marked
 *  completed (a new plan starts pending) and prices are never invented —
 *  PRICE_UNRESOLVED is explicit when the pricelist has no match. */
function planCreateTreatmentPlan(parsed, context) {
  const patientResolution = resolvePatient(parsed.patientText, context.patients, { studioId: context.studioId });
  const patientId = patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED ? patientResolution.candidate.id : null;
  const steps = [];
  const warnings = [];
  const assumptions = [];
  const blockingReasons = [];
  for (const item of parsed.items) {
    const built = buildTreatmentItemSteps({ patientId, procedureText: item.procedureText, toothText: item.toothText, markCompleted: false }, context);
    steps.push(...built.steps);
    warnings.push(...built.warnings);
    assumptions.push(...built.assumptions);
    blockingReasons.push(...built.blockingReasons);
    if (built.procedureRef.price === PRICE_UNRESOLVED) warnings.push(`Prezzo non risolto per "${item.procedureText}" — PRICE_UNRESOLVED, non impostato a zero.`);
  }
  return finalizePlan({
    intent: parsed.commandIntent,
    patientText: parsed.patientText,
    patientResolution,
    steps,
    warnings,
    assumptions,
    blockingReasons,
    confidence: patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED ? 0.9 : 0.4,
    homePermissions: context.homePermissions,
  });
}

/** Workflow C — MARK_TREATMENT_COMPLETED (§17). Reuses an existing plan
 *  item when one already represents this procedure/tooth for the patient
 *  (no duplicate ENSURE_TREATMENT_ITEM step); otherwise plans creating it
 *  first — proving the idempotent orchestration §17 asks for. */
function planMarkTreatmentCompleted(parsed, context) {
  const patientResolution = resolvePatient(parsed.patientText, context.patients, { studioId: context.studioId });
  const patientId = patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED ? patientResolution.candidate.id : null;
  const item = parsed.items[0];
  const built = buildTreatmentItemSteps({ patientId, procedureText: item.procedureText, toothText: item.toothText, markCompleted: true }, context);
  return finalizePlan({
    intent: parsed.commandIntent,
    patientText: parsed.patientText,
    patientResolution,
    steps: built.steps,
    warnings: built.warnings,
    assumptions: built.assumptions,
    blockingReasons: built.blockingReasons,
    confidence: patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED ? 0.9 : 0.4,
    homePermissions: context.homePermissions,
  });
}

/** Workflow G — COMPLETE_MISSING_TOOTH ("Era il 46"). No patient text at
 *  all: the patient comes ONLY from the app's current-patient context
 *  (`context.currentPatient`), re-verified against the fresh, tenant-
 *  scoped `patients` array (see resolveContextualPatient) — never
 *  invented from thin air. Never touches price/payment/procedure/status;
 *  the only field this can ever change is `dente` on an item that already
 *  exists. UPDATE-INCOMPLETE-RECORD, never CREATE-TREATMENT (see
 *  NO_MATCH below) — this intent creates nothing. */
function planCompleteMissingTooth(parsed, context) {
  const patientResolution = resolveContextualPatient(context.currentPatient, context.patients, { studioId: context.studioId });
  const patientId = patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED ? patientResolution.candidate.id : null;
  const contextPatientId = context.currentPatient?.id ?? null;

  const steps = [];
  const warnings = [];
  const assumptions = [];
  const blockingReasons = [];

  if (!patientId) {
    blockingReasons.push('Nessun paziente in contesto: apri la scheda del paziente e riprova.');
    return finalizePlan({
      intent: parsed.commandIntent, patientText: null, patientResolution, steps, warnings, assumptions, blockingReasons,
      confidence: 0.3, homePermissions: context.homePermissions,
      patientRefMechanism: 'context', patientRefContextId: contextPatientId,
    });
  }

  const tooth = createTooth(parsed.toothText);
  if (tooth.state !== TOOTH_STATE.KNOWN) {
    blockingReasons.push(`Elemento dentario "${parsed.toothText}" non valido o non riconosciuto: specifica un numero di elemento (11-48).`);
    return finalizePlan({
      intent: parsed.commandIntent, patientText: null, patientResolution, steps, warnings, assumptions, blockingReasons,
      confidence: 0.3, homePermissions: context.homePermissions,
      patientRefMechanism: 'context', patientRefContextId: contextPatientId,
    });
  }

  const procedureNormalizedText = parsed.procedureText ? normalizza(parsed.procedureText) : null;
  const incomplete = findIncompleteToothCandidates(context.plans, patientId, procedureNormalizedText);
  const alreadyAtTarget = incomplete.length === 0 ? findAlreadyAtToothCandidates(context.plans, patientId, procedureNormalizedText, tooth.value) : [];
  const conflicting = (incomplete.length === 0 && alreadyAtTarget.length === 0)
    ? findConflictingToothCandidates(context.plans, patientId, procedureNormalizedText, tooth.value)
    : [];

  let resolution; // SINGLE_MATCH | ALREADY_COMPLETE | MULTIPLE_MATCH | CONFLICTING_VALUE | NO_MATCH
  let target = null;

  if (incomplete.length >= 2) {
    resolution = 'MULTIPLE_MATCH';
    const describe = (c) => `${c.voce.prestazione}${c.plan.titolo ? ` (${c.plan.titolo})` : ''}${c.plan.data ? `, ${c.plan.data}` : ''}`;
    blockingReasons.push(`Ho trovato ${incomplete.length} prestazioni eseguite senza elemento dentario compatibili: ${incomplete.map(describe).join('; ')}. Specifica a quale ti riferisci.`);
  } else if (incomplete.length === 1) {
    resolution = 'SINGLE_MATCH';
    target = incomplete[0];
  } else if (alreadyAtTarget.length >= 1) {
    resolution = 'ALREADY_COMPLETE';
    target = alreadyAtTarget[0];
    warnings.push(`L'elemento dentario per "${target.voce.prestazione}" è già registrato come ${tooth.value}: nessuna modifica necessaria.`);
  } else if (conflicting.length >= 1) {
    resolution = 'CONFLICTING_VALUE';
    if (conflicting.length === 1) {
      blockingReasons.push(`Il valore già registrato per "${conflicting[0].voce.prestazione}" è l'elemento ${conflicting[0].voce.dente}, non ${tooth.value}. La correzione di un elemento già noto non è ancora supportata da questo comando: nessuna scrittura eseguita.`);
    } else {
      blockingReasons.push(`Sono presenti più prestazioni con un elemento dentario già registrato diverso da ${tooth.value}: specifica la prestazione per procedere.`);
    }
  } else {
    resolution = 'NO_MATCH';
    blockingReasons.push(parsed.procedureText
      ? `Nessuna prestazione "${parsed.procedureText}" eseguita con elemento dentario mancante trovata per questo paziente.`
      : 'Nessuna prestazione eseguita con elemento dentario mancante trovata per questo paziente.');
  }

  steps.push(Object.freeze({
    type: PLAN_STEP_TYPE.RESOLVE_INCOMPLETE_TREATMENT,
    procedureText: parsed.procedureText,
    tooth,
    resolution,
    candidateCount: incomplete.length || alreadyAtTarget.length || conflicting.length,
  }));

  if (target) {
    steps.push(Object.freeze({
      type: PLAN_STEP_TYPE.COMPLETE_TREATMENT_TOOTH,
      existingPlanId: target.plan.id,
      existingVoceIndex: target.voceIndex,
      procedureRef: Object.freeze({ text: target.voce.prestazione, canonicalName: target.voce.prestazione }),
      procedureNormalizedText: normalizza(target.voce.prestazione),
      currentTooth: target.voce.dente || null,
      newTooth: tooth,
      expectedOutcome: resolution, // 'SINGLE_MATCH' (real write) or 'ALREADY_COMPLETE' (no-op)
      requiredPermissions: [REQUIRED_PERMISSION.CLINICAL],
    }));
  }

  return finalizePlan({
    intent: parsed.commandIntent,
    patientText: null,
    patientResolution,
    steps,
    warnings,
    assumptions,
    blockingReasons,
    confidence: resolution === 'SINGLE_MATCH' || resolution === 'ALREADY_COMPLETE' ? 0.9 : 0.4,
    homePermissions: context.homePermissions,
    patientRefMechanism: 'context',
    patientRefContextId: contextPatientId,
  });
}

/** Workflow POL-FIN-001/F1 — CREATE_PAYMENT_PLAN ("Dividi ... in N rate").
 *  Context-resolved patient only (like Workflow G — no patient name in
 *  this command shape). The target amount to split is ALWAYS the
 *  canonical `totalUnscheduledOutstanding` from
 *  `computePatientFinancialSummary` — a stated amount in the command text
 *  is a cross-check, never the authority (Critical Domain Rule: "the
 *  system must NOT invent... a payment schedule" starts from trusting
 *  canonical data, not a spoken number). At most one ACTIVE payment plan
 *  per patient is enforced here (task §5: "no payment plan / an active
 *  payment plan / historical plans") — never silently supersedes an
 *  existing one. */
function planCreatePaymentPlan(parsed, context) {
  const patientResolution = resolveContextualPatient(context.currentPatient, context.patients, { studioId: context.studioId });
  const patientId = patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED ? patientResolution.candidate.id : null;
  const contextPatientId = context.currentPatient?.id ?? null;
  const steps = [];
  const warnings = [];
  const assumptions = [];
  const blockingReasons = [];

  const finalize = (confidence) => finalizePlan({
    intent: parsed.commandIntent, patientText: null, patientResolution, steps, warnings, assumptions, blockingReasons,
    confidence, homePermissions: context.homePermissions, patientRefMechanism: 'context', patientRefContextId: contextPatientId,
  });

  if (!patientId) {
    blockingReasons.push('Nessun paziente in contesto: apri la scheda del paziente e riprova.');
    return finalize(0.3);
  }

  const existingActivePlans = (context.paymentPlans || []).filter((p) => String(p.patientId) === String(patientId) && p.status === PLAN_STATUS.ACTIVE);
  if (existingActivePlans.length > 0) {
    steps.push(Object.freeze({ type: PLAN_STEP_TYPE.CHECK_EXISTING_PAYMENT_PLAN, found: true, existingPlanId: existingActivePlans[0].id }));
    blockingReasons.push('Il paziente ha già un piano di pagamento attivo: completalo o annullalo prima di crearne uno nuovo.');
    return finalize(0.3);
  }
  steps.push(Object.freeze({ type: PLAN_STEP_TYPE.CHECK_EXISTING_PAYMENT_PLAN, found: false, existingPlanId: null }));

  const summary = computePatientFinancialSummary(context, patientId, { today: context.today || today() });
  const canonicalAmount = summary.totalUnscheduledOutstanding;

  if (parsed.statedAmount !== null && !amountsEqual(parsed.statedAmount, canonicalAmount)) {
    blockingReasons.push(`L'importo indicato (${roundMoney(parsed.statedAmount)} €) non corrisponde al residuo non pianificato risultante dai dati canonici (${canonicalAmount} €).`);
  }
  if (canonicalAmount <= 0) {
    blockingReasons.push('Non c\'è alcun importo residuo non pianificato da suddividere per questo paziente.');
  }

  const startDateIso = parsed.startDayMonth ? resolveStartDateIso(parsed.startDayMonth, context.today || today()) : (context.today || today());

  let deadlines = [];
  if (blockingReasons.length === 0) {
    deadlines = buildInstallmentDeadlines({ totalAmount: canonicalAmount, count: parsed.count, startDate: startDateIso });
  }

  steps.push(Object.freeze({
    type: PLAN_STEP_TYPE.CREATE_PAYMENT_PLAN,
    planType: PLAN_TYPE.INSTALLMENTS,
    totalAmount: canonicalAmount,
    count: parsed.count,
    startDate: startDateIso,
    deadlines: Object.freeze(deadlines),
    requiredPermissions: [REQUIRED_PERMISSION.FINANCIAL],
  }));

  return finalize(blockingReasons.length ? 0.3 : 0.9);
}

/** Finds this patient's currently-open deadlines (belonging to an ACTIVE
 *  payment plan, remaining > 0) — the pool `planRecordPaymentAgainstDeadline`
 *  resolves a payment-received command against. */
function findOpenDeadlines(context, patientId) {
  const activePlanIds = new Set((context.paymentPlans || [])
    .filter((p) => String(p.patientId) === String(patientId) && p.status === PLAN_STATUS.ACTIVE)
    .map((p) => String(p.id)));
  return (context.paymentDeadlines || [])
    .filter((d) => String(d.patientId) === String(patientId) && activePlanIds.has(String(d.paymentPlanId)))
    .filter((d) => deadlineRemainingAmount(d, context.paymentAllocations || []) > 0);
}

/** Workflow POL-FIN-001/F2-F3 — RECORD_PAYMENT_AGAINST_DEADLINE ("<patient>
 *  mi ha dato <amount>" / "Ha pagato <amount> della rata di <ref>").
 *  Never invents an allocation (task §11): exactly one open deadline ->
 *  PROPOSE allocating to it; 2+ -> ask; none -> offer the general
 *  outstanding balance instead. A `deadlineRefText` (month name) narrows
 *  the candidate pool first; if it matches nothing, this falls back to
 *  the full open-deadline pool rather than failing outright (task §18's
 *  own example still expects a sensible outcome even if the "rata di
 *  agosto" phrasing doesn't exactly match a due date). */
function planRecordPaymentAgainstDeadline(parsed, context) {
  let patientResolution;
  let mechanism;
  let contextPatientId = null;
  if (parsed.patientText) {
    patientResolution = resolvePatient(parsed.patientText, context.patients, { studioId: context.studioId });
    mechanism = 'text';
  } else {
    patientResolution = resolveContextualPatient(context.currentPatient, context.patients, { studioId: context.studioId });
    mechanism = 'context';
    contextPatientId = context.currentPatient?.id ?? null;
  }
  const patientId = patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED ? patientResolution.candidate.id : null;
  const steps = [];
  const warnings = [];
  const assumptions = [];
  const blockingReasons = [];

  const finalize = (confidence) => finalizePlan({
    intent: parsed.commandIntent, patientText: mechanism === 'text' ? parsed.patientText : null, patientResolution,
    steps, warnings, assumptions, blockingReasons, confidence, homePermissions: context.homePermissions,
    patientRefMechanism: mechanism, patientRefContextId: contextPatientId,
  });

  if (!patientId) {
    blockingReasons.push(mechanism === 'context' ? 'Nessun paziente in contesto: apri la scheda del paziente e riprova.' : `Paziente non risolto (${patientResolution.status}).`);
    return finalize(0.3);
  }

  const openDeadlines = findOpenDeadlines(context, patientId);
  let candidates = openDeadlines;
  if (parsed.deadlineRefText) {
    const monthNum = ITALIAN_MONTHS[parsed.deadlineRefText.trim().toLowerCase()];
    if (monthNum) {
      const byMonth = openDeadlines.filter((d) => d.dueDate && Number(String(d.dueDate).slice(5, 7)) === monthNum);
      if (byMonth.length > 0) candidates = byMonth;
      else warnings.push(`Nessuna scadenza aperta trovata per "${parsed.deadlineRefText}": valutate tutte le scadenze aperte del paziente.`);
    } else {
      warnings.push(`Riferimento "${parsed.deadlineRefText}" non riconosciuto: valutate tutte le scadenze aperte del paziente.`);
    }
  }

  let resolution;
  let target = null;
  if (candidates.length === 0) {
    resolution = 'NO_DEADLINE';
  } else if (candidates.length === 1) {
    resolution = 'SINGLE_MATCH';
    [target] = candidates;
  } else {
    resolution = 'MULTIPLE_MATCH';
  }

  steps.push(Object.freeze({
    type: PLAN_STEP_TYPE.RESOLVE_PAYMENT_ALLOCATION,
    resolution,
    candidateCount: candidates.length,
    amount: parsed.amount,
  }));

  if (resolution === 'MULTIPLE_MATCH') {
    const describe = (d) => `${d.label || 'scadenza'}${d.dueDate ? ` (${d.dueDate})` : ''} — residuo ${deadlineRemainingAmount(d, context.paymentAllocations || [])} €`;
    blockingReasons.push(`Ho trovato ${candidates.length} scadenze aperte compatibili: ${candidates.map(describe).join('; ')}. Specifica a quale ti riferisci.`);
    return finalize(0.4);
  }

  steps.push(Object.freeze({
    type: PLAN_STEP_TYPE.RECORD_PAYMENT_ALLOCATION,
    amount: parsed.amount,
    targetDeadlineId: target ? target.id : null,
    targetDeadlineSnapshot: target ? Object.freeze({
      label: target.label, dueDate: target.dueDate, amountDue: target.amountDue,
      remaining: deadlineRemainingAmount(target, context.paymentAllocations || []),
    }) : null,
    resolution,
    requiredPermissions: [REQUIRED_PERMISSION.FINANCIAL],
  }));

  return finalize(0.9);
}

/**
 * buildActionPlan(parsedCommand, context) -> Action Plan (frozen, plain
 * object; JSON-serializable). `context = { patients, plans, payments,
 * pricelist, homePermissions, studioId, currentPatient, paymentPlans,
 * paymentDeadlines, paymentAllocations, today }` — the caller's own
 * already-loaded, already-tenant-scoped/authorized data; nothing here
 * fetches anything. `currentPatient` is used by Workflow G
 * (COMPLETE_MISSING_TOOTH) and by CREATE_PAYMENT_PLAN — neither has a
 * patient name in its command shape. `paymentPlans`/`paymentDeadlines`/
 * `paymentAllocations` (POL-FIN-001) are optional and default to `[]` —
 * older callers that don't yet load them keep working exactly as before,
 * they simply never match any payment-plan-shaped command. Returns
 * `null` if `parsedCommand` is null (see commandParser.js's
 * model-fallback contract).
 */
export function buildActionPlan(parsedCommand, context) {
  if (!parsedCommand) return null;
  switch (parsedCommand.commandIntent) {
    case COMMAND_INTENT.RECORD_TREATMENT_AND_PENDING_PAYMENT:
    case COMMAND_INTENT.RECORD_MULTIPLE_TREATMENTS_AND_PAYMENT:
      return planTreatmentAndPayment(parsedCommand, context);
    case COMMAND_INTENT.CREATE_TREATMENT_PLAN:
      return planCreateTreatmentPlan(parsedCommand, context);
    case COMMAND_INTENT.MARK_TREATMENT_COMPLETED:
      return planMarkTreatmentCompleted(parsedCommand, context);
    case COMMAND_INTENT.COMPLETE_MISSING_TOOTH:
      return planCompleteMissingTooth(parsedCommand, context);
    case COMMAND_INTENT.CREATE_PAYMENT_PLAN:
      return planCreatePaymentPlan(parsedCommand, context);
    case COMMAND_INTENT.RECORD_PAYMENT_AGAINST_DEADLINE:
      return planRecordPaymentAgainstDeadline(parsedCommand, context);
    default:
      return null;
  }
}

/**
 * executeActionPlan(plan) -> Promise<never>
 * Phase A safety boundary (§7): explicitly stubbed and non-writing. Any
 * caller reaching this in Phase A has mis-wired something — it always
 * rejects rather than silently doing nothing, so a future accidental call
 * fails loudly instead of looking like a successful no-op. Phase B
 * replaces this with the real CONFIRM -> ACT -> VERIFY executor.
 */
export async function executeActionPlan() {
  throw new Error('POL-AI-005A: executeActionPlan is not implemented in Phase A. No write path exists yet — this is an intentional safety stub.');
}
