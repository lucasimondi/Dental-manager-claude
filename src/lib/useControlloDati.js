import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { today } from './utils';
import { adaptCanonicalSnapshotForManagement, loadCanonicalFinancialSnapshot } from './canonicalFinancialSelectors';

// Fonte unica di calcolo per tutto ciò che oggi vive in Controllo di Gestione
// (PanoramicaControllo.jsx) e che Dashboard.jsx vuole poter mostrare come
// widget opzionali. Prima di questo hook la stessa logica (preventivi,
// richiami, scadenze, ortodonzia, statistiche, grafici, contributo spese nel
// periodo) era scritta due volte in due componenti diversi — lo stesso
// problema di "due fonti che possono divergere" già risolto per i KPI
// economici. Qui i KPI economici arrivano esclusivamente dalla snapshot
// canonica POL-003;
// tutto il resto (derivato da patients/plans/payments, già prop dei
// chiamanti) è calcolato una sola volta qui.

const MESI_LBL = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const FREQ_MESI = { Mensile: 1, Bimestrale: 2, Trimestrale: 3, Semestrale: 6, Annuale: 12 };

// Formatta la data LOCALE (anno/mese/giorno del fuso orario del browser) come
// 'YYYY-MM-DD', senza passare da toISOString(). toISOString() converte sempre
// in UTC: per chi è in un fuso avanti rispetto a UTC (es. Italia, UTC+1/+2),
// new Date(anno, mese, giorno).toISOString() fa scivolare indietro di un
// giorno "1 agosto" -> "31 luglio" e "31 agosto" -> "30 agosto". Il periodo
// "mese corrente" finiva così per coprire due mesi di calendario invece di
// uno, raddoppiando (o comunque falsando) il conteggio dei mesi usato per
// proiettare le spese ricorrenti — bug segnalato dall'utente (costi fissi
// mostrati a valori doppi rispetto al reale).
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const rangePeriodo = (id) => {
  const d = new Date();
  if (id === 'mese') {
    const inizio = new Date(d.getFullYear(), d.getMonth(), 1);
    const fine = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return [ymd(inizio), ymd(fine)];
  }
  const inizio = new Date(d.getFullYear(), 0, 1);
  const fine = new Date(d.getFullYear(), 11, 31);
  return [ymd(inizio), ymd(fine)];
};

const calcPlanTot = (pl) => {
  const sub = (pl.voci || []).reduce((s, v) => s + Number(v.prezzo), 0);
  const sc = Number(pl.sconto) || 0;
  const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
  return Math.max(0, sub - scontato);
};

