/* POL-AI-011 — salvare nella scheda del paziente il file allegato in Chat.

   Il file finisce nella sezione "Foto" della scheda: lo stesso archivio
   privato `patient-files` (percorso `<id paziente>/<data>_LABEL_<nome>`)
   che usa PatientPhotos.jsx, con le regole di accesso per studio già in
   produzione (POL-002B). Nessuna nuova tabella né funzione: il caricamento
   avviene dall'app con il login dell'utente, sempre dopo una conferma con
   il nome del paziente. */

import { cercaPazienti, trovaPazienteInTesto } from '../ricercaPazienti.js';

export const PATIENT_FILES_BUCKET = 'patient-files';

const SAVE_VERB = /\b(?:salva\w*|archivia\w*|metti\w*|carica\w*|aggiungi\w*|inserisci\w*)\b/i;
const RECORD_WORD = /\b(?:scheda|cartella|fascicolo)\b/i;
const NAME_AFTER = /\b(?:scheda|cartella|fascicolo)\s+(?:del(?:la|lo)?\s+|di\s+|a\s+|al(?:la|lo)?\s+)?(?:paziente\s+|sig(?:\.|nor[ae]?)?\s+)?(.+)$/i;
const NOT_A_NAME = /^(?:sua|suo|sue|giusta|corretta|paziente)\b/i;

/** "Salvalo nella scheda di Rossi", "archivia nella cartella del paziente"… */
export function isSaveToRecordRequest(text) {
  const value = String(text || '');
  return SAVE_VERB.test(value) && RECORD_WORD.test(value);
}

/**
 * Pazienti candidati per il salvataggio, dal testo della richiesta:
 * nome e cognome esatti → uno solo; altrimenti la ricerca del gestionale sul
 * nome scritto dopo "scheda di …" (al massimo 6). Nessun nome → [].
 */
export function saveTargetCandidates(text, patients = []) {
  const exact = trovaPazienteInTesto(patients, text);
  if (exact) return [exact];
  const match = String(text || '').match(NAME_AFTER);
  const name = (match?.[1] || '').replace(/[.!?,;:]+$/g, '').trim();
  if (!name || NOT_A_NAME.test(name)) return [];
  return cercaPazienti(patients, name).slice(0, 6);
}

/** Stesso schema di nome dei file caricati da PatientPhotos.jsx. */
export function patientFilePath(patientId, fileName, now = Date.now()) {
  const safeName = String(fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
  return `${patientId}/${now}_LABEL_${safeName}`;
}

export function attachmentBlob(attachment) {
  const binary = atob(attachment.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: attachment.mediaType });
}

/** Carica il file nella scheda; lancia un Error leggibile se non riesce. */
export async function saveAttachmentToPatient(client, patientId, attachment, now = Date.now()) {
  if (!client?.storage) throw new Error('Archivio non disponibile.');
  if (patientId == null || patientId === '') throw new Error('Scegli il paziente.');
  if (!attachment?.data || !attachment?.mediaType) throw new Error('Il file non è più disponibile: allegalo di nuovo.');
  const path = patientFilePath(patientId, attachment.name, now);
  const { error } = await client.storage
    .from(PATIENT_FILES_BUCKET)
    .upload(path, attachmentBlob(attachment), { upsert: false, contentType: attachment.mediaType });
  if (error) throw new Error('Salvataggio non riuscito. Riprova.');
  return path;
}
