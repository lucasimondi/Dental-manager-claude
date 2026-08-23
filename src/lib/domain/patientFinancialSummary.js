/* POL-FIN-001 — the canonical patient financial contract.
   ONE function every consumer (Pagamenti, SchedaPaz, Dashboard, Poliedron,
   and POL-UI-014's Patient Clinical Cockpit) must call for these numbers —
   see docs/architecture/POL-FIN-001-payment-plans-deadlines.md
   PATIENT_FINANCIAL_CONTRACT / POL-UI-014_HANDOFF. Nothing here is a new
   independent recalculation invented for one screen; every formula is
   either byte-identical to the pre-existing legacy calculation it
   replaces (see CURRENT_FINANCIAL_MODEL in the doc) or newly additive
   (scheduled/unscheduled/overdue/next-deadline), never a second, subtly
   different definition of a number that already existed.

   totalDue / totalOutstanding reuse Pagamenti.jsx's existing `saldoPaz`
   formula exactly (sum of plan voci prices minus per-plan discount,
   across ALL of the patient's plans, clamped at 0) — this task does not
   change what "money owed" already meant.

   totalCollected deliberately does NOT reuse Pagamenti.jsx's legacy
   `pagato` (which sums every payment regardless of `stato`, including
   still-`sospeso` ones — a known, previously-flagged quirk). It instead
   matches POL-003's own canonical ledger rule (see
   supabase/migrations/20260819104143_pol_003b_legacy_financial_adapter.sql:
   only `stato = 'pagato'` rows become real PAYMENT events) — the more
   correct, already-Product-Owner-approved definition of "actually
   collected". This is a deliberate, documented divergence from the
   legacy Pagamenti.jsx widget, not a silent behavior change to it (that
   widget is untouched by this task) — see the architecture doc's
   FINANCIAL_INVARIANTS section and PRODUCT_OWNER_DECISION_REQUIRED. */

import { toCents, fromCents, roundMoney } from './money.js';
import { PLAN_STATUS, deadlineRemainingAmount, computeDeadlineStatus, DEADLINE_STATUS } from './paymentPlanService.js';

/** planGrossDue(plan) -> the exact Pagamenti.jsx `saldoPaz` per-plan
 *  formula: sum(voci.prezzo) minus discount (pct or fixed), clamped >= 0. */
function planGrossDue(plan) {
  const sub = (plan.voci || []).reduce((a, v) => a + Number(v.prezzo), 0);
  const sc = Number(plan.sconto) || 0;
  const scontato = plan.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
  return Math.max(0, sub - scontato);
}

/**
 * computePatientFinancialSummary(sources, patientId, { today }) ->
 *   PatientFinancialSummary
 *
 * `sources = { plans, payments, paymentPlans, paymentDeadlines,
 * paymentAllocations }` — already-loaded, already-tenant-scoped arrays,
 * exactly like every other selector in this codebase (never fetches
 * anything itself). Pure and synchronous.
 */
export function computePatientFinancialSummary(sources, patientId, { today: todayIso } = {}) {
  const plans = (sources.plans || []).filter((p) => String(p.pazienteId) === String(patientId));
  const payments = (sources.payments || []).filter((p) => String(p.pazienteId) === String(patientId));
  const paymentPlans = (sources.paymentPlans || []).filter((p) => String(p.patientId) === String(patientId));
  const allPatientDeadlines = (sources.paymentDeadlines || []).filter((d) => String(d.patientId) === String(patientId));
  const allocations = (sources.paymentAllocations || []).filter((a) => String(a.patientId) === String(patientId));

  const totalDueCents = plans.reduce((s, p) => s + toCents(planGrossDue(p)), 0);
  const totalCollectedCents = payments
    .filter((p) => String(p.stato).toLowerCase() === 'pagato')
    .reduce((s, p) => s + toCents(p.importo), 0);
  const totalOutstandingCents = Math.max(0, totalDueCents - totalCollectedCents);

  const activePlans = paymentPlans.filter((p) => p.status === PLAN_STATUS.ACTIVE);
  const activeDeadlines = allPatientDeadlines.filter((d) => activePlans.some((p) => String(p.id) === String(d.paymentPlanId)));

  const scheduledRemaining = activeDeadlines.map((d) => ({
    deadline: d,
    remaining: deadlineRemainingAmount(d, allocations),
    status: computeDeadlineStatus(d, allocations, todayIso),
  }));

  const totalScheduledOutstandingCents = Math.min(
    totalOutstandingCents,
    scheduledRemaining.reduce((s, r) => s + toCents(r.remaining), 0),
  );
  const totalUnscheduledOutstandingCents = Math.max(0, totalOutstandingCents - totalScheduledOutstandingCents);

  const totalOverdueCents = scheduledRemaining
    .filter((r) => r.status === DEADLINE_STATUS.OVERDUE)
    .reduce((s, r) => s + toCents(r.remaining), 0);

  const upcoming = scheduledRemaining
    .filter((r) => r.remaining > 0 && r.deadline.dueDate)
    .sort((a, b) => String(a.deadline.dueDate).localeCompare(String(b.deadline.dueDate)));
  const nextDeadline = upcoming[0]
    ? { ...upcoming[0].deadline, remainingAmount: upcoming[0].remaining, status: upcoming[0].status }
    : null;

  const multipleActivePlans = activePlans.length > 1;
  const activePaymentPlan = multipleActivePlans ? null : (activePlans[0] || null);

  return Object.freeze({
    patientId,
    totalDue: roundMoney(fromCents(totalDueCents)),
    totalCollected: roundMoney(fromCents(totalCollectedCents)),
    totalOutstanding: roundMoney(fromCents(totalOutstandingCents)),
    totalScheduledOutstanding: roundMoney(fromCents(totalScheduledOutstandingCents)),
    totalUnscheduledOutstanding: roundMoney(fromCents(totalUnscheduledOutstandingCents)),
    totalOverdue: roundMoney(fromCents(totalOverdueCents)),
    nextDeadline,
    activePaymentPlan,
    multipleActivePlans,
  });
}

/** computeStudioFinancialSignals(sources, patients, { today }) -> per-
 *  patient summaries for every patient in the studio, used by the
 *  proactive-intelligence scanner and by studio-wide Poliedron queries
 *  ("chi ha rate scadute?"). Does not aggregate further — callers filter/
 *  sort the array themselves; this keeps the one canonical per-patient
 *  formula as the single source for every studio-wide view too. */
export function computeStudioFinancialSummaries(sources, patients, options = {}) {
  return (patients || []).map((patient) => ({
    patient,
    summary: computePatientFinancialSummary(sources, patient.id, options),
  }));
}
