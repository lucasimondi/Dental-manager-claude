import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { rangePeriodo } from './useControlloDati';
import { calcolaSaluteStudio, calcolaDsoStimato } from './salutestudio';
import { adaptCanonicalSnapshotForManagement, loadCanonicalFinancialSnapshot } from './canonicalFinancialSelectors';

// Dati aggiuntivi per la tab Cockpit, sopra a quelli già forniti da
// useControlloDati: KPI del mese precedente dalla stessa snapshot canonica,
// e i calcoli derivati
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
  const [kpiMesePrec, setKpiMesePrec] = useState(null);

  useEffect(() => {
    if (!studioId) return;
    // Mese precedente rispetto a "oggi" (non rispetto al periodo selezionato in UI):
    // gli alert e il delta del punteggio confrontano sempre mese-su-mese reale.
    const oggi = new Date();
    const inizioMeseCorrente = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-01`;
    const daPrec = meseFa(inizioMeseCorrente);
    const dInizioPrec = new Date(daPrec + 'T12:00');
    const aPrec = `${dInizioPrec.getFullYear()}-${String(dInizioPrec.getMonth() + 1).padStart(2, '0')}-${new Date(dInizioPrec.getFullYear(), dInizioPrec.getMonth() + 1, 0).getDate()}`;
    loadCanonicalFinancialSnapshot(supabase, daPrec, aPrec, studioId)
      .then(({ snapshot, error }) => { if (!error) setKpiMesePrec(adaptCanonicalSnapshotForManagement(snapshot)); });
  }, [studioId]);

  // ── Occupazione agenda: ore prenotate nel periodo ÷ ore lavorabili/mese ──
  // Il denominatore arriva verbatim dalla snapshot canonica del periodo.
  const oreLavorabiliPeriodo = kpi?.ore_produttive_disponibili || null;
  const minutiPrenotati = daPer && aPer
    ? appointments.filter(a => a.data >= daPer && a.data <= aPer && a.stato !== 'annullato').reduce((s, a) => s + (Number(a.durata) || 0), 0)
    : 0;
  const oreOccupatePct = oreLavorabiliPeriodo ? (minutiPrenotati / 60 / oreLavorabiliPeriodo) * 100 : null;

  // ── DSO stimato (vedi src/lib/salutestudio.js per la formula e i limiti) ──
  const giorniPeriodo = daPer && aPer ? giorniTraDate(daPer, aPer) : null;
  const dsoGiorni = kpi ? calcolaDsoStimato(totEsegDaInc, kpi.incassato, giorniPeriodo) : null;

  const salute = kpi ? calcolaSaluteStudio({
    breakEvenSuperato: kpi.break_even_raggiunto,
    tassoAccettazione,
    oreOccupatePct,
    dsoGiorni,
  }) : { punteggio: null, fattori: [] };

  // Confronto col mese scorso: SOLO sui fattori davvero storicizzati
  // (per ora il break-even, disponibile nella snapshot canonica storica).
  // Tasso accettazione, occupazione agenda e DSO sono sempre calcolati "a
  // oggi": non abbiamo uno snapshot del mese scorso per questi tre, quindi
  // non li includiamo nel confronto invece di riusare per finta il valore
  // di oggi come se fosse storico.
  const saluteMesePrec = kpiMesePrec ? calcolaSaluteStudio({
    breakEvenSuperato: kpiMesePrec.break_even_raggiunto,
  }) : { punteggio: null, fattori: [] };

  const deltaSalute = salute.punteggio != null && saluteMesePrec.punteggio != null
    ? salute.punteggio - saluteMesePrec.punteggio
    : null;

  return {
    costoOrario: kpi ? { costo_orario: kpi.costo_orario_struttura, ore_lavorabili_mensili: kpi.ore_produttive_disponibili } : null, kpiMesePrec,
    oreOccupatePct, dsoGiorni, giorniPeriodo,
    salute, deltaSalute,
  };
}
