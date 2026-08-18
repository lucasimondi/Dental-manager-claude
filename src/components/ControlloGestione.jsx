import React, { useState } from 'react';
import { C } from '../lib/utils';
import PanoramicaControllo from './PanoramicaControllo.jsx';
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

// Controllo di Gestione: contenitore unico con sotto-sezioni.
// "Panoramica" = dati reali (sola lettura, RPC get_kpi_periodo).
// "Proiezioni" = target/budget dichiarati dall'utente, editabili, separati dai dati reali.
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

      {tab === 'panoramica' && <PanoramicaControllo {...props} />}
      {tab === 'cockpit' && <ControlloCockpit {...props} />}
      {tab === 'proiezioni' && <Proiezioni studioId={props.studioId} />}
      {tab === 'costi' && <Costi studioId={props.studioId} isDentistico={props.isDentistico} />}
      {tab === 'marginalita' && <MarginalitaPrestazioni studioId={props.studioId} pricelist={props.pricelist} isDentistico={props.isDentistico} />}
    </div>
  );
}
