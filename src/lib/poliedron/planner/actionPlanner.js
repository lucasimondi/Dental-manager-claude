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

import { COMMAND_INTENT } from './commandParser.js';
import { resolvePatient, PATIENT_RESOLUTION_STATUS } from './patientResolver.js';
import { resolveProcedure, PROCEDURE_RESOLUTION_STATUS } from './procedureResolver.js';
import { createTooth, isToothIncomplete } from './toothModel.js';
import { buildIntelligencePermissions } from '../permissionEngine.js';
import { normalizza } from '../../ricercaPazienti.js';

export const PLAN_STEP_TYPE = Object.freeze({
  RESOLVE_PATIENT: 'RESOLVE_PATIENT',
  RESOLVE_PROCEDURE: 'RESOLVE_PROCEDURE',
  CHECK_EXISTING_TREATMENT: 'CHECK_EXISTING_TREATMENT',
  ENSURE_TREATMENT_ITEM: 'ENSURE_TREATMENT_ITEM',
  MARK_TREATMENT_COMPLETED: 'MARK_TREATMENT_COMPLETED',
  CHECK_EXISTING_PENDING_PAYMENT: 'CHECK_EXISTING_PENDING_PAYMENT',
  ENSURE_PENDING_PAYMENT: 'ENSURE_PENDING_PAYMENT',
  VERIFY_REQUIRED_LATER: 'VERIFY_REQUIRED_LATER',
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

const sameProcedureAndTooth = (voce, procedureNormalizedText, tooth) => {
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
const findExistingTreatmentItem = (plans, patientId, procedureNormalizedText, tooth) => {
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
const findLikelyDuplicatePendingPayment = (payments, patientId, amount) => {
  if (amount === null || amount === undefined) return null;
  return (payments || []).find((p) => String(p.pazienteId) === String(patientId)
    && Number(p.importo) === Number(amount)
    && p.stato !== 'pagato') || null;
};

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

  const procedureNormalizedText = procRes.normalizedText || normalizza(procedureText);
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
    resolutionStatus: procRes.status,
    pricelistItem: procRes.candidate || null,
    price: procRes.candidate ? procRes.candidate.prezzo : PRICE_UNRESOLVED,
  });

  if (!existing) {
    steps.push(Object.freeze({
      type: PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM,
      procedureRef,
      tooth,
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

  return { steps, warnings, assumptions, procedureRef, tooth };
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

const finalizePlan = ({ intent, patientText, patientResolution, steps, warnings, assumptions, confidence, homePermissions }) => {
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
  const { requiredPermissions, warnings: permWarnings, blocked } = permissionWarnings(allSteps, homePermissions || {});
  return Object.freeze({
    actionId: uid('plan'),
    intent,
    patientRef: Object.freeze({
      text: patientText,
      status: patientResolution.status,
      candidate: patientResolution.candidate,
      candidates: patientResolution.candidates,
    }),
    entities: Object.freeze({ patientId }),
    steps: Object.freeze(allSteps),
    warnings: Object.freeze([...warnings, ...permWarnings]),
    assumptions: Object.freeze(assumptions),
    confidence,
    requiredPermissions: Object.freeze(requiredPermissions),
    requiresConfirmation: true, // Phase A invariant: every plan requires human confirmation before any future executor may act — see §7.
    blocked,
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
  for (const item of parsed.items) {
    const built = buildTreatmentItemSteps({ patientId, procedureText: item.procedureText, toothText: item.toothText, markCompleted: parsed.executionCompleted }, context);
    steps.push(...built.steps);
    warnings.push(...built.warnings);
    assumptions.push(...built.assumptions);
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
  for (const item of parsed.items) {
    const built = buildTreatmentItemSteps({ patientId, procedureText: item.procedureText, toothText: item.toothText, markCompleted: false }, context);
    steps.push(...built.steps);
    warnings.push(...built.warnings);
    assumptions.push(...built.assumptions);
    if (built.procedureRef.price === PRICE_UNRESOLVED) warnings.push(`Prezzo non risolto per "${item.procedureText}" — PRICE_UNRESOLVED, non impostato a zero.`);
  }
  return finalizePlan({
    intent: parsed.commandIntent,
    patientText: parsed.patientText,
    patientResolution,
    steps,
    warnings,
    assumptions,
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
    confidence: patientResolution.status === PATIENT_RESOLUTION_STATUS.RESOLVED ? 0.9 : 0.4,
    homePermissions: context.homePermissions,
  });
}

/**
 * buildActionPlan(parsedCommand, context) -> Action Plan (frozen, plain
 * object; JSON-serializable). `context = { patients, plans, payments,
 * pricelist, homePermissions, studioId }` — the caller's own already-
 * loaded, already-tenant-scoped/authorized data; nothing here fetches
 * anything. Returns `null` if `parsedCommand` is null (see
 * commandParser.js's model-fallback contract).
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
