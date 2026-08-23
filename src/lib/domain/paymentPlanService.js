/* POL-FIN-001 — canonical payment-plan/deadline/allocation domain service.
   Same client-as-parameter I/O convention as treatmentPlanService.js/
   paymentService.js (POL-AI-005B): every I/O function takes an explicit
   `db` ({getAll, insert, update, getById}), never the real Supabase
   singleton — so this stays testable without touching production, and
   the real `DB` is only ever imported at the UI-container layer.

   PLAN_TYPE.INSTALLMENTS / CUSTOM / TREATMENT_PHASES are all constructible
   here (buildInstallmentPlan / buildCustomPlan / buildTreatmentPhasesPlan)
   and fully domain-tested. Only INSTALLMENTS currently has a deterministic
   Poliedron chat command (see actionPlanner.js's planCreatePaymentPlan) —
   CUSTOM/TREATMENT_PHASES creation via natural language is intentionally
   NOT wired to a command parser yet (see the architecture doc's
   POLIEDRON_INTEGRATION section for why), matching "do not over-engineer"
   (task §5) while keeping the domain layer itself complete and reusable
   the moment a UI or a future command needs it. */

import { uid, today } from '../utils.js';
import { toCents, fromCents, splitEvenlyDeterministic, roundMoney } from './money.js';

export const PLAN_TYPE = Object.freeze({ INSTALLMENTS: 'INSTALLMENTS', CUSTOM: 'CUSTOM', TREATMENT_PHASES: 'TREATMENT_PHASES' });
export const PLAN_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' });

// Derived, never stored (task §9: "avoid storing derived values
// unnecessarily") — computed fresh from a deadline + its allocations.
export const DEADLINE_STATUS = Object.freeze({
  UPCOMING: 'UPCOMING', DUE: 'DUE', PARTIALLY_PAID: 'PARTIALLY_PAID', PAID: 'PAID', OVERDUE: 'OVERDUE',
});

const PAYMENT_PLAN_KEY = 'dm_pp';
const PAYMENT_DEADLINE_KEY = 'dm_pd';
const PAYMENT_ALLOCATION_KEY = 'dm_pal';

// --- construction (pure) ----------------------------------------------

/** buildInstallmentPlan({ totalAmount, count, startDate, intervalMonths=1 })
 *  -> { plan, deadlines[] } (unsaved, no ids assigned by the DB yet — uid()
 *  generates client-side ids the same way plans/payments already do).
 *  Total is preserved EXACTLY (task §6) via splitEvenlyDeterministic. */
export function buildInstallmentDeadlines({ totalAmount, count, startDate, intervalMonths = 1 }) {
  if (!Number.isInteger(count) || count <= 0) throw new Error('buildInstallmentDeadlines: count must be a positive integer');
  const shares = splitEvenlyDeterministic(totalAmount, count);
  const [y, m, d] = String(startDate).split('-').map(Number);
  return shares.map((amount, i) => {
    const date = new Date(Date.UTC(y, (m - 1) + i * intervalMonths, d));
    const dueDate = date.toISOString().slice(0, 10);
    return { sequenceIndex: i, label: `Rata ${i + 1}/${count}`, amountDue: amount, dueDate, triggerDescription: null };
  });
}

/** buildCustomPlanDeadlines(entries) -> deadlines[], entries = [{ amount,
 *  dueDate, label? }]. No total-preservation trick needed (each amount is
 *  explicit and independent) — just normalizes to the canonical shape. */
export function buildCustomPlanDeadlines(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('buildCustomPlanDeadlines: at least one deadline is required');
  return entries.map((e, i) => ({
    sequenceIndex: i,
    label: e.label || `Scadenza ${i + 1}`,
    amountDue: roundMoney(e.amount),
    dueDate: e.dueDate || null,
    triggerDescription: e.dueDate ? null : (e.triggerDescription || null),
  }));
}

/** buildTreatmentPhasesDeadlines(phases) -> deadlines[], phases = [{
 *  label, amount, triggerDescription, dueDate? }]. Phase-based deadlines
 *  are commonly event-triggered ("alla chirurgia") rather than date-fixed
 *  — `dueDate` stays null until a real date is agreed, `triggerDescription`
 *  carries the human-readable trigger. Task §8: "if canonical treatment
 *  linkage cannot safely be implemented now, design the schema for it and
 *  explicitly defer the execution trigger" — `linkedTreatmentPlanId` is
 *  accepted here (plan-level, stable `plans.id`) but no per-voce/per-item
 *  linkage exists (see the architecture doc: `plans.voci` items have no
 *  stable id, only a positional index, which is not a safe cross-table
 *  foreign key — deferred, not built). */
export function buildTreatmentPhasesDeadlines(phases) {
  if (!Array.isArray(phases) || phases.length === 0) throw new Error('buildTreatmentPhasesDeadlines: at least one phase is required');
  return phases.map((p, i) => ({
    sequenceIndex: i,
    label: p.label,
    amountDue: roundMoney(p.amount),
    dueDate: p.dueDate || null,
    triggerDescription: p.dueDate ? null : (p.triggerDescription || p.label),
  }));
}

