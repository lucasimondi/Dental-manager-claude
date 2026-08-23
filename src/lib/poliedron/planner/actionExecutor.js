/* POL-AI-005B — the real CONFIRM -> ACT -> VERIFY executor.
   This is deliberately a SEPARATE, differently-named export from
   actionPlanner.js's `executeActionPlan`, which stays exactly as the
   Phase A safety stub it always was (always throws, never writes) — a
   permanent regression guard that that specific function must never gain
   a write path. `runActionPlan` here is the real thing, called only
   after a human has explicitly confirmed the preview (see
   PoliedronActionPreviewLevel2.jsx).

   Product Owner decisions this implements literally:
   - no true DB transaction: steps run sequentially, each individually
     re-verified by reading the row back after writing;
   - every run reports SUCCESS / PARTIAL / FAILED with completedSteps /
     failedStep / recoveryActions — never a silent partial success;
   - no client-side auto-rollback of a partially-applied plan;
   - all writes go through treatmentPlanService.js/paymentService.js —
     never a parallel Poliedron-only write path, never raw Supabase calls
     from this file.

   TOCTOU / stale-preview safety: every idempotency check
   (findExistingTreatmentItem / findLikelyDuplicatePendingPayment) is
   re-run here against a FRESH read taken immediately before each write —
   never against the Action Plan's own (by-then possibly stale) snapshot.
   Permissions are re-checked here too, immediately before executing,
   using the exact same buildIntelligencePermissions() the plan preview
   used — not a second definition of what "allowed" means. */

import { PLAN_STEP_TYPE, findExistingTreatmentItem, TARGET_PLAN_STATUS, PRICE_UNRESOLVED } from './actionPlanner.js';
import { COMMAND_INTENT } from './commandParser.js';
import { resolvePatient, PATIENT_RESOLUTION_STATUS } from './patientResolver.js';
import { buildIntelligencePermissions } from '../permissionEngine.js';
import { normalizza } from '../../ricercaPazienti.js';
import { amountsEqual } from '../../domain/money.js';
import {
  buildTreatmentItem, buildNewPlan, markTreatmentItemCompleted, pickTargetPlanForNewItem, setItemTooth,
  loadPatientPlans, createPlan, updatePlan, getPlanById,
} from '../../domain/treatmentPlanService.js';
import {
  buildPendingPayment, buildCollectedPayment, findLikelyDuplicatePendingPayment, loadPatientPayments, createPayment,
} from '../../domain/paymentService.js';
import {
  PLAN_STATUS, buildNewPaymentPlan, buildDeadlineRows, buildAllocation,
  loadPatientPaymentPlans, loadPatientDeadlines, loadPatientAllocations,
  createPaymentPlan, createDeadline, createAllocation, deadlineRemainingAmount,
} from '../../domain/paymentPlanService.js';
import { computePatientFinancialSummary } from '../../domain/patientFinancialSummary.js';

export const RUN_OUTCOME = Object.freeze({ SUCCESS: 'SUCCESS', PARTIAL: 'PARTIAL', FAILED: 'FAILED' });

const failResult = (completedSteps, step, message, recoveryActions) => ({
  outcome: completedSteps.length > 0 ? RUN_OUTCOME.PARTIAL : RUN_OUTCOME.FAILED,
  completedSteps,
  failedStep: { type: step.type, message },
  recoveryActions,
});

const guardrailFailure = (type, reason, recoveryActions) => ({
  outcome: RUN_OUTCOME.FAILED, completedSteps: [], failedStep: { type, reason }, recoveryActions,
});

