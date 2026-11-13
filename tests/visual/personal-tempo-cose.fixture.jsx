// Synthetic-only fixture (ARCHIVIO-TEMPO / ARCHIVIO-COSE): Documenti with the three doors; the network is answered by the test.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import { VistaDocumenti } from '../../personal/src/sezioni/documenti/Documenti.jsx';
import { PaginaCosa } from '../../personal/src/sezioni/documenti/Cose.jsx';
window.tempoTest = { aperti: [] };
function App() {
  const [pagina, setPagina] = useState(null);
  const ctx = {
    esegui: async (fn) => fn(), aggiorna: () => {}, mostra: () => {}, versione: 0, sotto: null, fascicoli: [],
    impostazioni: { persone: ['Giulia Prova'], sezioni: [] },
    apri: (p) => { window.tempoTest.aperti.push({ tipo: p.tipo, id: p.id }); if (p.tipo === 'cosa') setPagina(p); },
  };
  return (
    <div className="pp-app" style={{ padding: 16 }}>
      {pagina ? <><button type="button" onClick={() => setPagina(null)}>Indietro</button><PaginaCosa id={pagina.id} ctx={ctx} /></> : <VistaDocumenti ctx={ctx} />}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
