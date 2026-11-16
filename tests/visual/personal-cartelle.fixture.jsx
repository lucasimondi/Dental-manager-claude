// Synthetic-only fixture (CARTELLE-ELENCO-GESTIONE): folder list as Icons/List, multi-select delete, new folder.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import { VistaCartelle, PaginaNuovaCartella } from '../../personal/src/sezioni/documenti/Cartelle.jsx';
window.cartelleTest = { aperte: [], messaggi: [], sostituita: null };
const vista = new URLSearchParams(location.search).get('vista');
const esegui = async (f) => { try { await f(); } catch (e) { window.cartelleTest.messaggi.push(`ERR ${e.message}`); } };
function App() {
  const [versione, setVersione] = useState(0);
  const ctx = { esegui, versione, fascicoli: [{ codice: 'utenze', nome: 'Utenze' }, { codice: 'banca', nome: 'Banca' }],
    apri: (p) => window.cartelleTest.aperte.push(p), aggiorna: () => setVersione((v) => v + 1), mostra: (m) => window.cartelleTest.messaggi.push(m) };
  return <div className="pp-app" style={{ padding: 16 }}>{vista === 'nuova'
    ? <PaginaNuovaCartella ctx={ctx} sostituisci={(p) => { window.cartelleTest.sostituita = p; }} />
    : <VistaCartelle ctx={ctx} />}</div>;
}
createRoot(document.getElementById('root')).render(<App />);
