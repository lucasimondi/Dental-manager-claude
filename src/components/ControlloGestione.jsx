import React, { useEffect, useState } from 'react';
import { C } from '../lib/utils';
import { PageHeader, Crd, Ic, EmptyState } from './ui';
import { supabase } from '../lib/supabase.js';
import { rangePeriodo } from '../lib/useControlloDati';
import { loadCanonicalFinancialSnapshot, MANAGEMENT_CONTROL_MODES } from '../lib/canonicalFinancialSelectors';
import CanonicalManagementView from './CanonicalManagementView.jsx';
import Proiezioni from './Proiezioni.jsx';
import Costi from './Costi.jsx';
import ControlloCockpit from './ControlloCockpit.jsx';
import MarginalitaPrestazioni from './MarginalitaPrestazioni.jsx';

const TABS = [
  { id: 'panoramica', icon: 'chart', label: 'Panoramica' },
  { id: 'cockpit', icon: 'tool', label: 'Cockpit' },
  { id: 'proiezioni', icon: 'trend', label: 'Proiezioni' },
  { id: 'costi', icon: 'receipt', label: 'Costi' },
  { id: 'marginalita', icon: 'spark', label: 'Marginalità' },
];

function CanonicalBaseOverview({ studioId }) {
  const [periodo, setPeriodo] = useState('mese');
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const [dateFrom, dateTo] = rangePeriodo(periodo);
    setLoading(true);
    setError('');
    loadCanonicalFinancialSnapshot(supabase, dateFrom, dateTo, studioId).then(({ snapshot: nextSnapshot, error: nextError }) => {
      if (!active) return;
      setSnapshot(nextSnapshot);
      setError(nextError?.message || '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [periodo, studioId]);

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: C.txl, fontWeight: 600 }}>Fonte finanziaria canonica POL-003</div>
        <div style={{ display: 'flex', gap: 4, background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 10, padding: 3 }}>
          {[
            { id: 'mese', label: 'Questo mese' },
            { id: 'anno', label: "Quest'anno" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriodo(item.id)}
              className="pol-btn"
              style={{
                border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                background: periodo === item.id ? C.pri : 'transparent', color: periodo === item.id ? '#fff' : C.txt,
                boxShadow: periodo === item.id ? `0 4px 10px -3px ${C.pri}66` : 'none',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <Crd style={{ textAlign: 'center', padding: 32, color: C.txl, fontSize: 13 }}>Caricamento dati canonici…</Crd>
      )}
      {error && (
        <Crd style={{ border: `1px solid ${C.dan}40`, background: `${C.dan}0d` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Ic n="warn" s={16} c={C.dan} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dan }}>Dati canonici non disponibili</div>
              <div style={{ fontSize: 12, color: C.dan, marginTop: 3, opacity: 0.85 }}>{error}</div>
            </div>
          </div>
        </Crd>
      )}
      {!loading && !error && snapshot && (
        <CanonicalManagementView snapshot={snapshot} mode={MANAGEMENT_CONTROL_MODES.BASE} />
      )}
      {!loading && !error && !snapshot && (
        <Crd><EmptyState icon="chart" title="Dati canonici non disponibili" /></Crd>
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
      <div style={{ padding: '0 14px' }}><PageHeader icon="chart" title="Controllo di gestione" /></div>
      <div className="pol-tabbar" style={{ background: C.bg, borderRadius: 10, padding: 4, margin: '0 14px 4px' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pol-tab${tab === t.id ? ' is-active' : ''}`}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 7, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
              background: tab === t.id ? C.sur : 'transparent',
              color: tab === t.id ? C.pri : C.txl,
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Ic n={t.icon} s={12} c={tab === t.id ? C.pri : C.txl} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'panoramica' && <CanonicalBaseOverview studioId={props.studioId} />}
      {tab === 'cockpit' && <ControlloCockpit {...props} />}
      {tab === 'proiezioni' && <Proiezioni studioId={props.studioId} />}
      {tab === 'costi' && <Costi studioId={props.studioId} isDentistico={props.isDentistico} />}
      {tab === 'marginalita' && <MarginalitaPrestazioni studioId={props.studioId} pricelist={props.pricelist} isDentistico={props.isDentistico} />}
    </div>
  );
}
