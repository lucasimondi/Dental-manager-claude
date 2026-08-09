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

export default function ControlloGestione({ studioId }) {
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
    </div>
  );
}
