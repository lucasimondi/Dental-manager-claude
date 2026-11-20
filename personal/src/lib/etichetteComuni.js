// AGENDA-ETICHETTE (PO 2026-11-20) — le etichette dell'agenda sono quelle comuni salvate nello
// studio (studio_info.agenda_settings.etichette, vedi shared/agenda/etichette.js). Quelle di
// Personal servono solo finché lo studio non ne ha (vengono unite alle predefinite) e restano
// come copia per il widget e per quando lo studio non è collegato.
import { useCallback, useEffect } from 'react';
import { archivioDb } from './supabasePersonal.js';
import { leggiImpostazioni, salvaImpostazioni } from './impostazioni.js';
import { etichetteAgendaStudio, salvaEtichetteAgendaStudio } from './studio.js';
import { normalizzaEtichette } from '../../../shared/agenda/etichette.js';

export function useImpostazioniComuni(setImpostazioni, setErrore) {
  useEffect(() => {
    let vivo = true;
    (async () => {
      const proprie = await leggiImpostazioni(archivioDb).catch(() => null);
      const comuni = await etichetteAgendaStudio().catch(() => null);
      if (!vivo) return;
      setImpostazioni((i) => {
        const base = proprie || i;
        return { ...base, etichette: normalizzaEtichette(comuni, { aggiuntive: base.etichette }) };
      });
    })();
    return () => { vivo = false; };
  }, [setImpostazioni]);

  return useCallback(async (etichette) => {
    const pulite = normalizzaEtichette(etichette);
    setImpostazioni((i) => ({ ...i, etichette: pulite }));
    try { await salvaEtichetteAgendaStudio(pulite); } catch (e) { setErrore(`Etichette non salvate nello studio: ${e.message}`); }
    try { await salvaImpostazioni(archivioDb, { ...(await leggiImpostazioni(archivioDb)), etichette: pulite }); } catch { /* copia facoltativa */ }
    return pulite;
  }, [setImpostazioni, setErrore]);
}