/** Re-checks every guardrail that could have changed between preview and
 *  this exact confirm click: plan not blocked, permissions still granted
 *  (capability change between preview and confirm — reported as its own
 *  'PERMISSION' failedStep type, distinct from other preconditions, so a
 *  caller can react to it specifically, e.g. "ask an authorized user"),
 *  and the resolved patient still present in the caller's freshly-supplied
 *  `patients` array (patient deleted/reassigned, or a stale/tampered plan
 *  pointing at an id the caller didn't actually authorize).
 *
 *  Action-plan tampering defense-in-depth: presence-in-array alone would
 *  accept a plan object whose `entities.patientId` was rewritten (client-
 *  side tampering, a replayed/edited plan) to point at a DIFFERENT, still
 *  same-tenant patient than the text the plan was actually built from
 *  (`patientRef.text`). Re-resolving that original text fresh and requiring
 *  it to land on the exact same id closes that gap — the executor never
 *  trusts `entities.patientId` as a bare fact, only as a claim that must
 *  still match what the plan's own patient text resolves to right now. */
function checkPreconditions(plan, { patients, homePermissions, studioId }) {
  if (!plan) return { ok: false, result: guardrailFailure('PRECONDITION', 'Action Plan mancante.', ['Ripeti la richiesta.']) };
  if (plan.blocked) return { ok: false, result: guardrailFailure('PRECONDITION', 'Il piano è bloccato (permessi insufficienti al momento della pianificazione).', ['Verifica i permessi e ripeti la pianificazione.']) };
  const freshFlags = buildIntelligencePermissions(homePermissions || {});
  for (const permission of plan.requiredPermissions) {
    if (!freshFlags[permission]) {
      return { ok: false, result: guardrailFailure('PERMISSION', `Permesso "${permission}" non più valido.`, ['Il permesso richiesto è cambiato dopo l\'anteprima: richiedi una nuova conferma a un utente autorizzato.']) };
    }
  }
  const patientId = plan.entities?.patientId;
  const patientStillValid = patientId && (patients || []).some((p) => String(p.id) === String(patientId));
  if (!patientStillValid) {
    return { ok: false, result: guardrailFailure('PATIENT_NOT_FOUND', 'Il paziente risolto non è più disponibile nei dati correnti.', ['Il paziente potrebbe essere stato eliminato o non è più nel tuo perimetro: ripeti la richiesta.']) };
  }
  // POL-AI-005B Workflow G: a plan resolved from the app's current-patient
  // CONTEXT (no patient text at all — e.g. "Era il 46") re-verifies
  // differently: there is no text to re-resolve, so instead this re-checks
  // that `entities.patientId` still matches the exact id the context
  // resolution landed on at plan-build time (`patientRef.contextPatientId`,
  // frozen into the plan) — the same tampering defense as the text-based
  // path, adapted to a mechanism that has no text.
  if (plan.patientRef?.mechanism === 'context') {
    if (String(plan.patientRef?.contextPatientId ?? '') !== String(patientId)) {
      return { ok: false, result: guardrailFailure('PATIENT_NOT_FOUND', 'Il paziente non corrisponde più al contesto originale della richiesta: il piano potrebbe essere stato alterato.', ['Ripeti la richiesta da zero.']) };
    }
    return { ok: true, patientId };
  }
  const reResolved = resolvePatient(plan.patientRef?.text, patients, { studioId });
  if (reResolved.status !== PATIENT_RESOLUTION_STATUS.RESOLVED || String(reResolved.candidate.id) !== String(patientId)) {
    return { ok: false, result: guardrailFailure('PATIENT_NOT_FOUND', 'Il paziente non corrisponde più al testo originale della richiesta: il piano potrebbe essere stato alterato.', ['Ripeti la richiesta da zero.']) };
  }
  return { ok: true, patientId };
}

/** `excludeTargets`: a Set of `${planId}:${voceIndex}` keys this SAME run
 *  has already created moments ago. Without this, a fresh idempotency
 *  re-check for a second sibling item (e.g. the two unknown-tooth fillings
 *  in workflow F) would find the FIRST sibling — just written — and
 *  incorrectly treat it as "already existing", collapsing two explicit,
 *  distinct treatments into one. Cross-request/cross-session duplicates
 *  are still caught normally; only this run's own just-created items are
 *  excluded from being mistaken for a pre-existing match. */
