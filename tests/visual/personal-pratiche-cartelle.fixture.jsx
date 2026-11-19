// Synthetic-only fixture (PRATICHE-CARTELLE, proposal B): case folders grid and Home search finding cases.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import '../../personal/src/personale.css';
import { PraticheCartelle } from '../../personal/src/sezioni/documenti/PraticheCartelle.jsx';
import { VistaPersonale } from '../../personal/src/sezioni/altro/Personale.jsx';
window.cartelleTest = { aperti: [] };
const vista = new URLSearchParams(location.search).get('vista');
function App() {
  const [versione] = useState(0);
  const ctx = { esegui: async (f) => f(), versione, aggiorna: () => {}, mostra: () => {}, fascicoli: [], impostazioni: { persone: [] },
    vai: () => {}, apriAggiungi: () => {}, apri: (p) => window.cartelleTest.aperti.push({ tipo: p.tipo, id: p.p?.id || p.id || null }) };
  return <div className="pp-app" style={{ padding: 16 }}>{vista === 'home' ? <VistaPersonale ctx={ctx} /> : <PraticheCartelle ctx={ctx} />}</div>;
}
createRoot(document.getElementById('root')).render(<App />);
