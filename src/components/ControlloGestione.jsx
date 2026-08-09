import React, { useState, useEffect } from 'react';
import { Crd } from './ui';
import { C, fmt, today } from '../lib/utils';
import { supabase } from '../lib/supabase.js';

// Periodi rapidi selezionabili. 'mese' e 'anno' usano la data odierna come riferimento.
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

const KpiCard = ({ label, value, sub, color }) => (
  <Crd style={{ padding: 14, flex: '1 1 140px', minWidth: 140 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: C.txl, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: color || C.txt, marginTop: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.txm, marginTop: 2 }}>{sub}</div>}
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

export default function ControlloGestione({ studioId, patients = [], plans = [], onOpenPaz, isDentistico = true }) {
  const [periodo, setPeriodo] = useState('mese');
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, [periodo]);

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

  // ── Controllo operativo (preventivi, richiami, scadenze, ortodonzia) ──
  // Stessa logica gia' usata in precedenza dentro Dashboard.jsx, spostata
  // qui perche' concettualmente e' "controllo", non un riepilogo del
  // giorno. Deriva tutto da plans/patients, nessuna query aggiuntiva.
  const calcPlanTot = (pl) => {
    const sub = (pl.voci || []).reduce((s, v) => s + Number(v.prezzo), 0);
    const sc = Number(pl.sconto) || 0;
    const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
    return Math.max(0, sub - scontato);
  };

  const t = today();
  const oggiD = new Date(t + 'T12:00');
  const tra30 = new Date(oggiD); tra30.setDate(tra30.getDate() + 30);

  const preventiviAccettati = plans.filter(pl => pl.stato === 'accettato');
  const preventiviAttesa = plans.filter(pl => (pl.stato || 'attivo') === 'attivo');
  const preventiviRifiutati = plans.filter(pl => pl.stato === 'rifiutato');

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

  const vaiAPiani = () => onOpenPaz && plans.length > 0 && onOpenPaz(patients[0], 'piani');

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: C.txt, margin: 0 }}>Controllo di Gestione</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODI.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)} style={{
              border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: periodo === p.id ? C.pri : C.sur, color: periodo === p.id ? '#fff' : C.txm,
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color: C.txl, fontSize: 13, padding: 20, textAlign: 'center' }}>Calcolo in corso…</div>}
      {err && <div style={{ color: C.dan, fontSize: 13, padding: 12, background: C.danL, borderRadius: 8 }}>Errore: {err}</div>}

      {kpi && !loading && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em' }}>💰 Economico</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <KpiCard label="Incassato" value={fmt(kpi.incassato)} color={C.suc} />
            <KpiCard label="Costi totali" value={fmt(kpi.costi_totali)} color={C.dan} />
            <KpiCard label="Margine" value={fmt(kpi.margine)} color={kpi.margine >= 0 ? C.suc : C.dan}
              sub={kpi.marginalita_pct != null ? `${kpi.marginalita_pct}% marginalità` : null} />
            <KpiCard label="Ticket medio" value={kpi.ticket_medio != null ? fmt(kpi.ticket_medio) : '—'}
              sub={`${kpi.n_pazienti_paganti} pazienti paganti`} />
          </div>

          <Crd style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Break-even</div>
            <div style={{ fontSize: 13, color: C.txm, lineHeight: 1.5 }}>
              {kpi.break_even > 0
                ? <>Costi fissi nel periodo: <b>{fmt(kpi.break_even)}</b>. Hai già incassato <b>{fmt(kpi.incassato)}</b>{kpi.incassato >= kpi.break_even
                    ? ' — break-even superato ✓'
                    : `, mancano ${fmt(kpi.break_even - kpi.incassato)} per coprire i costi fissi.`}</>
                : 'Nessuna spesa marcata come "fissa" in questo periodo. Vai in Spese e classifica affitto, personale ecc. come costo fisso per calcolare il break-even reale.'}
            </div>
          </Crd>

          <div style={{ fontSize: 10, color: C.txl, textAlign: 'center' }}>
            Dati dal {new Date(kpi.periodo_da + 'T12:00').toLocaleDateString('it-IT')} al {new Date(kpi.periodo_a + 'T12:00').toLocaleDateString('it-IT')} · gestione, non contabilità fiscale
          </div>
        </>
      )}

      {/* ── Controllo operativo ── */}
      <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>🎛️ Controllo studio</div>
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

        <OpCard
          label="🔔 Richiami" value={richiamiScaduti.length + richiamiProssimi.length}
          sub={`${richiamiScaduti.length} scaduti · ${richiamiProssimi.length} prossimi`}
          bg={richiamiScaduti.length > 0 ? C.danL : '#FEF3E2'} border={richiamiScaduti.length > 0 ? C.dan : C.war}
          txt={richiamiScaduti.length > 0 ? C.dan : C.war} badge={richiamiScaduti.length > 0}
        />
        <OpCard
          label="📆 Scadenze" value={scadenzePagamento.length}
          sub={`${scadenzeScadute.length} scadute · ${scadenzeProssime.length} prossime`}
          bg={scadenzeScadute.length > 0 ? C.danL : C.priL} border={scadenzeScadute.length > 0 ? C.dan : C.pri}
          txt={scadenzeScadute.length > 0 ? C.dan : C.pri} badge={scadenzeScadute.length > 0}
        />
        {isDentistico && (
          <OpCard
            label="🦷 Ortodonzia" value={pianiOrto.filter(o => !o.completato).length}
            sub={`${pianiOrto.filter(o => o.cambioScaduto).length} da cambiare · ${pianiOrto.filter(o => o.inAttesa).length} da avviare`}
            bg={pianiOrto.some(o => o.cambioScaduto) ? C.danL : C.purL} border={pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur}
            txt={pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur}
          />
        )}
      </div>
    </div>
  );
}
