import React, { useState, useEffect } from 'react';
import { Crd, Modal } from './ui';
import { C, fmt, today } from '../lib/utils';
import { supabase } from '../lib/supabase.js';
import { BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Line } from 'recharts';

const PERIODI = [
  { id: 'mese', label: 'Questo mese' },
  { id: 'anno', label: "Quest'anno" },
];

const rangePeriodo = (id) => {
  const d = new Date();
  if (id === 'mese') {
    const inizio = new Date(d.getFullYear(), d.getMonth(), 1);
    const fine = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return [inizio.toISOString().slice(0, 10), fine.toISOString().slice(0, 10)];
  }
  const inizio = new Date(d.getFullYear(), 0, 1);
  const fine = new Date(d.getFullYear(), 11, 31);
  return [inizio.toISOString().slice(0, 10), fine.toISOString().slice(0, 10)];
};

const MESI_LBL = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const CHART_PALETTE = [C.pri, C.acc, C.war, C.suc, '#7C3AED', C.dan, C.txl];
const FREQ_MESI = { Mensile: 1, Bimestrale: 2, Trimestrale: 3, Semestrale: 6, Annuale: 12 };

// ── Componenti di presentazione ──────────────────────────────────

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 8 }}>{children}</div>
);

const StatCard = ({ label, value, sub, color, onClick, urgent }) => (
  <Crd onClick={onClick} style={{ padding: 12, cursor: onClick ? 'pointer' : 'default', border: urgent ? `1px solid ${C.dan}40` : undefined }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: C.txl, textTransform: 'uppercase', letterSpacing: 0.2 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 800, color: color || C.txt, marginTop: 3 }}>{value}</div>
    {sub && <div style={{ fontSize: 10.5, color: C.txm, marginTop: 1 }}>{sub}</div>}
  </Crd>
);

const OpCard = ({ label, value, sub, bg, border, txt, onClick, badge }) => (
  <div onClick={onClick} style={{ background: bg, borderRadius: 12, padding: 12, border: `1px solid ${border}25`, cursor: onClick ? 'pointer' : 'default', position: 'relative' }}>
    {badge && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: C.dan }} />}
    <div style={{ fontSize: 10, fontWeight: 800, color: txt, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 900, color: txt, marginTop: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: C.txl }}>{sub}</div>}
  </div>
);

// Riga generica per liste dentro i popup di approfondimento
const RigaLista = ({ titolo, sotto, valore, valoreColor, onClick }) => (
  <div onClick={onClick} style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0',
    borderBottom: `1px solid ${C.brd}`, cursor: onClick ? 'pointer' : 'default',
  }}>
    <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titolo}</div>
      {sotto && <div style={{ fontSize: 11, color: C.txl, marginTop: 1 }}>{sotto}</div>}
    </div>
    {valore != null && <div style={{ fontSize: 13, fontWeight: 800, color: valoreColor || C.txt, whiteSpace: 'nowrap' }}>{valore}</div>}
  </div>
);

const VuotoLista = ({ children }) => (
  <div style={{ textAlign: 'center', color: C.txl, padding: '24px 0', fontSize: 13 }}>{children || 'Nessun elemento'}</div>
);

