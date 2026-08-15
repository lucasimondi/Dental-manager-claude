import { useState, useEffect, useRef } from 'react';

const PREFIX = 'dm_form_draft::';

// Una bozza serve a sopravvivere a un cambio app breve (whatsapp, una
// chiamata), non a restare valida per ore o giorni: oltre questa soglia
// viene considerata scaduta e si riparte puliti, invece di far ricomparire
// a sorpresa un form vecchio e magari non più pertinente.
const TTL_MS = 2 * 60 * 1000;

const leggiDraft = (key) => {
  try {
    const salvato = localStorage.getItem(key);
    if (!salvato) return undefined;
    const parsed = JSON.parse(salvato);
    // Formato atteso { v: valore, t: timestamp }. Un draft nel vecchio
    // formato (senza wrapper, da prima dell'introduzione della scadenza) o
    // scaduto viene trattato come assente, non come valore valido.
    if (!parsed || typeof parsed !== 'object' || typeof parsed.t !== 'number') return undefined;
    if (Date.now() - parsed.t > TTL_MS) return undefined;
    return parsed.v;
  } catch { return undefined; } // draft corrotto o non leggibile: ignora e riparti pulito
};

/**
 * Drop-in replacement per useState su un oggetto form, che salva
 * automaticamente il contenuto in localStorage mentre l'utente scrive e lo
 * ripristina se l'app viene ricaricata da zero (schermo spento, cambio app
 * in multitasking) — ma solo entro pochi minuti (TTL_MS sopra): non è una
 * cache permanente, è pensata per sopravvivere a un'interruzione breve.
 *
 * Uso: identico a useState, basta dargli una chiave stabile e unica per
 * quel form:
 *   const [form, setForm] = useFormPersistente('nuovo_documento_esami', { ... });
 *
 * Il draft si cancella da solo chiamando clearDraft() quando il form viene
 * salvato con successo o esplicitamente annullato — altrimenti resterebbe
 * a "riproporsi" (fino alla scadenza) anche dopo un salvataggio riuscito.
 */
export function useFormPersistente(chiave, valoreIniziale) {
  const key = PREFIX + chiave;
  const [state, setState] = useState(() => {
    const draft = leggiDraft(key);
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
export function haDraftSalvato(chiave) {
  return leggiDraft(PREFIX + chiave) !== undefined;
}
