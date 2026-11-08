// DOCUMENTI-STUDIO (PO 2026-11-08): documenti acquisiti in Studio (foto o file) e ricerca unica
// su tutti i documenti dello studio. Tabella documenti_studio + bucket privato documenti-studio
// (migrazione 20261108130000). Il file non viene mai letto dall'app né inviato a modelli.
export const BUCKET = 'documenti-studio';
export const MAX_BYTES = 15 * 1024 * 1024;
export const TIPI_DOCUMENTO = Object.freeze([
  { id: 'documento', nome: 'Documento' }, { id: 'referto', nome: 'Referto' }, { id: 'consenso', nome: 'Consenso' },
  { id: 'fattura_fornitore', nome: 'Fattura fornitore' }, { id: 'ricevuta', nome: 'Ricevuta' }, { id: 'preventivo', nome: 'Preventivo' }, { id: 'altro', nome: 'Altro' },
]);
const ESTENSIONI = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf' };

export function messaggioErroreDocumenti(error) {
  const t = `${error?.code || ''} ${error?.message || ''}`;
  if (/42P01|42883|PGRST202|PGRST205|documenti_studio|cerca_documenti_studio|Bucket not found/i.test(t) && /exist|schema cache|not find|relation|function|Bucket not found/i.test(t)) return 'I documenti dello studio saranno disponibili dopo l\'aggiornamento del database.';
  return error?.message || 'Documenti non disponibili in questo momento.';
}
const esito = ({ data, error }) => { if (error) throw new Error(messaggioErroreDocumenti(error)); return data; };

export function validaFile(file) {
  if (!file) throw new Error('Scegli o scatta un documento.');
  const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  if (!ESTENSIONI[mime]) throw new Error('Formato non supportato: usa una foto (JPG, PNG, HEIC) o un PDF.');
  if (!file.size || file.size > MAX_BYTES) throw new Error('Il file supera 15 MB.');
  return { mime, estensione: ESTENSIONI[mime] };
}
export const titoloDaFile = (nome) => String(nome || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);

/** Carica il file nella cartella dello studio, poi registra il documento; se la registrazione fallisce il file viene tolto. */
export async function acquisisciDocumento(db, { studioId, file, titolo, tipo = 'documento', pazienteId = null, data = null, note = '' }, uuid = () => crypto.randomUUID()) {
  if (!studioId) throw new Error('Studio non disponibile: accedi di nuovo.');
  const { mime, estensione } = validaFile(file);
  const t = String(titolo || '').trim() || titoloDaFile(file.name) || 'Documento';
  if (!TIPI_DOCUMENTO.some((x) => x.id === tipo)) throw new Error('Tipo di documento non valido.');
  const path = `${studioId}/${uuid()}.${estensione}`;
  esito(await db.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false }));
  const riga = { studio_id: studioId, titolo: t.slice(0, 200), tipo, file_path: path, mime, dimensione: file.size, note: String(note || '').slice(0, 2000), ...(pazienteId ? { paziente_id: Number(pazienteId) } : {}), ...(data ? { data } : {}) };
  const res = await db.from('documenti_studio').insert(riga).select('id, titolo, tipo, data, paziente_id, file_path, mime, created_at').single();
  if (res.error) { await db.storage.from(BUCKET).remove([path]).catch(() => {}); throw new Error(messaggioErroreDocumenti(res.error)); }
  return res.data;
}
export async function leggiDocumentiStudio(db) {
  return esito(await db.from('documenti_studio').select('id, titolo, tipo, data, paziente_id, file_path, mime, created_at').order('data', { ascending: false }).limit(500)) || [];
}
export async function urlDocumento(db, path) {
  return esito(await db.storage.from(BUCKET).createSignedUrl(path, 300)).signedUrl;
}
export async function eliminaDocumentoStudio(db, doc) {
  esito(await db.from('documenti_studio').delete().eq('id', doc.id));
  await db.storage.from(BUCKET).remove([doc.file_path]).catch(() => {});
}
export async function cercaDocumentiStudio(db, q, lim = 8) {
  return esito(await db.rpc('cerca_documenti_studio', { q: String(q || ''), lim })) || [];
}
/** Apre il file in una nuova scheda: la scheda si apre subito (gesto dell'utente), poi riceve l'indirizzo firmato. */
export async function apriFileDocumento(db, path, g = globalThis) {
  const scheda = g.open?.('', '_blank');
  try { const url = await urlDocumento(db, path); if (scheda) scheda.location.href = url; else g.location.assign(url); } catch (e) { scheda?.close(); throw e; }
}
