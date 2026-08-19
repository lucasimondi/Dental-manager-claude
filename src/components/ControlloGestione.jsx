import React, { useEffect, useState } from 'react';
import { C } from '../lib/utils';
import { supabase } from '../lib/supabase.js';
import { rangePeriodo } from '../lib/useControlloDati';
import { loadCanonicalFinancialSnapshot, MANAGEMENT_CONTROL_MODES } from '../lib/canonicalFinancialSelectors';
import CanonicalManagementView from './CanonicalManagementView.jsx';
import Proiezioni from './Proiezioni.jsx';
import Costi from './Costi.jsx';
import ControlloCockpit from './ControlloCockpit.jsx';
import MarginalitaPrestazioni from './MarginalitaPrestazioni.jsx';

const TABS = [
  { id: 'panoramica', label: 'Panoramica' },
  { id: 'cockpit', label: 'Cockpit' },
  { id: 'proiezioni', label: 'Proiezioni' },
  { id: 'costi', label: 'Costi' },
  { id: 'marginalita', label: 'Marginalità' },
];

function CanonicalBaseOverview() {
  const [periodo, setPeriodo] = useState('mese');
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const [dateFrom, dateTo] = rangePeriodo(periodo);
    setLoading(true);
    setError('');
    loadCanonicalFinancialSnapshot(supabase, dateFrom, dateTo).then(({ snapshot: nextSnapshot, error: nextError }) => {
      if (!active) return;
      setSnapshot(nextSnapshot);
      setError(nextError?.message || '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [periodo]);

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.txt }}>Controllo di Gestione · Base</div>
          <div style={{ fontSize: 11, color: C.txl, marginTop: 2 }}>Fonte finanziaria canonica POL-003</div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 8, padding: 3 }}>
          {[
            { id: 'mese', label: 'Questo mese' },
            { id: 'anno', label: "Quest'anno" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriodo(item.id)}
              style={{
                border: 'none', borderRadius: 6, padding: '6px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: periodo === item.id ? C.sur : 'transparent', color: periodo === item.id ? C.pri : C.txl,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color: C.txl, fontSize: 13, padding: '16px 0' }}>Caricamento dati canonici…</div>}
      {error && <div style={{ color: C.dan, fontSize: 12, padding: 12, border: `1px solid ${C.dan}40`, borderRadius: 10 }}>Dati canonici non disponibili: {error}</div>}
      {!loading && !error && snapshot && (
        <CanonicalManagementView snapshot={snapshot} mode={MANAGEMENT_CONTROL_MODES.BASE} />
      )}
      {!loading && !error && !snapshot && (
        <div style={{ color: C.txl, fontSize: 12, padding: 12 }}>Dati canonici non disponibili.</div>
      )}
    </div>
  );
}

// POL-003E: solo la Panoramica BASE usa la fonte canonica.
// Cockpit, Proiezioni, Costi e Marginalità restano invariati; la modalità ADVANCED resta gated.
export default function ControlloGestione(props) {
  const [tab, setTab] = useState('panoramica');

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 10, padding: 4, margin: '0 14px 4px', overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flexShrink: 0, border: 'none', borderRadius: 7, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              background: tab === t.id ? C.sur : 'transparent',
              color: tab === t.id ? C.pri : C.txl,
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'panoramica' && <CanonicalBaseOverview />}
      {tab === 'cockpit' && <ControlloCockpit {...props} />}
      {tab === 'proiezioni' && <Proiezioni studioId={props.studioId} />}
      {tab === 'costi' && <Costi studioId={props.studioId} isDentistico={props.isDentistico} />}
      {tab === 'marginalita' && <MarginalitaPrestazioni studioId={props.studioId} pricelist={props.pricelist} isDentistico={props.isDentistico} />}
    </div>
  );
}
