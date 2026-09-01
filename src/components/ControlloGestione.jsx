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
import Incassi from './Incassi.jsx';

const TABS = [
  { id: 'panoramica', icon: 'chart', label: 'Panoramica' },
  { id: 'cockpit', icon: 'tool', label: 'Cockpit' },
  { id: 'proiezioni', icon: 'trend', label: 'Proiezioni' },
  { id: 'costi', icon: 'receipt', label: 'Costi' },
  { id: 'marginalita', icon: 'spark', label: 'Marginalità' },
  { id: 'incassi', icon: 'pay', label: 'Incassi' },
];

function CanonicalBaseOverview({ studioId, onDrillDown }) {
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
        <CanonicalManagementView snapshot={snapshot} mode={MANAGEMENT_CONTROL_MODES.BASE} onDrillDown={onDrillDown} />
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
  const [section, setSection] = useState('panoramica');
  const active = TABS.find((item) => item.id === section);

  return (
    <div className="management-hub">
      <div className="management-hub__header">
        <PageHeader icon="chart" title="Controllo di gestione" subtitle="Numeri chiave e strumenti operativi dello studio" />
        {section !== 'panoramica' && <button type="button" className="management-hub__back" onClick={() => setSection('panoramica')}><Ic n="back" s={14} c={C.pri} /> Panoramica</button>}
      </div>

      <div className="management-layout">
        <aside className="management-nav" aria-label="Aree controllo di gestione">
          {TABS.map((item) => <button type="button" key={item.id} className={section === item.id ? 'is-active' : ''} onClick={() => setSection(item.id)}><Ic n={item.icon} s={15} c={section === item.id ? C.pri : C.txm} /><span>{item.label}</span></button>)}
        </aside>
        <label className="management-nav-mobile">Area<select value={section} onChange={(event) => setSection(event.target.value)}>{TABS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <main className="management-hub__section" aria-label={active?.label}>
        {section === 'panoramica' && <CanonicalBaseOverview studioId={props.studioId} onDrillDown={(field) => setSection(field?.includes('incass') || field === 'credito_clienti' ? 'incassi' : field?.includes('costi') ? 'costi' : field?.includes('margine') || field?.includes('ebitda') ? 'marginalita' : 'cockpit')} />}
        {section === 'cockpit' && <ControlloCockpit {...props} />}
        {section === 'proiezioni' && <Proiezioni studioId={props.studioId} />}
        {section === 'costi' && <Costi studioId={props.studioId} isDentistico={props.isDentistico} />}
        {section === 'marginalita' && <MarginalitaPrestazioni studioId={props.studioId} pricelist={props.pricelist} isDentistico={props.isDentistico} />}
        {section === 'incassi' && <Incassi studioId={props.studioId} patients={props.patients} plans={props.plans} payments={props.payments} pricelist={props.pricelist} setPlans={props.setPlans} setPayments={props.setPayments} onOpenPaz={props.onOpenPaz} embedded />}
        </main>
      </div>
    </div>
  );
}
