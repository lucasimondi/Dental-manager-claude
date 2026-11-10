/* PO 2026-11-10 — tocco prolungato sul dente: «Segna tutto eseguito», singole prestazioni
   da fare, «Segna come assente», con annullamento. Funzioni pure: lo stato si salva poi con
   setPlans/setPatients, lo stesso sistema di persistenza già usato dall'app.

   «Eseguito» è quello canonico dell'app: voce.eseguita = true e dataEsec (vedi
   markTreatmentItemCompleted). In più, solo aggiunte: operatoreId e appuntamentoId della
   seduta, se ci sono. Nessun campo esistente rinominato. */
import { markTreatmentItemCompleted } from './treatmentPlanService.js';
import { patientDentalOverview } from '../patientDentalOverview.js';

export const STATO_DENTE = Object.freeze({ SANO: 'sano', DA_FARE: 'da-fare', ESEGUITO: 'eseguito', ASSENTE: 'assente' });

// Denti assenti: voci strutturate in patients.annotazioni (jsonb già esistente), senza
// testo così non compaiono tra le note scritte. { tipo:'stato_dente', dente, stato:'assente', data }
export function dentiAssenti(patient) {
  const rows = Array.isArray(patient?.annotazioni) ? patient.annotazioni : [];
  return new Set(rows.filter(r => r && r.tipo === 'stato_dente' && r.stato === 'assente').map(r => Number(r.dente)));
}

export function impostaDenteAssente(patient, dente, assente, data) {
  const rows = (Array.isArray(patient?.annotazioni) ? patient.annotazioni : [])
    .filter(r => !(r && r.tipo === 'stato_dente' && Number(r.dente) === Number(dente)));
  return { ...patient, annotazioni: assente ? [...rows, { tipo: 'stato_dente', dente: Number(dente), stato: 'assente', data }] : rows };
}

// Colore del dente: assente > da fare > eseguito > sano (si vede prima cosa resta da fare).
export function statoDente(conteggi, assente) {
  if (assente) return STATO_DENTE.ASSENTE;
  if (conteggi?.pending > 0) return STATO_DENTE.DA_FARE;
  if (conteggi?.done > 0) return STATO_DENTE.ESEGUITO;
  return STATO_DENTE.SANO;
}

// Prestazioni ancora da fare su un dente: riferimenti (planId, index) alla voce reale.
export function vociDaFareDente(plans, patientId, dente) {
  return patientDentalOverview(plans, patientId).pending
    .filter(r => r.teeth.includes(Number(dente)))
    .map(r => ({ planId: r.planId, index: r.itemIndex, prestazione: r.name, prezzo: r.price, piano: r.planTitle }));
}

// Appuntamento del paziente oggi (non disdetto), per legare l'esecuzione alla seduta.
export function appuntamentoDelGiorno(appointments, patientId, data) {
  return (Array.isArray(appointments) ? appointments : [])
    .filter(a => a && String(a.pazienteId) === String(patientId) && a.data === data && a.stato !== 'annullato')
    .sort((a, b) => String(a.ora || '').localeCompare(String(b.ora || '')))[0] || null;
}

// Segna eseguite le voci indicate. Restituisce i piani aggiornati, quelli di prima (per
// «Annulla») e quante voci sono cambiate davvero (una voce già eseguita non conta).
export function segnaEseguite(plans, targets, { data, operatoreId = null, appuntamentoId = null } = {}) {
  const prima = [];
  let n = 0;
  const next = (Array.isArray(plans) ? plans : []).map(plan => {
    const mie = targets.filter(t => String(t.planId) === String(plan.id));
    if (!mie.length) return plan;
    let current = plan;
    for (const t of mie) {
      const { plan: done, changed } = markTreatmentItemCompleted(current, t.index);
      if (!changed) continue;
      n += 1;
      current = { ...done, voci: done.voci.map((v, j) => j === t.index ? {
        ...v, ...(data ? { dataEsec: data } : {}),
        ...(operatoreId != null ? { operatoreId } : {}),
        ...(appuntamentoId != null ? { appuntamentoId } : {}),
      } : v) };
    }
    if (current !== plan) prima.push(plan);
    return current;
  });
  return { plans: next, prima, n };
}

// «Annulla»: rimette i piani com'erano prima, senza toccare gli altri.
export function ripristinaPiani(plans, prima) {
  const byId = new Map((prima || []).map(p => [String(p.id), p]));
  return (Array.isArray(plans) ? plans : []).map(p => byId.get(String(p.id)) || p);
}

// Avanzamento del piano di cura del paziente: X di Y prestazioni eseguite.
export function avanzamentoCure(plans, patientId) {
  const m = patientDentalOverview(plans, patientId);
  return { eseguite: m.done.length, totale: m.done.length + m.pending.length };
}

export const messaggioEseguite = (dente, n) => `${dente ? `Dente ${dente}: ` : ''}${n} ${n === 1 ? 'prestazione eseguita' : 'prestazioni eseguite'}`;
