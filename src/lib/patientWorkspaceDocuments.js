export const MEDICAL_DOCUMENT_FIELDS = 'id, tipo, titolo, data, paziente_nome, paziente_id, created_at';
export const FISCAL_DOCUMENT_FIELDS = 'id, tipo, numero, data, paziente_nome, paziente_id, importo, created_at';

const asTimestamp = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

export function normalizePatientDocument(row, source) {
  const fiscal = source === 'documenti_fiscali';
  const type = String(row?.tipo || (fiscal ? 'fiscale' : 'documento')).toLowerCase();
  return Object.freeze({
    id: row?.id,
    source,
    sourceId: row?.id,
    patientId: row?.paziente_id,
    title: fiscal
      ? `${type === 'fattura' ? 'Fattura' : 'Rimborso'}${row?.numero ? ` n. ${row.numero}` : ''}`
      : (row?.titolo || type),
    type,
    date: row?.data || row?.created_at || null,
    amount: fiscal ? Number(row?.importo) || 0 : null,
    category: type === 'ricetta' ? 'prescriptions' : type === 'consenso' ? 'consents' : fiscal ? 'fiscal' : 'clinical',
    hasPdf: true,
  });
}

export function mergePatientDocuments(medical = [], fiscal = []) {
  return [
    ...medical.map((row) => normalizePatientDocument(row, 'documenti_medici')),
    ...fiscal.map((row) => normalizePatientDocument(row, 'documenti_fiscali')),
  ].sort((a, b) => asTimestamp(b.date) - asTimestamp(a.date));
}

export async function loadPatientDocumentMetadata(client, patientId) {
  if (!patientId) return [];
  const medicalResult = await client.from('documenti_medici')
    .select(MEDICAL_DOCUMENT_FIELDS)
    .eq('paziente_id', patientId)
    .order('data', { ascending: false });
  if (medicalResult.error) throw medicalResult.error;

  const fiscalResult = await client.from('documenti_fiscali')
    .select(FISCAL_DOCUMENT_FIELDS)
    .eq('paziente_id', patientId)
    .order('data', { ascending: false });
  if (fiscalResult.error) throw fiscalResult.error;
  return mergePatientDocuments(medicalResult.data || [], fiscalResult.data || []);
}

export async function loadPatientDocumentPdf(client, document) {
  if (!document?.source || !document?.sourceId) throw new Error('Documento non valido');
  const { data, error } = await client.from(document.source)
    .select('pdf_base64')
    .eq('id', document.sourceId)
    .single();
  if (error) throw error;
  if (!data?.pdf_base64) throw new Error('PDF non disponibile');
  return data.pdf_base64;
}

export function aggregateDocumentTimeline(documents = []) {
  return documents.map((document) => Object.freeze({
    id: `document:${document.source}:${document.sourceId}`,
    entity: 'TIMELINE_EVENT',
    source: document.source,
    sourceId: document.sourceId,
    occurredAt: document.date,
    type: document.category === 'prescriptions' ? 'PRESCRIPTION_CREATED' : document.category === 'consents' ? 'CONSENT_SIGNED' : 'DOCUMENT_ADDED',
    label: document.category === 'prescriptions' ? 'Ricetta creata' : document.category === 'consents' ? `${document.title} firmato` : 'Documento clinico aggiunto',
  }));
}
