// Synthetic-only fixture (ARCHIVIO-CHIEDI): Documenti opens on «Chiedi»; the network is answered by the test.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import { VistaDocumenti } from '../../personal/src/sezioni/documenti/Documenti.jsx';
window.chiediTest = { aperti: [] };
const ctx = {
  esegui: async (fn) => fn(), apri: (p) => window.chiediTest.aperti.push(p), aggiorna: () => {}, mostra: () => {},
  versione: 0, impostazioni: { persone: ['Giulia Prova'], sezioni: [] }, fascicoli: [], sotto: null,
};
createRoot(document.getElementById('root')).render(<div className="pp-app" style={{ padding: 16 }}><VistaDocumenti ctx={ctx} /></div>);
