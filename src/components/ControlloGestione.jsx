import React, { useState } from 'react';
import { C } from '../lib/utils';
import { PageHeader, Ic } from './ui';
import AnnualFinancialOverview from './AnnualFinancialOverview.jsx';
import Proiezioni from './Proiezioni.jsx';
import Costi from './Costi.jsx';
import ControlloCockpit from './ControlloCockpit.jsx';
import MarginalitaPrestazioni from './MarginalitaPrestazioni.jsx';
import Incassi from './Incassi.jsx';
import ProdottoReconciliationModal from './ProdottoReconciliationModal.jsx';

const TABS = [
  { id: 'panoramica', icon: 'chart', label: 'Panoramica' },
  { id: 'cockpit', icon: 'tool', label: 'Cockpit' },
  { id: 'proiezioni', icon: 'trend', label: 'Proiezioni' },
  { id: 'costi', icon: 'receipt', label: 'Costi' },
  { id: 'marginalita', icon: 'spark', label: 'Marginalità' },
  { id: 'incassi', icon: 'pay', label: 'Incassi' },
];

function CanonicalBaseOverview({ studioId, onDrillDown }) {
  return <AnnualFinancialOverview studioId={studioId} onDrillDown={onDrillDown} />;
}

// POL-003E: solo la Panoramica BASE usa la fonte canonica.
// Cockpit, Proiezioni, Costi e Marginalità restano invariati; la modalità ADVANCED resta gated.
export default function ControlloGestione(props) {
  const [section, setSection] = useState('panoramica');
  const [prodottoPeriod, setProdottoPeriod] = useState(null);
  const active = TABS.find((item) => item.id === section);
  const openDrillDown = ({ field, ...period }) => {
    if (field === 'prodotto') {
      setProdottoPeriod(period);
      return;
    }
    setSection(field?.includes('incass') || field === 'credito_clienti'
      ? 'incassi'
      : field?.includes('costi')
        ? 'costi'
        : field?.includes('margine') || field?.includes('ebitda')
          ? 'marginalita'
          : 'cockpit');
  };

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
        {section === 'panoramica' && <CanonicalBaseOverview studioId={props.studioId} onDrillDown={openDrillDown} />}
        {section === 'cockpit' && <ControlloCockpit {...props} />}
        {section === 'proiezioni' && <Proiezioni studioId={props.studioId} />}
        {section === 'costi' && <Costi studioId={props.studioId} isDentistico={props.isDentistico} />}
        {section === 'marginalita' && <MarginalitaPrestazioni studioId={props.studioId} pricelist={props.pricelist} isDentistico={props.isDentistico} />}
        {section === 'incassi' && <Incassi studioId={props.studioId} patients={props.patients} plans={props.plans} payments={props.payments} pricelist={props.pricelist} setPlans={props.setPlans} setPayments={props.setPayments} onOpenPaz={props.onOpenPaz} embedded />}
        </main>
      </div>
      {prodottoPeriod && (
        <ProdottoReconciliationModal
          studioId={props.studioId}
          period={prodottoPeriod}
          patients={props.patients}
          onClose={() => setProdottoPeriod(null)}
        />
      )}
    </div>
  );
}