export default function PanoramicaControllo({ studioId, patients = [], plans = [], payments = [], onOpenPaz, isDentistico = true }) {
  const [periodo, setPeriodo] = useState('mese');
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [pagExt, setPagExt] = useState([]);
  const [spese, setSpese] = useState([]);
  const [dettaglio, setDettaglio] = useState(null); // id della voce con popup aperto, o null

  useEffect(() => { load(); }, [periodo]);
  useEffect(() => { loadAux(); }, []);

  const load = async () => {
    setLoading(true);
    setErr('');
    const [da, a] = rangePeriodo(periodo);
    const { data, error } = await supabase.rpc('get_kpi_periodo', {
      p_studio_id: studioId,
      p_data_inizio: da,
      p_data_fine: a,
    });
    if (error) setErr(error.message);
    else setKpi(data);
    setLoading(false);
  };

  const loadAux = async () => {
    const [{ data: pe }, { data: sp }] = await Promise.all([
      supabase.from('pagamenti_esterni').select('*'),
      supabase.from('spese').select('*'),
    ]);
    if (pe) setPagExt(pe);
    if (sp) setSpese(sp);
  };

  const t = today();
  const anno = t.slice(0, 4);
  const oggiD = new Date(t + 'T12:00');
  const tra30 = new Date(oggiD); tra30.setDate(tra30.getDate() + 30);

  const calcPlanTot = (pl) => {
    const sub = (pl.voci || []).reduce((s, v) => s + Number(v.prezzo), 0);
    const sc = Number(pl.sconto) || 0;
    const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
    return Math.max(0, sub - scontato);
  };

  // ── Incassi & margine stimato (vista integrativa, non sostituisce i KPI RPC) ──
  const mInc = payments.filter(p => p.data && p.data.startsWith(t.slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const aInc = payments.filter(p => p.data && p.data.startsWith(anno)).reduce((s, p) => s + Number(p.importo), 0);
  const extMese = pagExt.filter(p => p.data && p.data.startsWith(t.slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const extAnno = pagExt.filter(p => p.data && p.data.startsWith(anno)).reduce((s, p) => s + Number(p.importo), 0);
  const incassoLucaMese = mInc + extMese;
  const incassoLucaAnno = aInc + extAnno;

  // ── Eseguito da incassare / accettato da eseguire ──
  const esegDaInc = patients.map(paz => {
    const patPlans = plans.filter(pl => pl.pazienteId === paz.id);
    const voci = patPlans.flatMap(pl => {
      const subTot = (pl.voci || []).reduce((s, v) => s + Number(v.prezzo), 0);
      const sc = Number(pl.sconto) || 0;
      const scontato = pl.scontoTipo === 'pct' ? subTot * (sc / 100) : Math.min(sc, subTot);
      const fattore = subTot > 0 ? Math.max(0, subTot - scontato) / subTot : 1;
      return (pl.voci || []).filter(v => v.eseguita && !v.incassata).map(v => ({ ...v, prezzoScontato: Number(v.prezzo) * fattore }));
    });
    return { paz, voci, tot: voci.reduce((s, v) => s + v.prezzoScontato, 0) };
  }).filter(x => x.tot > 0);
  const totEsegDaInc = esegDaInc.reduce((s, x) => s + x.tot, 0);

  const accNonEseg = patients.map(paz => {
    const patPlans = plans.filter(pl => pl.pazienteId === paz.id && pl.stato === 'accettato');
    const voci = patPlans.flatMap(pl => (pl.voci || []).filter(v => !v.eseguita));
    return { paz, voci, tot: voci.reduce((s, v) => s + Number(v.prezzo), 0) };
  }).filter(x => x.tot > 0);
  const totAccNonEseg = accNonEseg.reduce((s, x) => s + x.tot, 0);

  // ── Preventivi & tasso accettazione ──
  const preventiviAccettati = plans.filter(pl => pl.stato === 'accettato');
  const preventiviAttesa = plans.filter(pl => (pl.stato || 'attivo') === 'attivo');
  const preventiviRifiutati = plans.filter(pl => pl.stato === 'rifiutato');
  const totAccettati = preventiviAccettati.reduce((s, pl) => s + calcPlanTot(pl), 0);
  const tassoAccettazione = (preventiviAttesa.length + preventiviAccettati.length + preventiviRifiutati.length) > 0
    ? Math.round(preventiviAccettati.length / (preventiviAttesa.length + preventiviAccettati.length + preventiviRifiutati.length) * 100) : 0;

  // ── Richiami, scadenze, ortodonzia ──
  const richiamiScaduti = plans.flatMap(pl => { const paz = patients.find(x => x.id === pl.pazienteId); if (!paz) return []; return (pl.voci || []).filter(v => v.richiamoData && new Date(v.richiamoData + 'T12:00') < oggiD).map(v => ({ paz, pl, v })); });
  const richiamiProssimi = plans.flatMap(pl => { const paz = patients.find(x => x.id === pl.pazienteId); if (!paz) return []; return (pl.voci || []).filter(v => { if (!v.richiamoData) return false; const d = new Date(v.richiamoData + 'T12:00'); return d >= oggiD && d <= tra30; }).map(v => ({ paz, pl, v })); });

  const scadenzePagamento = plans.filter(pl => pl.scadenzaPagamento).map(pl => {
    const paz = patients.find(x => x.id === pl.pazienteId);
    if (!paz) return null;
    return { pl, paz, scadenza: pl.scadenzaPagamento, importo: calcPlanTot(pl) };
  }).filter(Boolean);
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

  // ── Statistiche generali ──
  const nuoviMese = patients.filter(p => { const d = new Date(Number(p.id)); return !isNaN(d) && d.toISOString().startsWith(t.slice(0, 7)); }).length;
  const mediaValore = plans.length > 0 ? plans.reduce((s, pl) => s + calcPlanTot(pl), 0) / plans.length : 0;
  const prestCount = {}; plans.forEach(pl => (pl.voci || []).forEach(v => { if (v.eseguita) prestCount[v.prestazione] = (prestCount[v.prestazione] || 0) + 1; }));
  const topPrest = Object.entries(prestCount).sort((a, b) => b[1] - a[1])[0];

  // ── Grafici ──
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

  // ── Liste dettagliate per i popup di approfondimento ──
  const [daPer, aPer] = rangePeriodo(periodo);
  const pagamentiPeriodo = payments.filter(p => p.data && p.data >= daPer && p.data <= aPer).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const pagExtPeriodo = pagExt.filter(p => p.data && p.data >= daPer && p.data <= aPer).sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  // Replica ESATTAMENTE la logica di get_kpi_periodo (RPC), così la somma delle righe
  // nel popup coincide sempre col numero mostrato in alto. Senza questo, il popup
  // mostrava TUTTE le spese mai registrate (nessun filtro periodo), causando la
  // discrepanza segnalata dall'utente tra il totale e la somma dell'elenco.
  const fineMeseCorrente = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); })();
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
  const nomePaz = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.nome || ''} ${p.cognome || ''}`.trim() || 'Paziente' : 'Paziente'; };
  const tuttePrestazioni = Object.entries((() => {
    const c = {}; plans.forEach(pl => (pl.voci || []).forEach(v => { if (v.eseguita) c[v.prestazione] = (c[v.prestazione] || 0) + 1; })); return c;
  })()).sort((a, b) => b[1] - a[1]);

  const vaiAPiani = () => onOpenPaz && patients.length > 0 && onOpenPaz(patients[0], 'piani');
  const [mostraGrafici, setMostraGrafici] = useState(false);
  const [mostraStat, setMostraStat] = useState(false);

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── SOMMARIO: Incassi → Costi → Margine, gerarchico, dato reale ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.priD}, ${C.pri})`, borderRadius: 16, padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Sommario</div>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.4 }}>Dato reale</span>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 3 }}>
            {PERIODI.map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id)} style={{
                border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: periodo === p.id ? '#fff' : 'transparent', color: periodo === p.id ? C.pri : 'rgba(255,255,255,0.8)',
              }}>{p.label}</button>
            ))}
          </div>
        </div>

        {loading && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, padding: '10px 0' }}>Calcolo in corso…</div>}
        {err && <div style={{ color: '#fff', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 10, fontSize: 12, marginTop: 8 }}>Errore: {err}</div>}

        {kpi && !loading && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Riga Incassi */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Incassato</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{fmt(kpi.incassato)}</div>
            </div>
            {/* Riga Costi (sottrazione, visivamente subordinata) */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>− Costi (fissi + variabili)</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{fmt(kpi.costi_totali)}</div>
            </div>
            {/* Riga EBITDA (= Margine di Contribuzione - Costi Fissi), in evidenza */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '11px 0 4px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>= EBITDA</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 25, fontWeight: 900, color: kpi.ebitda >= 0 ? '#8CFFB0' : '#FFB0B0' }}>{fmt(kpi.ebitda)}</div>
                {kpi.ebitda_pct != null && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)' }}>{kpi.ebitda_pct}% sul fatturato</div>}
              </div>
            </div>

            <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                {kpi.break_even != null
                  ? <>Break-even: <b style={{ color: '#fff' }}>{fmt(kpi.break_even)}</b>{kpi.incassato >= kpi.break_even
                      ? ' — superato ✓'
                      : ` · mancano ${fmt(kpi.break_even - kpi.incassato)}`}</>
                  : (kpi.break_even_nota || 'Break-even non disponibile.')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Ticket medio <b style={{ color: '#fff' }}>{kpi.ticket_medio != null ? fmt(kpi.ticket_medio) : '—'}</b></div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Pazienti paganti <b style={{ color: '#fff' }}>{kpi.n_pazienti_paganti}</b></div>
            </div>
          </div>
        )}
      </div>

      {/* ── DETTAGLIO INCASSI ── */}
      <div>
        <SectionLabel>💵 Dettaglio incassi</SectionLabel>
        <Crd style={{ padding: 0, overflow: 'hidden' }}>
          <div onClick={() => setDettaglio('inc_mese_studio')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: C.txm, maxWidth: '68%' }}>Incassato dallo studio — mese</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.txt }}>{fmt(mInc)}</div>
          </div>
          <div onClick={() => setDettaglio('inc_anno_studio')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: `1px solid ${C.brd}`, cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: C.txm, maxWidth: '68%' }}>Incassato dallo studio — anno</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.txt }}>{fmt(aInc)}</div>
          </div>
          <div onClick={() => setDettaglio('inc_mese_tot')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: `1px solid ${C.brd}`, cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: C.txm, maxWidth: '68%' }}>Incassato totale (+ collaboratori) — mese{extMese > 0 ? `, di cui ${fmt(extMese)} collab.` : ''}</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.txt }}>{fmt(incassoLucaMese)}</div>
          </div>
          <div onClick={() => setDettaglio('inc_anno_tot')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: `1px solid ${C.brd}`, cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: C.txm, maxWidth: '68%' }}>Incassato totale (+ collaboratori) — anno{extAnno > 0 ? `, di cui ${fmt(extAnno)} collab.` : ''}</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.txt }}>{fmt(incassoLucaAnno)}</div>
          </div>
          <div onClick={() => setDettaglio('eseguito_da_incassare')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: `1px solid ${C.brd}`, background: totEsegDaInc > 0 ? C.danL : C.bg, cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: totEsegDaInc > 0 ? C.dan : C.txm, fontWeight: totEsegDaInc > 0 ? 700 : 400 }}>Eseguito da incassare</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: totEsegDaInc > 0 ? C.dan : C.txt }}>{fmt(totEsegDaInc)}</div>
          </div>
          <div onClick={() => setDettaglio('accettato_da_eseguire')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: `1px solid ${C.brd}`, cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: C.txm }}>Accettato da eseguire</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.txt }}>{fmt(totAccNonEseg)}</div>
          </div>
          <div onClick={() => setDettaglio('preventivi_accettati')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: `1px solid ${C.brd}`, cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: C.txm }}>Totale preventivi accettati <span style={{ color: C.txl }}>({preventiviAccettati.length} piani)</span></div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.txt }}>{fmt(totAccettati)}</div>
          </div>
        </Crd>
      </div>

      {/* ── DETTAGLIO COSTI ── */}
      <div>
        <SectionLabel>💸 Dettaglio costi</SectionLabel>
        <Crd style={{ padding: 0, overflow: 'hidden' }}>
          <div onClick={() => setDettaglio('costi_fissi')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: C.txm }}>Costi fissi <span style={{ color: C.txl }}>(affitto, personale, ricorrenti…)</span></div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.txt }}>{kpi ? fmt(kpi.costi_fissi) : '—'}</div>
          </div>
          <div onClick={() => setDettaglio('costi_variabili')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: `1px solid ${C.brd}`, cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: C.txm }}>Costi variabili <span style={{ color: C.txl }}>(materiali, laboratorio…)</span></div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.txt }}>{kpi ? fmt(kpi.costi_variabili) : '—'}</div>
          </div>
          <div onClick={() => setDettaglio('costi_totali')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: `1px solid ${C.brd}`, background: C.bg, cursor: 'pointer' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt }}>Totale costi</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.txt }}>{kpi ? fmt(kpi.costi_totali) : '—'}</div>
          </div>
        </Crd>

        {speseCategoria.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Crd>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 2 }}>Per categoria</div>
              <div style={{ fontSize: 11, color: C.txl, marginBottom: 8 }}>Ricorrenti proiettate su base annua/12</div>
              <ResponsiveContainer width="100%" height={Math.max(140, speseCategoria.length * 34)}>
                <BarChart data={speseCategoria} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.brd} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="categoria" tick={{ fontSize: 11, fill: C.txt }} axisLine={false} tickLine={false} width={92} />
                  <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
                  <Bar dataKey="tot" radius={[0, 6, 6, 0]} barSize={16}>
                    {speseCategoria.map((_, i) => <Cell key={i} fill={C.dan} fillOpacity={1 - i * 0.12} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Crd>
          </div>
        )}
      </div>

      {/* ── CONTROLLO STUDIO (operativo) ── */}
      <div>
        <SectionLabel>🎛️ Controllo studio</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div onClick={() => setDettaglio('preventivi')} style={{ background: C.priL, borderRadius: 12, padding: 12, border: `1px solid ${C.pri}25`, cursor: 'pointer' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.pri, textTransform: 'uppercase', marginBottom: 8 }}>📋 Preventivi</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 7, background: 'rgba(124,58,237,0.08)' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.pur }}>{preventiviAttesa.length}</div>
                <div style={{ fontSize: 9, color: C.txl }}>attesa</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 7, background: 'rgba(46,196,182,0.1)' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.acc }}>{preventiviAccettati.length}</div>
                <div style={{ fontSize: 9, color: C.txl }}>accettati</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 7, background: 'rgba(230,57,70,0.08)' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.dan }}>{preventiviRifiutati.length}</div>
                <div style={{ fontSize: 9, color: C.txl }}>rifiutati</div>
              </div>
            </div>
          </div>

          <OpCard label="🔔 Richiami" value={richiamiScaduti.length + richiamiProssimi.length}
            sub={`${richiamiScaduti.length} scaduti · ${richiamiProssimi.length} prossimi`}
            bg={richiamiScaduti.length > 0 ? C.danL : '#FEF3E2'} border={richiamiScaduti.length > 0 ? C.dan : C.war}
            txt={richiamiScaduti.length > 0 ? C.dan : C.war} badge={richiamiScaduti.length > 0}
            onClick={() => setDettaglio('richiami')} />

          <OpCard label="📆 Scadenze" value={scadenzePagamento.length}
            sub={`${scadenzeScadute.length} scadute · ${scadenzeProssime.length} prossime`}
            bg={scadenzeScadute.length > 0 ? C.danL : C.priL} border={scadenzeScadute.length > 0 ? C.dan : C.pri}
            txt={scadenzeScadute.length > 0 ? C.dan : C.pri} badge={scadenzeScadute.length > 0}
            onClick={() => setDettaglio('scadenze')} />

          {isDentistico && (
            <OpCard label="🦷 Ortodonzia" value={pianiOrto.filter(o => !o.completato).length}
              sub={`${pianiOrto.filter(o => o.cambioScaduto).length} da cambiare · ${pianiOrto.filter(o => o.inAttesa).length} da avviare`}
              bg={pianiOrto.some(o => o.cambioScaduto) ? C.danL : C.purL} border={pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur}
              txt={pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur}
              onClick={() => setDettaglio('ortodonzia')} />
          )}
        </div>
      </div>

      {/* ── STATISTICHE (collassabile) ── */}
      <div>
        <button onClick={() => setMostraStat(v => !v)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none',
          padding: '4px 0 8px', cursor: 'pointer',
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📊 Statistiche</span>
          <span style={{ fontSize: 11, color: C.pri, fontWeight: 700 }}>{mostraStat ? 'Nascondi ▲' : 'Mostra ▼'}</span>
        </button>
        {mostraStat && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <StatCard label="Pazienti totali" value={patients.length} sub={`+${nuoviMese} questo mese`} onClick={() => setDettaglio('pazienti')} />
            <StatCard label="Tasso accettazione" value={`${tassoAccettazione}%`} sub={`${preventiviAccettati.length}/${preventiviAttesa.length + preventiviAccettati.length + preventiviRifiutati.length} preventivi`} color={tassoAccettazione >= 70 ? C.suc : tassoAccettazione >= 40 ? C.war : C.dan} onClick={() => setDettaglio('preventivi')} />
            <StatCard label="Valore medio piano" value={fmt(mediaValore)} onClick={() => setDettaglio('preventivi_accettati')} />
            {topPrest && <StatCard label="Top prestazione" value={topPrest[0].length > 18 ? topPrest[0].slice(0, 16) + '…' : topPrest[0]} sub={`${topPrest[1]}x eseguita`} color={C.acc} onClick={() => setDettaglio('top_prestazioni')} />}
          </div>
        )}
      </div>

      {/* ── GRAFICI (collassabile) ── */}
      <div>
        <button onClick={() => setMostraGrafici(v => !v)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none',
          padding: '4px 0 8px', cursor: 'pointer',
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📈 Grafici e andamento</span>
          <span style={{ fontSize: 11, color: C.pri, fontWeight: 700 }}>{mostraGrafici ? 'Nascondi ▲' : 'Mostra ▼'}</span>
        </button>
        {mostraGrafici && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Crd>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 2 }}>Ultimi mesi</div>
              <div style={{ fontSize: 11, color: C.txl, marginBottom: 8 }}>Incasso mensile e media mobile</div>
              {andamentoMensile.length === 0 ? (
                <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessun incasso registrato</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={andamentoMensile} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
                    <XAxis dataKey="mese" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
                    <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v, n) => [fmt(v), n === 'incasso' ? 'Incasso' : 'Media mobile']} />
                    <Bar dataKey="incasso" fill={C.priL} radius={[6, 6, 0, 0]} barSize={26} />
                    <Line dataKey="media" stroke={C.pri} strokeWidth={2.5} dot={{ r: 3, fill: C.pri }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Crd>

            <Crd>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 2 }}>Dove incasso di più</div>
              <div style={{ fontSize: 11, color: C.txl, marginBottom: 8 }}>Per tipo prestazione, voci eseguite</div>
              {incassoPerPrestazione.length === 0 ? (
                <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessuna prestazione eseguita</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(140, incassoPerPrestazione.length * 34)}>
                  <BarChart data={incassoPerPrestazione} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.brd} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="tipo" tick={{ fontSize: 11, fill: C.txt }} axisLine={false} tickLine={false} width={92} />
                    <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
                    <Bar dataKey="incasso" radius={[0, 6, 6, 0]} barSize={16}>
                      {incassoPerPrestazione.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Crd>

            <Crd>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 2 }}>Incasso per giorno</div>
              <div style={{ fontSize: 11, color: C.txl, marginBottom: 8 }}>Aggregato su tutti gli incassi, Lun–Dom</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={incassoPerGiorno} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
                  <XAxis dataKey="giorno" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
                  <Bar dataKey="incasso" radius={[6, 6, 0, 0]} barSize={28}>
                    {incassoPerGiorno.map((d, i) => <Cell key={i} fill={d.top ? C.pri : C.priL} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Crd>

            <Crd>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 2 }}>Andamento spese</div>
              <div style={{ fontSize: 11, color: C.txl, marginBottom: 8 }}>Una tantum per mese + quota mensile ricorrenti ({fmt(ricorrentiMensile)}/mese)</div>
              {speseMensili.length === 0 && ricorrentiMensile === 0 ? (
                <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessuna spesa registrata</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={speseMensili} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
                    <XAxis dataKey="mese" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
                    <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v, n) => [fmt(v), n === 'unaTantum' ? 'Una tantum' : 'Ricorrenti (quota mese)']} />
                    <Bar dataKey="ricorrenti" stackId="s" fill={C.war + '55'} radius={[0, 0, 0, 0]} barSize={26} />
                    <Bar dataKey="unaTantum" stackId="s" fill={C.dan} radius={[6, 6, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Crd>
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: C.txl, textAlign: 'center', marginTop: -6 }}>
        Controllo di gestione interno · non sostituisce la contabilità fiscale
      </div>

      {/* ══ POPUP DI APPROFONDIMENTO ══ */}

      {dettaglio === 'preventivi' && (
        <Modal title="Preventivi" onClose={() => setDettaglio(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: 'rgba(124,58,237,0.08)' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.pur }}>{preventiviAttesa.length}</div>
              <div style={{ fontSize: 10, color: C.txl }}>in attesa</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: 'rgba(46,196,182,0.1)' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.acc }}>{preventiviAccettati.length}</div>
              <div style={{ fontSize: 10, color: C.txl }}>accettati</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: 'rgba(230,57,70,0.08)' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.dan }}>{preventiviRifiutati.length}</div>
              <div style={{ fontSize: 10, color: C.txl }}>rifiutati</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 6 }}>Tasso di accettazione: <b style={{ color: C.txt }}>{tassoAccettazione}%</b></div>
          {[...preventiviAttesa, ...preventiviAccettati].length === 0 ? <VuotoLista>Nessun preventivo</VuotoLista> : (
            <>
              {preventiviAttesa.map(pl => (
                <RigaLista key={pl.id} titolo={nomePaz(pl.pazienteId)} sotto="In attesa" valore={fmt(calcPlanTot(pl))} valoreColor={C.pur}
                  onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(patients.find(p => p.id === pl.pazienteId), 'piani'); }} />
              ))}
              {preventiviAccettati.map(pl => (
                <RigaLista key={pl.id} titolo={nomePaz(pl.pazienteId)} sotto="Accettato" valore={fmt(calcPlanTot(pl))} valoreColor={C.acc}
                  onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(patients.find(p => p.id === pl.pazienteId), 'piani'); }} />
              ))}
            </>
          )}
        </Modal>
      )}

      {dettaglio === 'richiami' && (
        <Modal title="Richiami" onClose={() => setDettaglio(null)}>
          {richiamiScaduti.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 4 }}>Scaduti ({richiamiScaduti.length})</div>
              {richiamiScaduti.map((r, i) => (
                <RigaLista key={i} titolo={nomePaz(r.paz.id)} sotto={`${r.v.prestazione || 'Richiamo'} · ${new Date(r.v.richiamoData + 'T12:00').toLocaleDateString('it-IT')}`}
                  onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(r.paz, 'piani'); }} />
              ))}
            </>
          )}
          {richiamiProssimi.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', margin: '14px 0 4px' }}>Prossimi 30 giorni ({richiamiProssimi.length})</div>
              {richiamiProssimi.map((r, i) => (
                <RigaLista key={i} titolo={nomePaz(r.paz.id)} sotto={`${r.v.prestazione || 'Richiamo'} · ${new Date(r.v.richiamoData + 'T12:00').toLocaleDateString('it-IT')}`}
                  onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(r.paz, 'piani'); }} />
              ))}
            </>
          )}
          {richiamiScaduti.length === 0 && richiamiProssimi.length === 0 && <VuotoLista>Nessun richiamo</VuotoLista>}
        </Modal>
      )}

      {dettaglio === 'scadenze' && (
        <Modal title="Scadenze pagamento" onClose={() => setDettaglio(null)}>
          {scadenzeScadute.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 4 }}>Scadute ({scadenzeScadute.length})</div>
              {scadenzeScadute.map((s, i) => (
                <RigaLista key={i} titolo={nomePaz(s.paz.id)} sotto={new Date(s.scadenza + 'T12:00').toLocaleDateString('it-IT')} valore={fmt(s.importo)} valoreColor={C.dan}
                  onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(s.paz, 'piani'); }} />
              ))}
            </>
          )}
          {scadenzeProssime.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.pri, textTransform: 'uppercase', margin: '14px 0 4px' }}>Prossime 30 giorni ({scadenzeProssime.length})</div>
              {scadenzeProssime.map((s, i) => (
                <RigaLista key={i} titolo={nomePaz(s.paz.id)} sotto={new Date(s.scadenza + 'T12:00').toLocaleDateString('it-IT')} valore={fmt(s.importo)}
                  onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(s.paz, 'piani'); }} />
              ))}
            </>
          )}
          {scadenzePagamento.length === 0 && <VuotoLista>Nessuna scadenza</VuotoLista>}
        </Modal>
      )}

      {dettaglio === 'ortodonzia' && (
        <Modal title="Ortodonzia" onClose={() => setDettaglio(null)}>
          {pianiOrto.filter(o => !o.completato).length === 0 ? <VuotoLista>Nessun piano ortodontico attivo</VuotoLista> : (
            pianiOrto.filter(o => !o.completato).map((o, i) => (
              <RigaLista key={i} titolo={nomePaz(o.paz.id)}
                sotto={o.inAttesa ? 'Da avviare' : o.cambioScaduto ? `Cambio scaduto · prossimo ${o.prossima ? new Date(o.prossima + 'T12:00').toLocaleDateString('it-IT') : '—'}` : `${o.cons}/${o.tot} mascherine`}
                valoreColor={o.cambioScaduto ? C.dan : undefined}
                onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(o.paz, 'piani'); }} />
            ))
          )}
        </Modal>
      )}

      {(dettaglio === 'inc_mese_studio' || dettaglio === 'inc_anno_studio') && (
        <Modal title={`Incassato dallo studio — ${dettaglio === 'inc_mese_studio' ? 'mese' : 'anno'}`} onClose={() => setDettaglio(null)}>
          {(() => {
            const lista = dettaglio === 'inc_mese_studio'
              ? payments.filter(p => p.data && p.data.startsWith(t.slice(0, 7)))
              : payments.filter(p => p.data && p.data.startsWith(anno));
            const ordinata = [...lista].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
            return ordinata.length === 0 ? <VuotoLista>Nessun incasso registrato</VuotoLista> : ordinata.map((p, i) => (
              <RigaLista key={i} titolo={nomePaz(p.pazienteId)} sotto={`${p.data ? new Date(p.data + 'T12:00').toLocaleDateString('it-IT') : ''}${p.metodo ? ' · ' + p.metodo : ''}`} valore={fmt(p.importo)} />
            ));
          })()}
        </Modal>
      )}

      {(dettaglio === 'inc_mese_tot' || dettaglio === 'inc_anno_tot') && (
        <Modal title={`Incassato totale — ${dettaglio === 'inc_mese_tot' ? 'mese' : 'anno'}`} onClose={() => setDettaglio(null)}>
          {(() => {
            const isMese = dettaglio === 'inc_mese_tot';
            const listaStudio = isMese ? payments.filter(p => p.data && p.data.startsWith(t.slice(0, 7))) : payments.filter(p => p.data && p.data.startsWith(anno));
            const listaExt = isMese ? pagExt.filter(p => p.data && p.data.startsWith(t.slice(0, 7))) : pagExt.filter(p => p.data && p.data.startsWith(anno));
            const tutti = [...listaStudio.map(p => ({ ...p, tipo: 'Studio' })), ...listaExt.map(p => ({ ...p, tipo: 'Collaboratore' }))].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
            return tutti.length === 0 ? <VuotoLista>Nessun incasso registrato</VuotoLista> : tutti.map((p, i) => (
              <RigaLista key={i} titolo={p.tipo === 'Studio' ? nomePaz(p.pazienteId) : (p.descrizione || 'Collaboratore')} sotto={`${p.tipo}${p.data ? ' · ' + new Date(p.data + 'T12:00').toLocaleDateString('it-IT') : ''}`} valore={fmt(p.importo)} valoreColor={p.tipo === 'Collaboratore' ? C.acc : undefined} />
            ));
          })()}
        </Modal>
      )}

      {dettaglio === 'eseguito_da_incassare' && (
        <Modal title="Eseguito da incassare" onClose={() => setDettaglio(null)}>
          {esegDaInc.length === 0 ? <VuotoLista>Niente da incassare</VuotoLista> : esegDaInc.map((x, i) => (
            <RigaLista key={i} titolo={nomePaz(x.paz.id)} sotto={`${x.voci.length} prestazioni eseguite`} valore={fmt(x.tot)} valoreColor={C.dan}
              onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(x.paz, 'piani'); }} />
          ))}
        </Modal>
      )}

      {dettaglio === 'accettato_da_eseguire' && (
        <Modal title="Accettato da eseguire" onClose={() => setDettaglio(null)}>
          {accNonEseg.length === 0 ? <VuotoLista>Niente in sospeso</VuotoLista> : accNonEseg.map((x, i) => (
            <RigaLista key={i} titolo={nomePaz(x.paz.id)} sotto={`${x.voci.length} prestazioni da eseguire`} valore={fmt(x.tot)}
              onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(x.paz, 'piani'); }} />
          ))}
        </Modal>
      )}

      {dettaglio === 'preventivi_accettati' && (
        <Modal title="Preventivi accettati" onClose={() => setDettaglio(null)}>
          {preventiviAccettati.length === 0 ? <VuotoLista>Nessun preventivo accettato</VuotoLista> : preventiviAccettati.map(pl => (
            <RigaLista key={pl.id} titolo={nomePaz(pl.pazienteId)} sotto={`${(pl.voci || []).length} voci`} valore={fmt(calcPlanTot(pl))}
              onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(patients.find(p => p.id === pl.pazienteId), 'piani'); }} />
          ))}
        </Modal>
      )}

      {dettaglio === 'costi_fissi' && (
        <Modal title="Costi fissi" onClose={() => setDettaglio(null)}>
          <div style={{ fontSize: 11, color: C.txl, marginBottom: 10 }}>Ricorrenti mostrate come contributo nel periodo selezionato ({nMesiPeriodo} mes{nMesiPeriodo === 1 ? 'e' : 'i'})</div>
          {speseFissePeriodo.length === 0 ? <VuotoLista>Nessuna spesa fissa registrata</VuotoLista> : speseFissePeriodo
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
            .map((s, i) => (
              <RigaLista key={i} titolo={s.titolo || s.categoria || 'Spesa'} sotto={`${s.categoria || ''}${s.ricorrente ? ` · ricorrente (${s.frequenza || 'Mensile'})` : ` · ${s.data ? new Date(s.data + 'T12:00').toLocaleDateString('it-IT') : ''}`}`}
                valore={fmt(contributoSpesaPeriodo(s))} />
            ))}
        </Modal>
      )}

      {dettaglio === 'costi_variabili' && (
        <Modal title="Costi variabili" onClose={() => setDettaglio(null)}>
          {speseVariabiliPeriodo.length === 0 ? <VuotoLista>Nessuna spesa variabile registrata</VuotoLista> : speseVariabiliPeriodo
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
            .map((s, i) => (
              <RigaLista key={i} titolo={s.titolo || s.categoria || 'Spesa'} sotto={`${s.categoria || ''}${s.data ? ' · ' + new Date(s.data + 'T12:00').toLocaleDateString('it-IT') : ''}`} valore={fmt(contributoSpesaPeriodo(s))} />
            ))}
        </Modal>
      )}

      {dettaglio === 'costi_totali' && (
        <Modal title="Tutti i costi" onClose={() => setDettaglio(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: C.bg }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.txt }}>{kpi ? fmt(kpi.costi_fissi) : '—'}</div>
              <div style={{ fontSize: 10, color: C.txl }}>fissi</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: C.bg }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.txt }}>{kpi ? fmt(kpi.costi_variabili) : '—'}</div>
              <div style={{ fontSize: 10, color: C.txl }}>variabili</div>
            </div>
          </div>
          {[...speseFissePeriodo, ...speseVariabiliPeriodo].length === 0 ? <VuotoLista>Nessuna spesa registrata</VuotoLista> : [...speseFissePeriodo, ...speseVariabiliPeriodo]
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
            .map((s, i) => (
              <RigaLista key={i} titolo={s.titolo || s.categoria || 'Spesa'} sotto={`${s.categoria || ''}${s.ricorrente ? ' · ricorrente' : ''}`} valore={fmt(contributoSpesaPeriodo(s))} />
            ))}
        </Modal>
      )}

      {dettaglio === 'pazienti' && (
        <Modal title="Pazienti" onClose={() => setDettaglio(null)}>
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 10 }}>{patients.length} totali · +{nuoviMese} questo mese</div>
          {patients.length === 0 ? <VuotoLista>Nessun paziente</VuotoLista> : [...patients]
            .sort((a, b) => (b.id || 0) - (a.id || 0))
            .slice(0, 100)
            .map((p, i) => (
              <RigaLista key={i} titolo={`${p.nome || ''} ${p.cognome || ''}`.trim() || 'Paziente'} onClick={() => { setDettaglio(null); onOpenPaz && onOpenPaz(p); }} />
            ))}
          {patients.length > 100 && <div style={{ fontSize: 11, color: C.txl, textAlign: 'center', marginTop: 8 }}>Mostrati i primi 100</div>}
        </Modal>
      )}

      {dettaglio === 'top_prestazioni' && (
        <Modal title="Prestazioni eseguite" onClose={() => setDettaglio(null)}>
          {tuttePrestazioni.length === 0 ? <VuotoLista>Nessuna prestazione eseguita</VuotoLista> : tuttePrestazioni.map(([nome, count], i) => (
            <RigaLista key={i} titolo={nome} valore={`${count}×`} />
          ))}
        </Modal>
      )}
    </div>
  );
}
