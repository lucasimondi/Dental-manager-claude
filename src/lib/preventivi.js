import { buildPreventivoPdf, totaliPreventivo } from './documenti/preventivoPdf.js';
import { nomeFileDaNome } from './documenti/pdfLayout.js';
import { today } from './utils.js';

export function quoteRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export const QUOTE_FIELDS = 'id,piano_id,paziente_id,paziente_nome,titolo,data,numero,plan_snapshot,archiviato,created_at';
export async function quoteIdentity(client) {
  const { data, error } = await client.auth.getSession();
  const user = data?.session?.user, studioId = user?.app_metadata?.studio_id;
  if (error || !user?.id || !studioId) throw new Error('Sessione dello studio non disponibile. Accedi nuovamente.');
  return { studioId, userId: user.id };
}
export async function listPreventivi(client, { patientId, archived = false, offset = 0, limit = 50, query: search = '' } = {}) {
  const { studioId } = await quoteIdentity(client);
  let query = client.from('preventivi').select(QUOTE_FIELDS).eq('studio_id', studioId).eq('archiviato', archived);
  if (patientId != null) query = query.eq('paziente_id', patientId);
  const term = search.trim().replace(/[^\p{L}\p{N}\s-]/gu, ' ').slice(0, 120);
  if (term) query = query.or(`paziente_nome.ilike.%${term}%,titolo.ilike.%${term}%,numero.ilike.%${term}%${/^\d{4}-\d{2}-\d{2}$/.test(term) ? `,data.eq.${term}` : ''}`);
  const { data, error } = await query.order('created_at', { ascending: false }).order('id').range(offset, offset + limit - 1);
  if (error) throw new Error('Archivio preventivi non disponibile. Riprova.');
  return data || [];
}
export async function loadPreventivo(client, id) {
  const { studioId } = await quoteIdentity(client);
  const { data, error } = await client.from('preventivi').select(`${QUOTE_FIELDS},pdf_base64`).eq('studio_id', studioId).eq('id', id).single();
  if (error || !data?.pdf_base64) throw new Error('Impossibile leggere il preventivo salvato.');
  return { ...data, dataUrl: data.pdf_base64, filename: nomeFileDaNome(data.paziente_nome), titolo: data.titolo };
}
// Request id remains stable on retry. The immutable PDF and its economic projection
// are saved together; changing a plan never rewrites a document already issued.
export async function archivePreventivo(client, { id, piano, paziente, si }) {
  if (!id || !piano?.id || !paziente?.id || String(piano.pazienteId) !== String(paziente.id)) throw new Error('Piano e paziente non corrispondono.');
  const { studioId, userId } = await quoteIdentity(client);
  const numero = id.replaceAll('-', '').slice(0, 10).toUpperCase();
  const data = today();
  const snapshot = { ...piano, numeroPreventivo: numero };
  const pdf = buildPreventivoPdf({ si, paziente, piano: snapshot, data });
  const { error } = await client.from('preventivi').upsert({
    id, studio_id: studioId, user_id: userId, piano_id: piano.id, paziente_id: paziente.id,
    paziente_nome: [paziente.nome, paziente.cognome].filter(Boolean).join(' '),
    titolo: piano.titolo || 'Preventivo', data, numero, plan_snapshot: snapshot, pdf_base64: pdf.dataUrl,
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error('Preventivo nel piano, ma documento non archiviato. Riprova: il piano non verrà duplicato.');
  return loadPreventivo(client, id);
}
export async function archiveQuoteRow(client, id, archived) {
  const { studioId } = await quoteIdentity(client);
  const { data, error } = await client.from('preventivi').update({ archiviato: archived }).eq('studio_id', studioId).eq('id', id).select('id').single();
  if (error || !data) throw new Error('Archiviazione non riuscita. Riprova.');
}
export function quoteTotal(row) { return totaliPreventivo(row.plan_snapshot).totale; }