async function executeEnsureTreatmentItemStep(step, { db, patientId, excludeTargets }) {
  const freshPlans = await loadPatientPlans(db, patientId);
  const procedureNormalizedText = normalizza(step.procedureRef.canonicalName || step.procedureRef.text);
  const existing = findExistingTreatmentItem(freshPlans, patientId, procedureNormalizedText, step.tooth);
  const existingKey = existing ? `${existing.plan.id}:${existing.voceIndex}` : null;
  if (existing && !excludeTargets.has(existingKey)) {
    return { skipped: true, reason: 'already-exists', planId: existing.plan.id, voceIndex: existing.voceIndex };
  }

  // TOCTOU defense-in-depth (PO decision 1): re-resolve the target plan
  // fresh, right before writing — never trust the plan-time snapshot. A
  // second open plan could have been created between preview and this
  // exact confirm, turning what was unambiguous at preview time into a
  // genuine ambiguity now; this must refuse to guess just as firmly as the
  // plan-time check did, never falling back to "first" or "latest".
  const targetPlan = pickTargetPlanForNewItem(freshPlans, patientId);
  if (targetPlan.status === TARGET_PLAN_STATUS.AMBIGUOUS) {
    throw new Error('Più piani di cura attivi sono comparsi per il paziente dopo l\'anteprima: specifica in quale piano inserire la prestazione e ripeti la richiesta.');
  }
  const item = buildTreatmentItem({ procedureRef: step.procedureRef, tooth: step.tooth, price: step.procedureRef.price });
  if (targetPlan.status === TARGET_PLAN_STATUS.SINGLE) {
    const target = targetPlan.plan;
    const updated = await updatePlan(db, target.id, { ...target, voci: [...target.voci, item] });
    const voceIndex = updated?.voci?.length ? updated.voci.length - 1 : -1;
    if (!updated || voceIndex < 0 || updated.voci[voceIndex].prestazione !== item.prestazione) {
      throw new Error('Verifica post-scrittura fallita: la prestazione non risulta salvata sul piano.');
    }
    return { planId: updated.id, voceIndex, verified: true };
  }
  const newPlan = buildNewPlan({ pazienteId: patientId, titolo: `Piano di cura — ${step.procedureRef.text}`, voci: [item] });
  const created = await createPlan(db, newPlan);
  if (!created || !created.voci?.length) throw new Error('Verifica post-scrittura fallita: il piano non risulta creato.');
  return { planId: created.id, voceIndex: 0, verified: true };
}

async function resolveExplicitTarget(db, step) {
  if (!step.existingPlanId) return null;
  const plan = await getPlanById(db, step.existingPlanId);
  const voce = plan?.voci?.[step.existingVoceIndex];
  if (!plan || !voce) return null;
  return { plan, voceIndex: step.existingVoceIndex };
}

async function executeMarkCompletedStep(target, { db }) {
  const { plan: reduced, changed } = markTreatmentItemCompleted(target.plan, target.voceIndex);
  if (!changed) return { skipped: true, reason: 'already-completed', planId: target.plan.id, voceIndex: target.voceIndex };
  const updated = await updatePlan(db, target.plan.id, reduced);
  if (!updated || updated.voci?.[target.voceIndex]?.eseguita !== true) {
    throw new Error('Verifica post-scrittura fallita: il completamento non risulta salvato.');
  }
  return { planId: updated.id, voceIndex: target.voceIndex, verified: true };
}

async function executeEnsurePendingPaymentStep(step, { db, patientId }) {
  const freshPayments = await loadPatientPayments(db, patientId);
  const duplicate = findLikelyDuplicatePendingPayment(freshPayments, patientId, step.amount);
  if (duplicate) return { skipped: true, reason: 'duplicate-detected-at-write-time', paymentId: duplicate.id };
  const payload = buildPendingPayment({ pazienteId: patientId, amount: step.amount });
  const created = await createPayment(db, payload);
  if (!created || Number(created.importo) !== Number(step.amount)) {
    throw new Error('Verifica post-scrittura fallita: il pagamento non risulta salvato correttamente.');
  }
  return { paymentId: created.id, verified: true };
}

