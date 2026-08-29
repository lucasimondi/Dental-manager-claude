import { uid, today } from '../utils.js';
import { buildNewPlan } from './treatmentPlanService.js';

const timestamp = (plan) => `${plan?.data || ''}:${plan?.created_at || ''}:${plan?.id || ''}`;

export function addReceivableToLatestPlan(plans, { pazienteId, descrizione, importo, eseguita = true }) {
  const item = {
    prestazione: descrizione.trim(), dente: '', prezzo: Number(importo),
    eseguita: Boolean(eseguita), incassata: false,
    ...(eseguita ? { dataEsec: today() } : {}),
  };
  const patientPlans = (plans || []).filter((plan) => String(plan.pazienteId) === String(pazienteId));
  if (!patientPlans.length) {
    const plan = buildNewPlan({ pazienteId, titolo: 'Prestazioni occasionali', voci: [item] });
    return [...(plans || []), { ...plan, stato: eseguita ? 'concluso' : 'attivo' }];
  }
  const target = [...patientPlans].sort((a, b) => timestamp(b).localeCompare(timestamp(a)))[0];
  return (plans || []).map((plan) => {
    if (String(plan.id) !== String(target.id)) return plan;
    const voci = [...(plan.voci || []), item];
    return { ...plan, voci, stato: voci.every((voce) => voce.eseguita) ? 'concluso' : 'attivo' };
  });
}

export function buildContextualPayment({ pazienteId, importo, descrizione }) {
  return {
    id: uid(), pazienteId: Number(pazienteId), data: today(), importo: Number(importo),
    metodo: 'Contanti', nota: `Pagamento contestuale — ${descrizione.trim()}`, stato: 'pagato',
  };
}
