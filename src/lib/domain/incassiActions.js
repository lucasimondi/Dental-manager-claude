import { uid, today } from '../utils.js';
import { buildNewPlan } from './treatmentPlanService.js';

const timestamp = (plan) => `${plan?.data || ''}:${plan?.created_at || ''}:${plan?.id || ''}`;

/** Returns { plans, planId }: the updated plans array plus the id of the
 *  plan the receivable landed on — the plan is already known/determined by
 *  this flow, so callers can attach it as payments.piano_id without
 *  guessing (POL-FIN-003). */
export function addReceivableToLatestPlan(plans, { pazienteId, descrizione, importo, eseguita = true }) {
  const item = {
    prestazione: descrizione.trim(), dente: '', prezzo: Number(importo),
    eseguita: Boolean(eseguita), incassata: false,
    ...(eseguita ? { dataEsec: today() } : {}),
  };
  const patientPlans = (plans || []).filter((plan) => String(plan.pazienteId) === String(pazienteId));
  if (!patientPlans.length) {
    const plan = buildNewPlan({ pazienteId, titolo: 'Prestazioni occasionali', voci: [item] });
    const newPlan = { ...plan, stato: eseguita ? 'concluso' : 'attivo' };
    return { plans: [...(plans || []), newPlan], planId: newPlan.id };
  }
  const target = [...patientPlans].sort((a, b) => timestamp(b).localeCompare(timestamp(a)))[0];
  const updatedPlans = (plans || []).map((plan) => {
    if (String(plan.id) !== String(target.id)) return plan;
    const voci = [...(plan.voci || []), item];
    return { ...plan, voci, stato: voci.every((voce) => voce.eseguita) ? 'concluso' : 'attivo' };
  });
  return { plans: updatedPlans, planId: target.id };
}

export function buildContextualPayment({ pazienteId, importo, descrizione, pianoId }) {
  return {
    id: uid(), pazienteId: Number(pazienteId), data: today(), importo: Number(importo),
    metodo: 'Contanti', nota: `Pagamento contestuale — ${descrizione.trim()}`, stato: 'pagato',
    ...(pianoId !== undefined && pianoId !== null ? { pianoId } : {}),
  };
}

// POL-FIN-003 — plan lifecycle states that mean "not currently active" for
// the purpose of choosing/auto-assigning a plan at payment-write time. Same
// convention already used by patientWorkspaceRealAdapter.js's
// ACTIVE_EXCLUSIONS / PatientWorkspaceV2.jsx's activePlans filter.
const INACTIVE_PLAN_STATES = new Set(['concluso', 'rifiutato']);
export const isActivePlan = (plan) => !INACTIVE_PLAN_STATES.has(plan?.stato);

/** POL-FIN-003 §6 — payments left piano_id unset (never assigned by the
 *  backfill or by any write path, because the patient had more than one
 *  plan) surfaced for manual assignment. Purely derived from the same
 *  payments/plans arrays the app already loads per studio — no separate
 *  query, no formula duplicated server-side (the exclusion from
 *  get_saldo_piano/get_saldi_aperti_studio is a plain `piano_id IS NULL`
 *  filter, not recomputed here). */
export function unassignedPaymentsForMultiPlanPatients(payments, plans) {
  const planCountByPatient = new Map();
  (plans || []).forEach((plan) => {
    const key = String(plan.pazienteId);
    planCountByPatient.set(key, (planCountByPatient.get(key) || 0) + 1);
  });
  return (payments || []).filter((payment) => {
    if (payment.pianoId !== undefined && payment.pianoId !== null) return false;
    return (planCountByPatient.get(String(payment.pazienteId)) || 0) > 1;
  });
}