/** POL-AI-005B Workflow G — the actual "Era il 46" write. Re-reads the
 *  target plan/item fresh (TOCTOU/stale-preview safety) and re-validates
 *  every fact the plan relied on before touching anything:
 *  - the plan still exists and still belongs to the resolved patient
 *    (defense against a tampered/cross-tenant `existingPlanId`);
 *  - the item at `existingVoceIndex` still represents the same procedure
 *    (defense against a tampered `existingVoceIndex`, or the plan having
 *    changed shape since preview);
 *  - for `expectedOutcome: 'ALREADY_COMPLETE'` (idempotent repeat), the
 *    tooth must still be exactly what was already recorded — anything
 *    else is a genuine conflict (someone changed it to a THIRD value
 *    between preview and confirm), never silently overwritten;
 *  - for `expectedOutcome: 'SINGLE_MATCH'` (the real completion), the
 *    tooth must still be missing — if another actor completed it in the
 *    meantime, this is a stale-preview conflict, reported as a failure,
 *    never a silent overwrite.
 *  Only `dente` is ever touched (via `setItemTooth`) — price/payment/
 *  procedure/status are untouched by construction, since `setItemTooth`
 *  itself only ever changes that one field. */
async function executeCompleteTreatmentToothStep(step, { db, patientId }) {
  const freshPlan = await getPlanById(db, step.existingPlanId);
  if (!freshPlan || String(freshPlan.pazienteId) !== String(patientId)) {
    throw new Error('Il piano di cura non è più disponibile o non appartiene più al paziente risolto: nessuna scrittura eseguita.');
  }
  const voce = freshPlan.voci?.[step.existingVoceIndex];
  if (!voce || normalizza(voce.prestazione) !== step.procedureNormalizedText) {
    throw new Error('La prestazione non risulta più nella posizione attesa: il piano potrebbe essere cambiato dopo l\'anteprima.');
  }

  if (step.expectedOutcome === 'ALREADY_COMPLETE') {
    if (voce.dente === step.newTooth.value) {
      return { skipped: true, reason: 'already-up-to-date', planId: freshPlan.id, voceIndex: step.existingVoceIndex };
    }
    throw new Error(`Il valore dell'elemento dentario è cambiato dopo l'anteprima (ora "${voce.dente || 'vuoto'}"): nessuna sovrascrittura automatica.`);
  }

  // expectedOutcome === 'SINGLE_MATCH': must still be genuinely incomplete.
  if (voce.dente) {
    throw new Error(`Un altro utente ha già completato l'elemento dentario per questa prestazione (ora "${voce.dente}"): nessuna sovrascrittura automatica.`);
  }
  const { plan: updatedDraft, changed } = setItemTooth(freshPlan, step.existingVoceIndex, step.newTooth.value);
  if (!changed) return { skipped: true, reason: 'no-op', planId: freshPlan.id, voceIndex: step.existingVoceIndex };
  const updated = await updatePlan(db, freshPlan.id, updatedDraft);
  if (!updated || updated.voci?.[step.existingVoceIndex]?.dente !== step.newTooth.value) {
    throw new Error('Verifica post-scrittura fallita: elemento dentario non risulta salvato.');
  }
  return { planId: updated.id, voceIndex: step.existingVoceIndex, verified: true };
}

/** Workflow G's own run path — a single COMPLETE_TREATMENT_TOOTH step (or
 *  none, if the plan was already blocked at plan time by ambiguity/
 *  invalid-tooth/no-match/conflicting-value — `checkPreconditions` already
 *  refuses those before this is ever reached). */
