// Persiste "dove si trovava l'utente" (pagina, paziente aperto, tab,
// modale documento/piano/appuntamento in corso) così se l'app viene
// ricaricata da zero — schermo spento a lungo, cambio app, memoria del
// telefono che scarica la pagina in background — al ritorno si ritrova
// automaticamente nello stesso punto, con il form che stava scrivendo
// ancora aperto (il testo stesso è già gestito da useFormPersistente, ma
// senza tornare al punto giusto della navigazione non verrebbe mai
// rimostrato per rileggerlo).
//
// Uso: un piccolo oggetto piatto salvato sotto un'unica chiave, aggiornato
// ad ogni passo di navigazione rilevante. Non è un router — resta lo stesso
// stile "stato a stringa" già usato nell'app, solo con un salvataggio extra.

const KEY = 'dm_posizione_navigazione';

export function salvaPosizione(parziale) {
  try {
    const attuale = leggiPosizione() || {};
    localStorage.setItem(KEY, JSON.stringify({ ...attuale, ...parziale }));
  } catch { /* storage non disponibile: la persistenza di navigazione è un extra, non deve rompere l'app */ }
}

export function leggiPosizione() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function pulisciPosizione(chiavi) {
  try {
    if (!chiavi) { localStorage.removeItem(KEY); return; }
    const attuale = leggiPosizione() || {};
    chiavi.forEach((k) => { delete attuale[k]; });
    localStorage.setItem(KEY, JSON.stringify(attuale));
  } catch { /* vedi sopra */ }
}

// Documento aperto (ricetta, documento medico, fattura, consenso): su iPhone l'app
// installata viene spesso ricaricata da zero quando si passa a un'altra app e si torna.
// Si ricorda quale documento era aperto e per quale paziente, così al rientro si riapre
// da solo con quello che si stava scrivendo (il testo lo tiene useFormPersistente).
// Stessa durata delle bozze: oltre, si riparte puliti.
export const DURATA_BOZZE_MS = 12 * 60 * 60 * 1000;

// `dove`: 'scheda' (scheda paziente) o 'home' (azione rapida Ricetta). `pazId` può essere
// vuoto per la ricetta dalla Home con il paziente non ancora scelto.
export function segnaDocumentoAperto(dove, pazId, flusso) {
  salvaPosizione({ documentoAperto: flusso ? { dove, pazId: pazId == null ? '' : String(pazId), flusso, t: Date.now() } : null });
}

export function documentoAperto(dove, pazId) {
  const doc = leggiPosizione()?.documentoAperto;
  if (!doc || doc.dove !== dove || typeof doc.t !== 'number' || Date.now() - doc.t > DURATA_BOZZE_MS) return null;
  if (pazId !== undefined && String(doc.pazId) !== String(pazId ?? '')) return null;
  return doc;
}
