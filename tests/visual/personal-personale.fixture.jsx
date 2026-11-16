// Synthetic-only fixture (PERSONALE-HOME): Home «Personale» and Conti; the network is answered by the test.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import '../../personal/src/personale.css';
import { VistaPersonale } from '../../personal/src/sezioni/altro/Personale.jsx';
import { VistaConti } from '../../personal/src/sezioni/conti/Conti.jsx';
window.personaleTest = { vai: [], aperti: [], aggiungi: 0 };
function App() {
  const [vista, setVista] = useState('altro');
  const ctx = {
    esegui: async (fn) => fn(), aggiorna: () => {}, mostra: () => {}, versione: 0, sotto: null, fascicoli: [], impostazioni: {},
    vai: (v, s) => { window.personaleTest.vai.push([v, s || null]); if (v === 'conti') setVista('conti'); },
    apri: (p) => window.personaleTest.aperti.push({ tipo: p.tipo, id: p.id || p.s?.id || null }),
    apriAggiungi: () => { window.personaleTest.aggiungi += 1; }, pagato: () => {},
  };
  return (
    <div className={`pp-app pp-vista-${vista}`} style={{ padding: 16 }}>
      {vista === 'conti' && <button type="button" onClick={() => setVista('altro')}>Torna</button>}
      {vista === 'altro' ? <VistaPersonale ctx={ctx} /> : <VistaConti ctx={ctx} />}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