async function runCompleteMissingTooth(plan, { db, patientId }) {
  const step = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.COMPLETE_TREATMENT_TOOTH);
  if (!step) {
    return { outcome: RUN_OUTCOME.FAILED, completedSteps: [], failedStep: { type: PLAN_STEP_TYPE.RESOLVE_INCOMPLETE_TREATMENT, message: 'Nessuna prestazione da completare è stata identificata.' }, recoveryActions: ['Ripeti la richiesta specificando meglio la prestazione o l\'elemento dentario.'] };
  }
  try {
    const result = await executeCompleteTreatmentToothStep(step, { db, patientId });
    return { outcome: RUN_OUTCOME.SUCCESS, completedSteps: [{ type: step.type, result }], failedStep: null, recoveryActions: [] };
  } catch (error) {
    return failResult([], step, error.message, [`Lo step "${step.type}" non è riuscito. Nessuna scrittura è stata eseguita. ${error.message.includes('sovrascrittura') ? 'Verifica lo stato attuale della prestazione e ripeti se necessario.' : 'Ripeti la richiesta.'}`]);
  }
}

/** POL-FIN-001 — CREATE_PAYMENT_PLAN write. Re-reads canonical financial
 *  state fresh (TOCTOU: another payment or plan could have landed between
 *  preview and this confirm) and re-verifies the target amount still
 *  equals `totalUnscheduledOutstanding` to the cent, and that no OTHER
 *  active plan has appeared for this patient in the meantime — never
 *  writes a plan against a stale total. Creates the plan row, then every
 *  deadline row; if a deadline insert fails partway, the caller reports
 *  PARTIAL (plan + some deadlines created) rather than a silent gap. */
async function executeCreatePaymentPlanStep(step, { db, patientId, today: todayIso }) {
  const [freshPlans, freshPayments, freshPaymentPlans, freshDeadlines, freshAllocations] = await Promise.all([
    loadPatientPlans(db, patientId), loadPatientPayments(db, patientId), loadPatientPaymentPlans(db, patientId),
    loadPatientDeadlines(db, patientId), loadPatientAllocations(db, patientId),
  ]);

  const stillActive = freshPaymentPlans.filter((p) => p.status === PLAN_STATUS.ACTIVE);
  if (stillActive.length > 0) {
    throw new Error('Il paziente ha già un piano di pagamento attivo (creato nel frattempo): nessuna scrittura eseguita.');
  }

  const summary = computePatientFinancialSummary(
    { plans: freshPlans, payments: freshPayments, paymentPlans: freshPaymentPlans, paymentDeadlines: freshDeadlines, paymentAllocations: freshAllocations },
    patientId, { today: todayIso },
  );
  if (!amountsEqual(summary.totalUnscheduledOutstanding, step.totalAmount)) {
    throw new Error(`Il residuo non pianificato è cambiato dopo l'anteprima (ora ${summary.totalUnscheduledOutstanding} €, era ${step.totalAmount} €): nessuna scrittura eseguita.`);
  }

  const planPayload = buildNewPaymentPlan({ patientId, planType: step.planType, totalAmount: step.totalAmount });
  const createdPlan = await createPaymentPlan(db, planPayload);
  if (!createdPlan || !amountsEqual(createdPlan.totalAmount, step.totalAmount)) {
    throw new Error('Verifica post-scrittura fallita: il piano di pagamento non risulta salvato correttamente.');
  }

  const deadlineRows = buildDeadlineRows({ paymentPlanId: createdPlan.id, patientId, deadlines: step.deadlines });
  const createdDeadlines = [];
  for (const row of deadlineRows) {
    const created = await createDeadline(db, row);
    if (!created || !amountsEqual(created.amountDue, row.amountDue)) {
      throw new Error(`Verifica post-scrittura fallita: la rata "${row.label}" non risulta salvata correttamente.`);
    }
    createdDeadlines.push(created);
  }

  return { planId: createdPlan.id, deadlineCount: createdDeadlines.length, verified: true };
}

