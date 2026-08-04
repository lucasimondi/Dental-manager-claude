import { useState, useEffect, useRef } from 'react';

const PREFIX = 'dm_form_draft::';

/**
 * Drop-in replacement per useState su un oggetto form, che salva
 * automaticamente il contenuto in localStorage mentre l'utente scrive e lo
 * ripristina se l'app viene ricaricata da zero (schermo spento a lungo,
 * multitasking, memoria del telefono che scarica la pagina in background).
 *
 * Uso: identico a useState, basta dargli una chiave stabile e unica per
 * quel form:
 *   const [form, setForm] = useFormPersistente('nuovo_documento_esami', { ... });
 *
 * Il draft si cancella da solo chiamando clearDraft() quando il form viene
 * salvato con successo o esplicitamente annullato — altrimenti resterebbe
 * a "riproporsi" anche dopo un salvataggio riuscito.
 */
export function useFormPersistente(chiave, valoreIniziale) {
  const key = PREFIX + chiave;
  const [state, setState] = useState(() => {
    try {
      const salvato = localStorage.getItem(key);
      if (salvato) return JSON.parse(salvato);
    } catch { /* draft corrotto o non leggibile: ignora e riparti pulito */ }
    return typeof valoreIniziale === 'function' ? valoreIniziale() : valoreIniziale;
  });

  // Evita di scrivere su localStorage al primissimo render (che è già lo
  // stato letto da lì, o il default — nessun bisogno di riscriverlo subito).
  const primoRender = useRef(true);
  useEffect(() => {
    if (primoRender.current) { primoRender.current = false; return; }
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* storage pieno o non disponibile: silenzioso, non è critico */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const clearDraft = () => {
    try { localStorage.removeItem(key); } catch { /* niente da fare se non disponibile */ }
  };

  return [state, setState, clearDraft];
}

/**
 * Verifica se esiste un draft salvato per una chiave, senza doverlo
 * caricare in uno stato — utile per mostrare un banner "hai una bozza in
 * sospeso" prima ancora di aprire il form.
 */
export function haDraftSalvato(chiave) {
  try { return localStorage.getItem(PREFIX + chiave) != null; } catch { return false; }
}
