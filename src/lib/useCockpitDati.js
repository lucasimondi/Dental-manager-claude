import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { rangePeriodo } from './useControlloDati';
import { calcolaSaluteStudio, calcolaDsoStimato } from './salutestudio';

// Dati aggiuntivi per la tab Cockpit, sopra a quelli già forniti da
// useControlloDati: costo orario/ore lavorabili (RPC già esistente
// get_costo_orario), KPI del mese precedente (stessa RPC get_kpi_periodo,
// solo con range diverso — nessuna nuova RPC), e i calcoli derivati
// (occupazione agenda, DSO, punteggio salute studio, alert). Nessuna
// scrittura: questa tab è puramente di lettura/simulazione.

const giorniTraDate = (da, a) => {
  const d1 = new Date(da + 'T12:00'), d2 = new Date(a + 'T12:00');
  return Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
};

const meseFa = (dataYMD) => {
  const d = new Date(dataYMD + 'T12:00');
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function useCockpitDati({ studioId, kpi, kpiLoading, totEsegDaInc, tassoAccettazione, appointments = [], periodo, daPer, aPer }) {
  const [costoOrario, setCostoOrario] = useState(null);
  const [kpiMesePrec, setKpiMesePrec] = useState(null);

  useEffect(() => {
    if (!studioId) return;
    supabase.rpc('get_costo_orario', { p_studio_id: studioId }).then(({ data, error }) => { if (!error) setCostoOrario(data); });
  }, [studioId]);

  useEffect(() => {
    if (!studioId) return;
    // Mese precedente rispetto a "oggi" (non rispetto al periodo selezionato in UI):
    // gli alert e il delta del punteggio confrontano sempre mese-su-mese reale.
    const oggi = new Date();
    const inizioMeseCorrente = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-01`;
    const daPrec = meseFa(inizioMeseCorrente);
    const dInizioPrec = new Date(daPrec + 'T12:00');
    const aPrec = `${dInizioPrec.getFullYear()}-${String(dInizioPrec.getMonth() + 1).padStart(2, '0')}-${new Date(dInizioPrec.getFullYear(), dInizioPrec.getMonth() + 1, 0).getDate()}`;
    supabase.rpc('get_kpi_periodo', { p_studio_id: studioId, p_data_inizio: daPrec, p_data_fine: aPrec })
      .then(({ data, error }) => { if (!error) setKpiMesePrec(data); });
  }, [studioId]);

  // ── Occupazione agenda: ore prenotate nel periodo ÷ ore lavorabili/mese ──
  // Usa la stessa base oraria di get_costo_orario (giorni apertura × ore ×
  // poltrone). Per il periodo "anno" moltiplica le ore mensili per il numero
  // di mesi effettivamente trascorsi, per non confrontare ore di un anno
  // intero con appuntamenti di 8 mesi.
  const oreLavorabiliMensili = costoOrario?.ore_lavorabili_mensili || null;
  const nMesiPeriodoOre = periodo === 'anno' && daPer && aPer ? Math.max(1, Math.round(giorniTraDate(daPer, aPer) / 30.4)) : 1;
  const oreLavorabiliPeriodo = oreLavorabiliMensili ? oreLavorabiliMensili * nMesiPeriodoOre : null;
  const minutiPrenotati = daPer && aPer
    ? appointments.filter(a => a.data >= daPer && a.data <= aPer && a.stato !== 'annullato').reduce((s, a) => s + (Number(a.durata) || 0), 0)
    : 0;
  const oreOccupatePct = oreLavorabiliPeriodo ? (minutiPrenotati / 60 / oreLavorabiliPeriodo) * 100 : null;

  // ── DSO stimato (vedi src/lib/salutestudio.js per la formula e i limiti) ──
  const giorniPeriodo = daPer && aPer ? giorniTraDate(daPer, aPer) : null;
  const dsoGiorni = kpi ? calcolaDsoStimato(totEsegDaInc, kpi.incassato, giorniPeriodo) : null;

  const salute = kpi ? calcolaSaluteStudio({
    ebitdaPct: kpi.ebitda_pct,
    breakEvenSuperato: kpi.break_even != null ? kpi.incassato >= kpi.break_even : null,
    tassoAccettazione,
    oreOccupatePct,
    dsoGiorni,
  }) : { punteggio: null, fattori: [] };

  // Confronto col mese scorso: SOLO sui fattori davvero storicizzati
  // (EBITDA e break-even, entrambi da get_kpi_periodo su un range passato).
  // Tasso accettazione, occupazione agenda e DSO sono sempre calcolati "a
  // oggi": non abbiamo uno snapshot del mese scorso per questi tre, quindi
  // non li includiamo nel confronto invece di riusare per finta il valore
  // di oggi come se fosse storico.
  const saluteMesePrec = kpiMesePrec ? calcolaSaluteStudio({
    ebitdaPct: kpiMesePrec.ebitda_pct,
    breakEvenSuperato: kpiMesePrec.break_even != null ? kpiMesePrec.incassato >= kpiMesePrec.break_even : null,
  }) : { punteggio: null, fattori: [] };

  const deltaSalute = salute.punteggio != null && saluteMesePrec.punteggio != null
    ? salute.punteggio - saluteMesePrec.punteggio
    : null;

  return {
    costoOrario, kpiMesePrec,
    oreOccupatePct, dsoGiorni, giorniPeriodo,
    salute, deltaSalute,
  };
}
