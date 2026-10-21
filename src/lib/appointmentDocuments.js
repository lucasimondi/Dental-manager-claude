import { MEDICAL_DOCUMENT_FIELDS, normalizePatientDocument } from './patientWorkspaceDocuments.js';

export async function loadAppointmentDocuments(client, patientId) {
  if (!patientId) return [];
  const { data, error } = await client.from('documenti_medici')
    .select(MEDICAL_DOCUMENT_FIELDS).eq('paziente_id', patientId)
    .order('data', { ascending: false });
  if (error) throw error;
  return (data || []).filter(row => String(row.paziente_id) === String(patientId))
    .map(row => normalizePatientDocument(row, 'documenti_medici'));
}

export function appointmentDocumentItems(plans, documents, patientId) {
  if (!patientId) return [];
  return [
    ...plans.filter(p => p && String(p.pazienteId) === String(patientId)).map(plan => ({
      key: `plan:${plan.id}`, title: plan.titolo || 'Preventivo', date: plan.data,
      type: 'Preventivo / piano', category: 'quotes', plan,
    })),
    ...documents.filter(d => String(d.patientId) === String(patientId)).map(document => ({
      ...document, key: `${document.source}:${document.sourceId}`, document,
    })),
  ].sort((a,b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}
