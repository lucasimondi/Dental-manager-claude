import React, { useState, useEffect } from 'react';
import { Crd, Btn, Inp } from './ui';
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

const KpiHero = ({ label, value, sub, color }) => (
  <div style={{ flex: '1 1 140px', minWidth: 130 }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 900, color: color || '#fff', marginTop: 3 }}>{value}</div>
    {sub && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{sub}</div>}
  </div>
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

export default function ControlloGestione({ studioId, patients = [], plans = [], payments = [], onOpenPaz, isDentistico = true }) {
  const [periodo, setPeriodo] = useState('mese');
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [pagExt, setPagExt] = useState([]);
  const [spese, setSpese] = useState([]);
  const [budgetVsActual, setBudgetVsActual] = useState(null);
  const [budgetForm, setBudgetForm] = useState({ incassato_target: '', costi_fissi_target: '', costi_variabili_target: '' });
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetMsg, setBudgetMsg] = useState('');

  useEffect(() => { load(); }, [periodo]);
  useEffect(() => { loadAux(); }, []);
  useEffect(() => { loadBudget(); }, [periodo]);

  const loadBudget = async () => {
    setBudgetLoading(true);
    const [da, a] = rangePeriodo(periodo);
    const { data, error } = await supabase.rpc('get_budget_vs_actual', {
      p_studio_id: studioId,
      p_data_inizio: da,
      p_data_fine: a,
    });
    if (!error) setBudgetVsActual(data);

    // Precarica il form con il target del mese corrente (solo vista "mese", ha senso editare un mese alla volta)
    if (periodo === 'mese') {
      const d = new Date();
      const { data: riga } = await supabase
        .from('budget')
        .select('*')
        .eq('studio_id', studioId)
        .eq('anno', d.getFullYear())
        .eq('mese', d.getMonth() + 1)
        .maybeSingle();
      setBudgetForm({
        incassato_target: riga?.incassato_target ?? '',
        costi_fissi_target: riga?.costi_fissi_target ?? '',
        costi_variabili_target: riga?.costi_variabili_target ?? '',
      });
    }
    setBudgetLoading(false);
  };

  const salvaBudget = async () => {
    setBudgetSaving(true);
    setBudgetMsg('');
    const d = new Date();
    const { error } = await supabase.from('budget').upsert({
      studio_id: studioId,
      anno: d.getFullYear(),
      mese: d.getMonth() + 1,
      incassato_target: Number(budgetForm.incassato_target) || 0,
      costi_fissi_target: Number(budgetForm.costi_fissi_target) || 0,
      costi_variabili_target: Number(budgetForm.costi_variabili_target) || 0,
    }, { onConflict: 'studio_id,anno,mese' });
    setBudgetSaving(false);
    if (error) setBudgetMsg('Errore: ' + error.message);
    else { setBudgetMsg('Salvato ✓'); loadBudget(); setTimeout(() => setBudgetMsg(''), 2000); }
  };

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

  const vaiAPiani = () => onOpenPaz && patients.length > 0 && onOpenPaz(patients[0], 'piani');

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── HERO: KPI principali su sfondo scuro, stile cruscotto direzionale ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.priD}, ${C.pri})`, borderRadius: 16, padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Controllo di Gestione</div>
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
        {err && <div style={{ color: '#fff', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 10, fontSize: 12 }}>Errore: {err}</div>}

        {kpi && !loading && (
          <>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <KpiHero label="Incassato" value={fmt(kpi.incassato)} />
              <KpiHero label="Costi totali" value={fmt(kpi.costi_totali)} />
              <KpiHero label="Margine" value={fmt(kpi.margine)} color={kpi.margine >= 0 ? '#8CFFB0' : '#FFB0B0'} sub={kpi.marginalita_pct != null ? `${kpi.marginalita_pct}% marginalità` : null} />
              <KpiHero label="Ticket medio" value={kpi.ticket_medio != null ? fmt(kpi.ticket_medio) : '—'} sub={`${kpi.n_pazienti_paganti} pazienti`} />
            </div>

            <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>Break-even</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                {kpi.break_even > 0
                  ? <>Costi fissi: <b style={{ color: '#fff' }}>{fmt(kpi.break_even)}</b>{kpi.incassato >= kpi.break_even
                      ? ' — superato ✓'
                      : `, mancano ${fmt(kpi.break_even - kpi.incassato)}`}</>
                  : 'Nessuna spesa marcata come "fissa". Vai in Spese e classifica affitto, personale ecc. per un break-even reale.'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── BUDGET VS CONSUNTIVO ── */}
      <div>
        <SectionLabel>🎯 Budget vs consuntivo</SectionLabel>
        <Crd style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {budgetLoading ? (
            <div style={{ color: C.txl, fontSize: 13 }}>Caricamento…</div>
          ) : budgetVsActual && budgetVsActual.mesi_con_budget > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { k: 'incassato', label: 'Incassato' },
                { k: 'costi_fissi', label: 'Costi fissi' },
                { k: 'costi_variabili', label: 'Costi variabili' },
                { k: 'margine', label: 'Margine' },
              ].map(({ k, label }) => {
                const v = budgetVsActual[k];
                const buono = k === 'costi_fissi' || k === 'costi_variabili' ? v.diff <= 0 : v.diff >= 0;
                return (
                  <div key={k} style={{ background: C.bg, borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.txl, textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.txt, marginTop: 2 }}>{fmt(v.reale)} <span style={{ fontSize: 11, fontWeight: 600, color: C.txl }}>/ {fmt(v.target)}</span></div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: buono ? C.suc : C.dan, marginTop: 1 }}>
                      {v.diff >= 0 ? '+' : ''}{fmt(v.diff)}{v.diff_pct != null ? ` (${v.diff_pct >= 0 ? '+' : ''}${v.diff_pct}%)` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.txl }}>Nessun budget impostato per questo periodo. Imposta un target qui sotto.</div>
          )}

          {periodo === 'mese' && (
            <div style={{ borderTop: `1px solid ${C.brd}`, paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.txm, marginBottom: 8 }}>Imposta target di questo mese</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.txl, marginBottom: 3 }}>Incassato €</div>
                  <Inp type="number" inputMode="decimal" value={budgetForm.incassato_target} onChange={e => setBudgetForm(f => ({ ...f, incassato_target: e.target.value }))} style={{ padding: '8px 9px', fontSize: 13 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.txl, marginBottom: 3 }}>Costi fissi €</div>
                  <Inp type="number" inputMode="decimal" value={budgetForm.costi_fissi_target} onChange={e => setBudgetForm(f => ({ ...f, costi_fissi_target: e.target.value }))} style={{ padding: '8px 9px', fontSize: 13 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.txl, marginBottom: 3 }}>Costi var. €</div>
                  <Inp type="number" inputMode="decimal" value={budgetForm.costi_variabili_target} onChange={e => setBudgetForm(f => ({ ...f, costi_variabili_target: e.target.value }))} style={{ padding: '8px 9px', fontSize: 13 }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Btn ch={budgetSaving ? 'Salvo…' : 'Salva target mese'} onClick={salvaBudget} dis={budgetSaving} sz="sm" />
                {budgetMsg && <span style={{ fontSize: 12, color: budgetMsg.startsWith('Errore') ? C.dan : C.suc, fontWeight: 700 }}>{budgetMsg}</span>}
              </div>
            </div>
          )}
        </Crd>
      </div>

      {/* ── ECONOMICO DETTAGLIATO ── */}
      <div>
        <SectionLabel>💰 Economico dettagliato</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatCard label="Incassato mese" value={fmt(mInc)} sub="solo studio" />
          <StatCard label={`Incassato ${anno}`} value={fmt(aInc)} sub="solo studio" />
          <StatCard label="Incasso mese" value={fmt(incassoLucaMese)} sub={`studio + collab.${extMese > 0 ? ' (+' + fmt(extMese) + ')' : ''}`} />
          <StatCard label="Incasso anno" value={fmt(incassoLucaAnno)} sub={`studio + collab.${extAnno > 0 ? ' (+' + fmt(extAnno) + ')' : ''}`} />
          <StatCard label="Eseguito da incassare" value={fmt(totEsegDaInc)} color={totEsegDaInc > 0 ? C.dan : C.txt} urgent={totEsegDaInc > 0} />
          <StatCard label="Accettato da eseguire" value={fmt(totAccNonEseg)} />
          <StatCard label="Totale preventivi accettati" value={fmt(totAccettati)} sub={`${preventiviAccettati.length} piani`} />
        </div>
      </div>

      {/* ── STATISTICHE ── */}
      <div>
        <SectionLabel>📊 Statistiche</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatCard label="Pazienti totali" value={patients.length} sub={`+${nuoviMese} questo mese`} />
          <StatCard label="Tasso accettazione" value={`${tassoAccettazione}%`} sub={`${preventiviAccettati.length}/${preventiviAttesa.length + preventiviAccettati.length + preventiviRifiutati.length} preventivi`} color={tassoAccettazione >= 70 ? C.suc : tassoAccettazione >= 40 ? C.war : C.dan} />
          <StatCard label="Valore medio piano" value={fmt(mediaValore)} />
          {topPrest && <StatCard label="Top prestazione" value={topPrest[0].length > 18 ? topPrest[0].slice(0, 16) + '…' : topPrest[0]} sub={`${topPrest[1]}x eseguita`} color={C.acc} />}
        </div>
      </div>

      {/* ── ANDAMENTO ── */}
      <div>
        <SectionLabel>📈 Andamento incassi</SectionLabel>
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

          {speseCategoria.length > 0 && (
            <Crd>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 2 }}>Dove vanno le spese</div>
              <div style={{ fontSize: 11, color: C.txl, marginBottom: 8 }}>Per categoria, ricorrenti proiettate su base annua/12</div>
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
          )}
        </div>
      </div>

      {/* ── CONTROLLO STUDIO (operativo) ── */}
      <div>
        <SectionLabel>🎛️ Controllo studio</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div onClick={vaiAPiani} style={{ background: C.priL, borderRadius: 12, padding: 12, border: `1px solid ${C.pri}25`, cursor: onOpenPaz ? 'pointer' : 'default' }}>
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
            txt={richiamiScaduti.length > 0 ? C.dan : C.war} badge={richiamiScaduti.length > 0} />

          <OpCard label="📆 Scadenze" value={scadenzePagamento.length}
            sub={`${scadenzeScadute.length} scadute · ${scadenzeProssime.length} prossime`}
            bg={scadenzeScadute.length > 0 ? C.danL : C.priL} border={scadenzeScadute.length > 0 ? C.dan : C.pri}
            txt={scadenzeScadute.length > 0 ? C.dan : C.pri} badge={scadenzeScadute.length > 0} />

          {isDentistico && (
            <OpCard label="🦷 Ortodonzia" value={pianiOrto.filter(o => !o.completato).length}
              sub={`${pianiOrto.filter(o => o.cambioScaduto).length} da cambiare · ${pianiOrto.filter(o => o.inAttesa).length} da avviare`}
              bg={pianiOrto.some(o => o.cambioScaduto) ? C.danL : C.purL} border={pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur}
              txt={pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur} />
          )}
        </div>
      </div>

      <div style={{ fontSize: 10, color: C.txl, textAlign: 'center', marginTop: -6 }}>
        Controllo di gestione interno · non sostituisce la contabilità fiscale
      </div>
    </div>
  );
}