async function runCreatePaymentPlan(plan, { db, patientId, today: todayIso }) {
  const step = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.CREATE_PAYMENT_PLAN);
  if (!step) {
    return { outcome: RUN_OUTCOME.FAILED, completedSteps: [], failedStep: { type: PLAN_STEP_TYPE.CHECK_EXISTING_PAYMENT_PLAN, message: 'Nessun piano di pagamento da creare è stato identificato.' }, recoveryActions: ['Ripeti la richiesta.'] };
  }
  try {
    const result = await executeCreatePaymentPlanStep(step, { db, patientId, today: todayIso });
    return { outcome: RUN_OUTCOME.SUCCESS, completedSteps: [{ type: step.type, result }], failedStep: null, recoveryActions: [] };
  } catch (error) {
    return failResult([], step, error.message, ['La creazione del piano di pagamento non è riuscita. Nessuna rata è stata salvata. Ripeti la richiesta.']);
  }
}

/** POL-FIN-001 — RECORD_PAYMENT_AGAINST_DEADLINE write. Re-reads the
 *  target deadline fresh (if any) and fails closed if it is no longer
 *  open (someone else already completed it since preview — stale/
 *  conflict, never silently reallocated elsewhere). Creates the real
 *  `payments` row (stato: 'pagato' — this is money actually received,
 *  see paymentService.buildCollectedPayment) and the allocation row
 *  linking it to the deadline, or to nothing (general outstanding
 *  balance) when `targetDeadlineId` is null. */
async function executeRecordPaymentAllocationStep(step, { db, patientId }) {
  if (step.targetDeadlineId) {
    const freshAllocations = await loadPatientAllocations(db, patientId);
    const freshDeadlines = await loadPatientDeadlines(db, patientId);
    const freshTarget = freshDeadlines.find((d) => String(d.id) === String(step.targetDeadlineId));
    if (!freshTarget) throw new Error('La scadenza selezionata non è più disponibile: nessuna scrittura eseguita.');
    const remaining = deadlineRemainingAmount(freshTarget, freshAllocations);
    if (remaining <= 0) {
      throw new Error('La scadenza selezionata risulta già saldata (probabilmente da un altro utente nel frattempo): nessuna sovrascrittura automatica.');
    }
  }

  const paymentPayload = buildCollectedPayment({ pazienteId: patientId, amount: step.amount });
  const createdPayment = await createPayment(db, paymentPayload);
  if (!createdPayment || Number(createdPayment.importo) !== Number(step.amount)) {
    throw new Error('Verifica post-scrittura fallita: il pagamento non risulta salvato correttamente.');
  }

  const allocationPayload = buildAllocation({ paymentId: createdPayment.id, patientId, paymentDeadlineId: step.targetDeadlineId, amount: step.amount });
  const createdAllocation = await createAllocation(db, allocationPayload);
  if (!createdAllocation || !amountsEqual(createdAllocation.amount, step.amount)) {
    throw new Error('Verifica post-scrittura fallita: l\'allocazione del pagamento non risulta salvata correttamente.');
  }

  return { paymentId: createdPayment.id, allocationId: createdAllocation.id, targetDeadlineId: step.targetDeadlineId, verified: true };
}

async function runRecordPaymentAllocation(plan, { db, patientId }) {
  const step = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.RECORD_PAYMENT_ALLOCATION);
  if (!step) {
    return { outcome: RUN_OUTCOME.FAILED, completedSteps: [], failedStep: { type: PLAN_STEP_TYPE.RESOLVE_PAYMENT_ALLOCATION, message: 'Nessuna allocazione di pagamento è stata identificata.' }, recoveryActions: ['Ripeti la richiesta specificando meglio la scadenza.'] };
  }
  try {
    const result = await executeRecordPaymentAllocationStep(step, { db, patientId });
    return { outcome: RUN_OUTCOME.SUCCESS, completedSteps: [{ type: step.type, result }], failedStep: null, recoveryActions: [] };
  } catch (error) {
    return failResult([], step, error.message, ['La registrazione del pagamento non è riuscita. Nessuna scrittura è stata eseguita. Ripeti la richiesta.']);
  }
}

