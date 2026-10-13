import { useState, useEffect, useRef } from 'react';
import { DURATA_BOZZE_MS } from './posizioneNavigazione.js';

const PREFIX = 'dm_form_draft::';

// Una bozza deve sopravvivere a un cambio app (WhatsApp, una chiamata: PO
// "deve rimanere aperto il documento anche quando cambio app e ritorno"), ma
// non far ricomparire a sorpresa un form vecchio. Era 2 minuti: troppo poco.
// Default 30 minuti: molti form (pagamenti, piani, richiami) cancellano la
// bozza solo al salvataggio, non all'annullamento, e un pagamento lasciato a
// metà non deve riproporsi ore dopo. I documenti (ricetta, documento medico,
// fattura) passano { durata: DURATA_BOZZE_MS } (12 ore) e cancellano la bozza
// quando vengono chiusi volontariamente.
const TTL_MS = 30 * 60 * 1000;
export { DURATA_BOZZE_MS };

const leggiDraft = (key, durata = TTL_MS) => {
  try {
    const salvato = localStorage.getItem(key);
    if (!salvato) return undefined;
    const parsed = JSON.parse(salvato);
    // Formato atteso { v: valore, t: timestamp }. Un draft nel vecchio
    // formato (senza wrapper, da prima dell'introduzione della scadenza) o
    // scaduto viene trattato come assente, non come valore valido.
    if (!parsed || typeof parsed !== 'object' || typeof parsed.t !== 'number') return undefined;
    if (Date.now() - parsed.t > durata) return undefined;
    return parsed.v;
  } catch { return undefined; } // draft corrotto o non leggibile: ignora e riparti pulito
};

/**
 * Drop-in replacement per useState su un oggetto form, che salva
 * automaticamente il contenuto in localStorage mentre l'utente scrive e lo
 * ripristina se l'app viene ricaricata da zero (schermo spento, cambio app
 * in multitasking) — entro TTL_MS (sopra): non è una cache permanente.
 *
 * Uso: identico a useState, basta dargli una chiave stabile e unica per
 * quel form:
 *   const [form, setForm] = useFormPersistente('nuovo_documento_esami', { ... });
 *
 * Il draft si cancella da solo chiamando clearDraft() quando il form viene
 * salvato con successo o esplicitamente annullato — altrimenti resterebbe
 * a "riproporsi" (fino alla scadenza) anche dopo un salvataggio riuscito.
 */
export function useFormPersistente(chiave, valoreIniziale, { durata = TTL_MS } = {}) {
  const key = PREFIX + chiave;
  const [state, setState] = useState(() => {
    const draft = leggiDraft(key, durata);
    if (draft !== undefined) return draft;
    return typeof valoreIniziale === 'function' ? valoreIniziale() : valoreIniziale;
  });

  // Evita di scrivere su localStorage al primissimo render (che è già lo
  // stato letto da lì, o il default — nessun bisogno di riscriverlo subito).
  const primoRender = useRef(true);
  useEffect(() => {
    if (primoRender.current) { primoRender.current = false; return; }
    try { localStorage.setItem(key, JSON.stringify({ v: state, t: Date.now() })); } catch { /* storage pieno o non disponibile: silenzioso, non è critico */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const clearDraft = () => {
    try { localStorage.removeItem(key); } catch { /* niente da fare se non disponibile */ }
  };

  return [state, setState, clearDraft];
}

/**
 * Verifica se esiste un draft salvato (e ancora entro la scadenza) per una
 * chiave, senza doverlo caricare in uno stato — utile per mostrare un
 * banner "hai una bozza in sospeso" prima ancora di aprire il form.
 */
export function haDraftSalvato(chiave, { durata = TTL_MS } = {}) {
  return leggiDraft(PREFIX + chiave, durata) !== undefined;
}