/** assertDeadlinesPreserveTotal(deadlines, totalAmount) — the task's own
 *  invariant ("total must equal exactly €4,000"), checked at construction
 *  time via the same cents boundary as the splitter, never a bare `===`
 *  on floats. Throws rather than silently accepting a mismatched plan. */
export function assertDeadlinesPreserveTotal(deadlines, totalAmount) {
  const sumCents = deadlines.reduce((s, d) => s + toCents(d.amountDue), 0);
  if (sumCents !== toCents(totalAmount)) {
    throw new Error(`Il totale delle scadenze (${fromCents(sumCents)}) non corrisponde all'importo totale (${roundMoney(totalAmount)}).`);
  }
}

export function buildNewPaymentPlan({ patientId, planType, totalAmount, linkedTreatmentPlanId = null }) {
  return {
    id: uid(),
    patientId: Number(patientId),
    planType,
    status: PLAN_STATUS.ACTIVE,
    totalAmount: roundMoney(totalAmount),
    linkedTreatmentPlanId: linkedTreatmentPlanId ?? null,
    createdAt: today(),
  };
}

export function buildDeadlineRows({ paymentPlanId, patientId, deadlines }) {
  return deadlines.map((d) => ({
    id: uid(),
    patientId: Number(patientId),
    paymentPlanId,
    sequenceIndex: d.sequenceIndex,
    label: d.label,
    amountDue: d.amountDue,
    dueDate: d.dueDate,
    triggerDescription: d.triggerDescription,
  }));
}

// --- derived status (pure, never stored) --------------------------------

/** deadlineAllocatedAmount(deadlineId, allocations) -> number (cents-safe sum). */
export function deadlineAllocatedAmount(deadlineId, allocations) {
  const cents = (allocations || [])
    .filter((a) => String(a.paymentDeadlineId) === String(deadlineId))
    .reduce((s, a) => s + toCents(a.amount), 0);
  return fromCents(cents);
}

/** deadlineRemainingAmount(deadline, allocations) -> max(0, amountDue -
 *  allocated) — the "deadlineRemaining = deadlineAmount - allocatedPayments"
 *  invariant (task §29), never negative. */
export function deadlineRemainingAmount(deadline, allocations) {
  const allocated = deadlineAllocatedAmount(deadline.id, allocations);
  return Math.max(0, roundMoney(deadline.amountDue - allocated));
}

/** computeDeadlineStatus(deadline, allocations, today) -> DEADLINE_STATUS.
 *  PAID takes priority over date-based states; a still-open deadline is
 *  OVERDUE only once its due date has passed AND it has a due date at all
 *  (an undated TREATMENT_PHASES deadline can never be "overdue" — there is
 *  no agreed date to have missed). */
export function computeDeadlineStatus(deadline, allocations, todayIso = today()) {
  const remaining = deadlineRemainingAmount(deadline, allocations);
  const allocated = deadlineAllocatedAmount(deadline.id, allocations);
  if (remaining <= 0) return DEADLINE_STATUS.PAID;
  if (allocated > 0) return DEADLINE_STATUS.PARTIALLY_PAID;
  if (deadline.dueDate && deadline.dueDate < todayIso) return DEADLINE_STATUS.OVERDUE;
  if (deadline.dueDate === todayIso) return DEADLINE_STATUS.DUE;
  return DEADLINE_STATUS.UPCOMING;
}

// --- I/O (real writes go through here only) -----------------------------

export async function loadPatientPaymentPlans(db, patientId) {
  const all = await db.getAll(PAYMENT_PLAN_KEY);
  return (all || []).filter((p) => String(p.patientId) === String(patientId));
}

export async function loadPatientDeadlines(db, patientId) {
  const all = await db.getAll(PAYMENT_DEADLINE_KEY);
  return (all || []).filter((d) => String(d.patientId) === String(patientId));
}

export async function loadPatientAllocations(db, patientId) {
  const all = await db.getAll(PAYMENT_ALLOCATION_KEY);
  return (all || []).filter((a) => String(a.patientId) === String(patientId));
}

export async function createPaymentPlan(db, planPayload) {
  return db.insert(PAYMENT_PLAN_KEY, planPayload);
}

export async function createDeadline(db, deadlinePayload) {
  return db.insert(PAYMENT_DEADLINE_KEY, deadlinePayload);
}

export async function getPaymentPlanById(db, id) {
  return db.getById(PAYMENT_PLAN_KEY, id);
}

export async function getDeadlineById(db, id) {
  return db.getById(PAYMENT_DEADLINE_KEY, id);
}

export async function createAllocation(db, allocationPayload) {
  return db.insert(PAYMENT_ALLOCATION_KEY, allocationPayload);
}

export function buildAllocation({ paymentId, patientId, paymentDeadlineId, amount }) {
  return {
    id: uid(),
    patientId: Number(patientId),
    paymentId,
    paymentDeadlineId: paymentDeadlineId ?? null,
    amount: roundMoney(amount),
    createdAt: today(),
  };
}