export function useControlloDati({ studioId, patients = [], plans = [], payments = [], periodo = 'mese', enabled = true }) {
  const [kpi, setKpi] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiErr, setKpiErr] = useState('');
  const [pagExt, setPagExt] = useState([]);
  const [spese, setSpese] = useState([]);

  useEffect(() => {
    if (!studioId || !enabled) { setKpi(null); setKpiLoading(false); return; }
    setKpiLoading(true);
    setKpiErr('');
    const [da, a] = rangePeriodo(periodo);
    loadCanonicalFinancialSnapshot(supabase, da, a, studioId)
      .then(({ snapshot, error }) => {
        if (error) setKpiErr(error.message); else setKpi(adaptCanonicalSnapshotForManagement(snapshot));
        setKpiLoading(false);
      });
  }, [studioId, periodo, enabled]);

  useEffect(() => {
    if (!enabled) { setPagExt([]); setSpese([]); return; }
    supabase.from('pagamenti_esterni').select('*').then(({ data }) => { if (data) setPagExt(data); });
    supabase.from('spese').select('*').then(({ data }) => { if (data) setSpese(data); });
  }, [enabled]);

  const t = today();
  const anno = t.slice(0, 4);
  const oggiD = new Date(t + 'T12:00');
  const tra30 = new Date(oggiD); tra30.setDate(tra30.getDate() + 30);

  const mInc = payments.filter(p => p.data && p.data.startsWith(t.slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const aInc = payments.filter(p => p.data && p.data.startsWith(anno)).reduce((s, p) => s + Number(p.importo), 0);
  const extMese = pagExt.filter(p => p.data && p.data.startsWith(t.slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const extAnno = pagExt.filter(p => p.data && p.data.startsWith(anno)).reduce((s, p) => s + Number(p.importo), 0);
  const incassoLucaMese = mInc + extMese;
  const incassoLucaAnno = aInc + extAnno;

  const esegDaInc = patients.map(paz => {
    const patPlans = plans.filter(pl => pl.pazienteId === paz.id);
    const voci = patPlans.flatMap(pl => {
      const subTot = (pl.voci || []).reduce((s, v) => s + Number(v.prezzo), 0);
      const sc = Number(pl.sconto) || 0;
      const scontato = pl.scontoTipo === 'pct' ? subTot * (sc / 100) : Math.min(sc, subTot);
      const fattore = subTot > 0 ? Math.max(0, subTot - scontato) / subTot : 1;
      return (pl.voci || []).filter(v => v.eseguita && !v.incassata).map(v => ({ ...v, pianoTitolo: pl.titolo, prezzoScontato: Number(v.prezzo) * fattore }));
    });
    return { paz, voci, tot: voci.reduce((s, v) => s + v.prezzoScontato, 0) };
  }).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot);
  const totEsegDaInc = esegDaInc.reduce((s, x) => s + x.tot, 0);

  const accNonEseg = patients.map(paz => {
    const patPlans = plans.filter(pl => pl.pazienteId === paz.id && pl.stato === 'accettato');
    const voci = patPlans.flatMap(pl => (pl.voci || []).filter(v => !v.eseguita).map(v => ({ ...v, pianoTitolo: pl.titolo })));
    return { paz, voci, tot: voci.reduce((s, v) => s + Number(v.prezzo), 0) };
  }).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot);
  const totAccNonEseg = accNonEseg.reduce((s, x) => s + x.tot, 0);

  const preventiviAccettati = plans.filter(pl => pl.stato === 'accettato');
  const preventiviAttesa = plans.filter(pl => (pl.stato || 'attivo') === 'attivo');
  const preventiviRifiutati = plans.filter(pl => pl.stato === 'rifiutato');
  const totAccettati = preventiviAccettati.reduce((s, pl) => s + calcPlanTot(pl), 0);
  const tassoAccettazione = (preventiviAttesa.length + preventiviAccettati.length + preventiviRifiutati.length) > 0
    ? Math.round(preventiviAccettati.length / (preventiviAttesa.length + preventiviAccettati.length + preventiviRifiutati.length) * 100) : 0;

  const richiamiScaduti = plans.flatMap(pl => { const paz = patients.find(x => x.id === pl.pazienteId); if (!paz) return []; return (pl.voci || []).filter(v => v.richiamoData && new Date(v.richiamoData + 'T12:00') < oggiD).map(v => ({ paz, pl, v })); });
  const richiamiProssimi = plans.flatMap(pl => { const paz = patients.find(x => x.id === pl.pazienteId); if (!paz) return []; return (pl.voci || []).filter(v => { if (!v.richiamoData) return false; const d = new Date(v.richiamoData + 'T12:00'); return d >= oggiD && d <= tra30; }).map(v => ({ paz, pl, v })); });

  const scadenzePagamento = plans.filter(pl => pl.scadenzaPagamento).map(pl => {
    const paz = patients.find(x => x.id === pl.pazienteId);
    if (!paz) return null;
    return { pl, paz, scadenza: pl.scadenzaPagamento, importo: calcPlanTot(pl) };
  }).filter(Boolean).sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const scadenzeScadute = scadenzePagamento.filter(s => new Date(s.scadenza + 'T12:00') < oggiD);
  const scadenzeProssime = scadenzePagamento.filter(s => { const d = new Date(s.scadenza + 'T12:00'); return d >= oggiD && d <= tra30; });

  const pianiOrto = plans.filter(pl => pl.ortodonzia?.attivo).map(pl => {
    const paz = patients.find(x => x.id === pl.pazienteId);
    if (!paz) return null;
    const orto = pl.ortodonzia;
    const cons = orto.mascherineConsegnate || 0;
    const tot2 = Number(orto.mascherineTotali) || 0;
    const prossima = (() => { if (!orto.dataConsegnaInizio) return null; const ultima = orto.storico?.length > 0 ? orto.storico[orto.storico.length - 1].data : orto.dataConsegnaInizio; const d = new Date(ultima + 'T12:00'); d.setDate(d.getDate() + (orto.frequenzaSettimane || 2) * 7); return d.toISOString().slice(0, 10); })();
    return { pl, paz, orto, cons, tot: tot2, completato: tot2 > 0 && cons >= tot2, prossima, cambioScaduto: prossima && prossima <= t, inAttesa: !orto.dataConsegnaInizio };
  }).filter(Boolean);

  const nuoviMese = patients.filter(p => { const d = new Date(Number(p.id)); return !isNaN(d) && d.toISOString().startsWith(t.slice(0, 7)); }).length;
  const mediaValore = plans.length > 0 ? plans.reduce((s, pl) => s + calcPlanTot(pl), 0) / plans.length : 0;
  const prestCount = {}; plans.forEach(pl => (pl.voci || []).forEach(v => { if (v.eseguita) prestCount[v.prestazione] = (prestCount[v.prestazione] || 0) + 1; }));
  const topPrest = Object.entries(prestCount).sort((a, b) => b[1] - a[1])[0];
  const tuttePrestazioni = Object.entries(prestCount).sort((a, b) => b[1] - a[1]);

  const andamentoMensile = (() => {
    const map = {};
    payments.forEach(p => { if (!p.data) return; const m = p.data.slice(0, 7); map[m] = (map[m] || 0) + Number(p.importo); });
    const chiavi = Object.keys(map).sort();
    const ultime6 = chiavi.slice(-6);
    return ultime6.map((m, i) => {
      const finestra = ultime6.slice(Math.max(0, i - 2), i + 1).map(k => map[k]);
      const media = finestra.reduce((s, x) => s + x, 0) / finestra.length;
      return { mese: `${MESI_LBL[parseInt(m.slice(5)) - 1]} ${m.slice(2, 4)}`, incasso: Math.round(map[m]), media: Math.round(media) };
    });
  })();

  const incassoPerPrestazione = (() => {
    const map = {};
    plans.forEach(pl => {
      const subTot = (pl.voci || []).reduce((s, v) => s + Number(v.prezzo), 0);
      const sc = Number(pl.sconto) || 0;
      const scontato = pl.scontoTipo === 'pct' ? subTot * (sc / 100) : Math.min(sc, subTot);
      const fattore = subTot > 0 ? Math.max(0, subTot - scontato) / subTot : 1;
      (pl.voci || []).forEach(v => {
        if (!v.eseguita) return;
        const nome = v.prestazione || 'Altro';
        map[nome] = (map[nome] || 0) + Number(v.prezzo) * fattore;
      });
    });
    return Object.entries(map).map(([tipo, incasso]) => ({ tipo, incasso: Math.round(incasso) })).sort((a, b) => b.incasso - a.incasso).slice(0, 6);
  })();

  const incassoPerGiorno = (() => {
    const GIORNI_LBL = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const somma = [0, 0, 0, 0, 0, 0, 0];
    payments.forEach(p => { if (!p.data) return; const d = new Date(p.data + 'T12:00'); somma[d.getDay()] += Number(p.importo); });
    const ordine = [1, 2, 3, 4, 5, 6, 0];
    const max = Math.max(...ordine.map(i => somma[i]));
    return ordine.map(i => ({ giorno: GIORNI_LBL[i], incasso: Math.round(somma[i]), top: somma[i] === max && max > 0 }));
  })();

  const ricorrentiMensile = spese.filter(s => s.ricorrente).reduce((s, x) => s + Number(x.importo) / (FREQ_MESI[x.frequenza] || 1), 0);
  const speseMensili = (() => {
    const map = {};
    spese.filter(s => !s.ricorrente).forEach(s => { if (!s.data) return; const m = s.data.slice(0, 7); map[m] = (map[m] || 0) + Number(s.importo); });
    const chiavi = Object.keys(map).sort();
    const ultime6 = chiavi.slice(-6);
    return ultime6.map(m => ({ mese: `${MESI_LBL[parseInt(m.slice(5)) - 1]} ${m.slice(2, 4)}`, unaTantum: Math.round(map[m]), ricorrenti: Math.round(ricorrentiMensile) }));
  })();
  const speseCategoria = (() => {
    const map = {};
    spese.filter(s => !s.ricorrente).forEach(s => { const cat = s.categoria || 'Altro'; map[cat] = (map[cat] || 0) + Number(s.importo); });
    spese.filter(s => s.ricorrente).forEach(s => { const cat = s.categoria || 'Ricorrenti'; map[cat] = (map[cat] || 0) + Number(s.importo) / (FREQ_MESI[s.frequenza] || 1) * 12; });
    return Object.entries(map).map(([categoria, tot]) => ({ categoria, tot: Math.round(tot) })).sort((a, b) => b.tot - a.tot).slice(0, 8);
  })();

  // ── Contributo spese nel periodo selezionato per i soli dettagli operativi.
  // Non alimenta né ricostruisce i KPI finanziari canonici. ──
  const [daPer, aPer] = rangePeriodo(periodo);
  const fineMeseCorrente = (() => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); })();
  const fineEffettiva = aPer < fineMeseCorrente ? aPer : fineMeseCorrente;
  const nMesiPeriodo = (() => {
    if (fineEffettiva < daPer) return 0;
    const d1 = new Date(daPer + 'T12:00'), d2 = new Date(fineEffettiva + 'T12:00');
    return Math.max(1, (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1);
  })();
  const contributoSpesaPeriodo = (s) => {
    if (!s.ricorrente) return (s.data && s.data >= daPer && s.data <= aPer) ? Number(s.importo) : 0;
    if (!(s.data && s.data <= fineEffettiva && (!s.data_fine || s.data_fine >= daPer) && nMesiPeriodo > 0)) return 0;
    return (Number(s.importo) / (FREQ_MESI[s.frequenza] || 1)) * nMesiPeriodo;
  };
  const speseFissePeriodo = spese.filter(s => s.tipo_costo === 'fisso' && contributoSpesaPeriodo(s) > 0);
  const speseVariabiliPeriodo = spese.filter(s => (s.tipo_costo === 'variabile' || !s.tipo_costo) && contributoSpesaPeriodo(s) > 0);

  return {
    t, anno, kpi, kpiLoading, kpiErr, pagExt, spese,
    mInc, aInc, extMese, extAnno, incassoLucaMese, incassoLucaAnno,
    esegDaInc, totEsegDaInc, accNonEseg, totAccNonEseg,
    preventiviAccettati, preventiviAttesa, preventiviRifiutati, totAccettati, tassoAccettazione,
    richiamiScaduti, richiamiProssimi,
    scadenzePagamento, scadenzeScadute, scadenzeProssime,
    pianiOrto,
    nuoviMese, mediaValore, topPrest, tuttePrestazioni,
    andamentoMensile, incassoPerPrestazione, incassoPerGiorno, speseMensili, speseCategoria, ricorrentiMensile,
    daPer, aPer, nMesiPeriodo, contributoSpesaPeriodo, speseFissePeriodo, speseVariabiliPeriodo,
    calcPlanTot,
  };
}