const recoveryForFailure = (step, completedSteps) => {
  const clinicalDone = completedSteps.some((s) => s.type === PLAN_STEP_TYPE.MARK_TREATMENT_COMPLETED || s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM);
  if (step.type === PLAN_STEP_TYPE.ENSURE_PENDING_PAYMENT && clinicalDone) {
    return ['La registrazione clinica è andata a buon fine. Solo il pagamento in sospeso non è stato registrato: riprova a registrarlo da Pagamenti, oppure ripeti solo questa richiesta (è idempotente: non duplicherà la parte clinica già completata).'];
  }
  return [`Lo step "${step.type}" non è riuscito. Nessun passaggio successivo è stato eseguito. Ripeti l'intera richiesta: gli step già completati non verranno duplicati.`];
};

/** The per-item sequential executor, for workflows A/C/D/E/F — plans
 *  whose steps interleave RESOLVE_PROCEDURE/CHECK_EXISTING_TREATMENT/
 *  ENSURE_TREATMENT_ITEM/MARK_TREATMENT_COMPLETED per item, followed by an
 *  optional CHECK_EXISTING_PENDING_PAYMENT/ENSURE_PENDING_PAYMENT pair. */
async function runSequentialPlan(plan, { db, patientId }) {
  const completedSteps = [];
  let lastItemTarget = null; // { plan, voceIndex } for the item just ensured/reused
  const createdThisRun = new Set(); // `${planId}:${voceIndex}` for items this run itself just wrote

  for (const step of plan.steps) {
    try {
      if (step.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM) {
        const result = await executeEnsureTreatmentItemStep(step, { db, patientId, excludeTargets: createdThisRun });
        if (!result.skipped) createdThisRun.add(`${result.planId}:${result.voceIndex}`);
        const freshPlan = await getPlanById(db, result.planId);
        lastItemTarget = { plan: freshPlan, voceIndex: result.voceIndex };
        completedSteps.push({ type: step.type, result });
      } else if (step.type === PLAN_STEP_TYPE.MARK_TREATMENT_COMPLETED) {
        const target = lastItemTarget || await resolveExplicitTarget(db, step);
        if (!target) throw new Error('Nessuna prestazione risolta da segnare come eseguita.');
        const result = await executeMarkCompletedStep(target, { db });
        completedSteps.push({ type: step.type, result });
        lastItemTarget = null;
      } else if (step.type === PLAN_STEP_TYPE.ENSURE_PENDING_PAYMENT) {
        const result = await executeEnsurePendingPaymentStep(step, { db, patientId });
        completedSteps.push({ type: step.type, result });
      }
    } catch (error) {
      return failResult(completedSteps, step, error.message, recoveryForFailure(step, completedSteps));
    }
  }
  return { outcome: RUN_OUTCOME.SUCCESS, completedSteps, failedStep: null, recoveryActions: [] };
}

/** The batched-create executor for workflow B (CREATE_TREATMENT_PLAN):
 *  §16/the task's own instruction — "create only missing items, no
 *  duplicate", and semantically ONE new plan for the N missing items, not
 *  N separate single-item plans. Items already found via
 *  CHECK_EXISTING_TREATMENT (no ENSURE step emitted for them) are left
 *  untouched and reported as reused. */
