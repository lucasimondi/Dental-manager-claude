import { buildNewPlan, buildTreatmentItem } from './domain/treatmentPlanService.js';
import { planAssignmentForPatient } from './domain/incassiActions.js';
import { today } from './utils.js';
import { expandImplantQuotes } from './domain/implantQuote.js';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const touched = row => [row.description, row.price, row.tooth].some(v => String(v || '').trim());
export function entryItems(rows = []) {
  return rows.filter(touched).map(row => {
    const price = Number(row.price);
    if (!row.description?.trim() || String(row.price).trim() === '' || !Number.isFinite(price) || price < 0) throw new Error('Compila prestazione e prezzo valido (anche 0 €).');
    return buildTreatmentItem({ procedureRef: { text: row.description.trim() }, tooth: { state: row.tooth?.trim() ? 'known' : 'unknown', value: row.tooth?.trim() }, price });
  });
}
export function prepareAppointmentEntry({ patient, appointment, plans, draft }) {
  if (!patient?.id || String(appointment?.pazienteId) !== String(patient.id)) throw new Error('Appuntamento e paziente non corrispondono.');
  const expanded = draft.implantPreset ? expandImplantQuotes(draft.items, draft.quoteItems) : draft;
  const items = entryItems(expanded.items), quoteItems = entryItems(expanded.quoteItems);
  const patientPlans = plans.filter(p => String(p.pazienteId) === String(patient.id));
  let treatment = null, quote = null;
  if (items.length) {
    if (draft.planId === 'new') treatment = { kind: 'insert', plan: buildNewPlan({ pazienteId: patient.id, titolo: draft.planTitle?.trim() || 'Prestazioni occasionali', voci: items }) };
    else {
      const plan = patientPlans.find(p => String(p.id) === String(draft.planId) && ['attivo','accettato'].includes(p.stato));
      if (!plan) throw new Error('Scegli il piano per le prestazioni.');
      treatment = { kind: 'update', plan: { ...plan, voci: [...(Array.isArray(plan.voci) ? plan.voci : []), ...items] } };
    }
  }
  if (quoteItems.length) quote = buildNewPlan({ pazienteId: patient.id, titolo: draft.quoteTitle?.trim() || 'Preventivo', voci: quoteItems });
  let payment = null;
  if (String(draft.amount || '').trim()) {
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Inserisci un incasso maggiore di zero oppure lascia vuoto.');
    const assignment = planAssignmentForPatient(patientPlans, patient.id);
    let target = null;
    if (draft.paymentPlanId === 'quote') {
      if (!quote) throw new Error('Compila il preventivo per collegare questo incasso.');
      target = 'quote';
    } else if (draft.paymentPlanId === 'context' && expanded.hasImplant && !treatment && quote) {
      target = 'quote';
    } else if (draft.paymentPlanId === 'treatment' || (draft.paymentPlanId === 'context' && treatment)) {
      if (!treatment) throw new Error('Compila una prestazione per collegare questo incasso.');
      target = 'treatment';
    } else if (draft.paymentPlanId && draft.paymentPlanId !== 'context') {
      const chosen = patientPlans.find(p => String(p.id) === String(draft.paymentPlanId));
      if (!chosen || (assignment.mode === 'choose' ? !assignment.options.some(p => p.id === chosen.id) : assignment.mode !== 'auto' || String(assignment.pianoId) !== String(chosen.id))) throw new Error('Scegli un piano valido per l’incasso.');
      target = chosen.id;
    } else if (assignment.mode === 'auto') target = assignment.pianoId;
    else if (assignment.mode === 'choose') throw new Error('Scegli il piano per l’incasso.');
    payment = { pazienteId: Number(patient.id), data: today(), importo: amount, metodo: draft.method || 'Contanti', nota: draft.paymentNote?.trim() || undefined, stato: 'pagato', target };
  }
  return { treatment, quote, payment };
}

// Existing tenant-scoped adapter only. Validate all input before any write;
// await the real plan ID before inserting its payment. No optimistic temp IDs.
export async function persistAppointmentEntry({ db, patient, appointment, draft, onApplied = () => {} }) {
  let writesStarted = false, completed = 0;
  try {
    const [freshPatient, freshAppointment, plans] = await Promise.all([
      db.getById('dm_p', patient.id), db.getById('dm_a', appointment.id), db.getAll('dm_pl', { throwOnError: true }),
    ]);
    if (!freshPatient || String(freshPatient.id) !== String(patient.id) || !freshAppointment || String(freshAppointment.id) !== String(appointment.id) || String(freshAppointment.pazienteId) !== String(patient.id)) throw new Error('Impossibile verificare il paziente dell’appuntamento.');
    const prepared = prepareAppointmentEntry({ patient: freshPatient, appointment: freshAppointment, plans, draft });
    let treatmentId, quoteId;
    const savePlan = async (plan, kind) => {
      writesStarted = true;
      let saved;
      if (kind === 'insert') { const { id, ...payload } = plan; saved = await db.insert('dm_pl', payload); }
      else {
        const { id, ...payload } = plan;
        await db.update('dm_pl', id, payload);
        saved = await db.getById('dm_pl', id);
        if (!saved || JSON.stringify(canonical(saved.voci)) !== JSON.stringify(canonical(plan.voci))) throw new Error('Modifica piano non confermata.');
      }
      if (!saved?.id || String(saved.pazienteId) !== String(patient.id)) throw new Error('Salvataggio piano non confermato.');
      completed++; onApplied('plan', saved); return saved.id;
    };
    if (prepared.treatment) treatmentId = await savePlan(prepared.treatment.plan, prepared.treatment.kind);
    if (prepared.quote) quoteId = await savePlan(prepared.quote, 'insert');
    if (prepared.payment) {
      const { target, ...payload } = prepared.payment;
      const pianoId = target === 'treatment' ? treatmentId : target === 'quote' ? quoteId : target;
      writesStarted = true;
      const saved = await db.insert('dm_py', { ...payload, ...(pianoId != null ? { pianoId } : {}) });
      if (!saved?.id || String(saved.pazienteId) !== String(patient.id)) throw new Error('Incasso non confermato.');
      completed++; onApplied('payment', saved);
    }
    return { completed, treatmentId };
  } catch (cause) {
    const error = new Error(cause.message || 'Salvataggio non riuscito.');
    error.writesStarted = writesStarted; error.completed = completed; throw error;
  }
}
