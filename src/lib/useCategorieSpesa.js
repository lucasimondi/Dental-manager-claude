import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase.js';
import { mergeCategorieSpesa } from './utils';

// Categorie di spesa personalizzabili per studio: le categorie base restano
// fisse (usate anche dal prompt dell'AI in estrai-spesa-documento), quelle
// custom si aggiungono in coda e sono condivise da tutto lo studio — la RLS
// di studio_info è scoped per studio_id, non per singolo utente, quindi
// qualunque collaboratore le legge/modifica.
export function useCategorieSpesa(studioId) {
  const [custom, setCustom] = useState([]);

  useEffect(() => {
    if (!studioId) return;
    supabase.from('studio_info').select('categorie_spesa_custom').eq('studio_id', studioId).limit(1).maybeSingle()
      .then(({ data }) => setCustom(data?.categorie_spesa_custom || []));
  }, [studioId]);

  const categorie = mergeCategorieSpesa(custom);

  const salva = useCallback(async (next) => {
    setCustom(next);
    if (!studioId) return;
    await supabase.from('studio_info').update({ categorie_spesa_custom: next }).eq('studio_id', studioId);
  }, [studioId]);

  const aggiungiCategoria = useCallback((nome) => {
    const pulito = (nome || '').trim();
    if (!pulito || categorie.includes(pulito)) return;
    salva([...custom, pulito]);
  }, [custom, categorie, salva]);

  const rimuoviCategoria = useCallback((nome) => {
    salva(custom.filter((c) => c !== nome));
  }, [custom, salva]);

  return { categorie, categorieCustom: custom, aggiungiCategoria, rimuoviCategoria };
}