async function runCreateTreatmentPlan(plan, { db, patientId }) {
  const completedSteps = [];
  const reusedItems = plan.steps.filter((s) => s.type === PLAN_STEP_TYPE.CHECK_EXISTING_TREATMENT && s.found);
  for (const step of reusedItems) {
    completedSteps.push({ type: PLAN_STEP_TYPE.CHECK_EXISTING_TREATMENT, result: { skipped: true, reason: 'already-exists', planId: step.existingPlanId } });
  }
  const missingSteps = plan.steps.filter((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM);
  if (!missingSteps.length) {
    return { outcome: RUN_OUTCOME.SUCCESS, completedSteps, failedStep: null, recoveryActions: [] };
  }
  try {
    const freshPlans = await loadPatientPlans(db, patientId);
    // Re-verify freshly (TOCTOU): an item planned as "missing" a moment
    // ago may have been added by someone else since the preview.
    const stillMissing = missingSteps.filter((step) => !findExistingTreatmentItem(
      freshPlans, patientId, normalizza(step.procedureRef.canonicalName || step.procedureRef.text), step.tooth,
    ));
    if (!stillMissing.length) {
      return { outcome: RUN_OUTCOME.SUCCESS, completedSteps, failedStep: null, recoveryActions: [] };
    }
    const items = stillMissing.map((step) => buildTreatmentItem({ procedureRef: step.procedureRef, tooth: step.tooth, price: step.procedureRef.price }));
    const patientLabel = plan.patientRef?.candidate ? `${plan.patientRef.candidate.nome} ${plan.patientRef.candidate.cognome}` : '';
    const newPlan = buildNewPlan({ pazienteId: patientId, titolo: `Piano di cura${patientLabel ? ` — ${patientLabel}` : ''}`, voci: items });
    const created = await createPlan(db, newPlan);
    if (!created || created.voci?.length !== items.length) {
      throw new Error('Verifica post-scrittura fallita: il nuovo piano non contiene tutte le prestazioni previste.');
    }
    completedSteps.push({ type: PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM, result: { planId: created.id, itemCount: items.length, verified: true } });
    return { outcome: RUN_OUTCOME.SUCCESS, completedSteps, failedStep: null, recoveryActions: [] };
  } catch (error) {
    return failResult(completedSteps, { type: PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM }, error.message, [
      'La creazione del piano di cura non è riuscita. Nessuna prestazione è stata salvata (le prestazioni già esistenti non sono state toccate). Ripeti la richiesta.',
    ]);
  }
}

/**
 * runActionPlan(plan, context) -> Promise<{ outcome, completedSteps,
 * failedStep, recoveryActions }>
 * `context = { db, patients, homePermissions, studioId }` — `db` is the
 * DB-like interface from src/lib/supabase.js ({getAll, insert, update,
 * getById}); `patients` MUST be a freshly-loaded array at confirm time, not
 * the original preview's snapshot (the caller's responsibility — see
 * PoliedronActionPreviewLevel2.jsx). `studioId` is optional defense-in-
 * depth threaded into the patient re-resolution check (see
 * checkPreconditions).
 */
export async function runActionPlan(plan, context) {
  const precondition = checkPreconditions(plan, context);
  if (!precondition.ok) return precondition.result;
  const { db } = context;
  const { patientId } = precondition;

  if (plan.intent === COMMAND_INTENT.CREATE_TREATMENT_PLAN) {
    return runCreateTreatmentPlan(plan, { db, patientId });
  }
  if (plan.intent === COMMAND_INTENT.COMPLETE_MISSING_TOOTH) {
    return runCompleteMissingTooth(plan, { db, patientId });
  }
  if (plan.intent === COMMAND_INTENT.CREATE_PAYMENT_PLAN) {
    return runCreatePaymentPlan(plan, { db, patientId, today: context.today });
  }
  if (plan.intent === COMMAND_INTENT.RECORD_PAYMENT_AGAINST_DEADLINE) {
    return runRecordPaymentAllocation(plan, { db, patientId });
  }
  return runSequentialPlan(plan, { db, patientId });
}

// Re-exported so callers/tests never need to know PRICE_UNRESOLVED lives
// in actionPlanner.js internally.
export { PRICE_UNRESOLVED };
