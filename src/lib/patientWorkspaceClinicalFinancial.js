import { loadCanonicalFinancialSnapshot } from './canonicalFinancialSelectors.js';

export const TREATMENT_STATUS = Object.freeze({
  PROPOSED: 'Proposta', PLANNED: 'Pianificata', IN_PROGRESS: 'In corso',
  COMPLETED: 'Eseguita', CANCELLED: 'Annullata', RECALL: 'Richiamo da programmare',
});

export const mapLegacyTreatmentStatus = (item = {}) => {
  if (item.eseguita === true) return TREATMENT_STATUS.COMPLETED;
  const raw = String(item.statoLabel || item.stato || '').trim().toLowerCase();
  if (raw.includes('richiam')) return TREATMENT_STATUS.RECALL;
  if (raw === 'in_corso' || raw === 'in corso') return TREATMENT_STATUS.IN_PROGRESS;
  if (raw === 'annullata' || raw === 'annullato') return TREATMENT_STATUS.CANCELLED;
  if (raw === 'pianificata' || raw === 'pianificato') return TREATMENT_STATUS.PLANNED;
  return TREATMENT_STATUS.PROPOSED;
};

export function planNetTotal(plan = {}) {
  const gross = (Array.isArray(plan.voci) ? plan.voci : []).reduce((sum, item) => sum + (Number(item.prezzo) || 0), 0);
  const value = Math.max(0, Number(plan.sconto) || 0);
  const discount = plan.scontoTipo === 'eur' ? Math.min(gross, value) : gross * Math.min(100, value) / 100;
  return { gross, discount, net: Math.max(0, gross - discount) };
}

export function treatmentsFromPlans(plans = []) {
  return plans.flatMap((plan) => (Array.isArray(plan.voci) ? plan.voci : []).map((item, index) => ({
    ...item,
    id: `plan:${plan.id}:item:${index}`,
    key: `plan:${plan.id}:item:${index}`,
    entityType: 'TREATMENT',
    planId: plan.id,
    planTitle: plan.titolo || 'Piano di cura',
    itemIndex: index,
    name: item.prestazione || 'Prestazione',
    site: item.sede || item.dente || 'Generale',
    status: mapLegacyTreatmentStatus(item),
    price: Number(item.prezzo) || 0,
    notes: item.note || item.nota || '',
  })));
}

const appRow = (row) => ({ ...row, pazienteId: row.paziente_id, dataNascita: row.data_nascita, operatoreId: row.operatore_id });
const planRow = (row) => ({ ...row, pazienteId: row.paziente_id, scontoTipo: row.sconto_tipo, scadenzaPagamento: row.scadenza_pagamento });
const paymentRow = (row) => ({ ...row, pazienteId: row.paziente_id });

async function scopedRows(client, table, patientId, columns = '*', order = null) {
  let query = client.from(table).select(columns).eq('paziente_id', patientId);
  if (order) query = query.order(order, { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function loadRealPatientWorkspace(client, patientId) {
  if (!client || !patientId) throw new Error('patientId e client autenticato sono obbligatori');
  const { data: patient, error: patientError } = await client.from('patients').select('*').eq('id', patientId).maybeSingle();
  if (patientError) throw patientError;
  if (!patient) throw new Error('Paziente non trovato o non accessibile');

  // Intentionally sequential: isolated route, patient-scoped reads, no fan-out at app startup.
  const plans = (await scopedRows(client, 'plans', patientId, '*', 'id')).map(planRow);
  const payments = (await scopedRows(client, 'payments', patientId, '*', 'data')).map(paymentRow);
  const appointments = (await scopedRows(client, 'appointments', patientId, '*', 'data')).map(appRow);
  const { data: { session } } = await client.auth.getSession();
  const studioId = session?.user?.app_metadata?.studio_id || null;
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const canonical = await loadCanonicalFinancialSnapshot(client, yearStart, today, studioId);
  return {
    patient: { ...patient, dataNascita: patient.data_nascita }, plans, payments, appointments,
    treatments: treatmentsFromPlans(plans),
    canonicalFinancial: canonical.snapshot,
    canonicalFinancialError: canonical.error?.message || null,
    financialScope: 'STUDIO',
    capabilities: Object.freeze({
      UPDATE_TREATMENT_STATUS: { enabled: false, reason: 'Il piano salva voci JSON senza versione/compare-and-swap: rischio di sovrascrittura concorrente.' },
      REGISTER_PAYMENT: { enabled: false, reason: 'Usare il flusso Pagamenti/Polyedron già confermato; questa preview non introduce una seconda write path.' },
      CREATE_PAYMENT_PLAN: { enabled: false, reason: 'Tabelle autorevoli payment_plans/installments non disponibili.' },
    }),
  };
}

export function buildClinicalFinancialTimeline({ plans = [], payments = [], appointments = [], documents = [] }) {
  const treatments = treatmentsFromPlans(plans);
  return [
    ...treatments.filter((item) => item.status === TREATMENT_STATUS.COMPLETED).map((item) => ({ id: `done:${item.id}`, occurredAt: item.dataEsec || '', type: 'TREATMENT_COMPLETED', label: item.name, meta: item.price })),
    ...payments.map((row) => ({ id: `payment:${row.id}`, occurredAt: row.data || '', type: 'PAYMENT_RECORDED', label: 'Pagamento', meta: Number(row.importo) || 0 })),
    ...appointments.map((row) => ({ id: `appointment:${row.id}`, occurredAt: row.data || '', type: 'APPOINTMENT', label: row.tipo || 'Appuntamento', meta: row.ora || '' })),
    ...documents.map((row) => ({ id: `document:${row.id}`, occurredAt: row.occurredAt || row.created_at || '', type: row.type || 'DOCUMENT', label: row.label || row.title || 'Documento', meta: '' })),
  ].filter((event) => event.occurredAt).sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
}
