// Synthetic-only fixture (CARTELLE-MIE): my folders page; the network is answered by the test.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import { archivioDb } from '../../personal/src/lib/supabasePersonal.js';
import { PaginaCartellaMia } from '../../personal/src/sezioni/documenti/CartelleMie.jsx';
archivioDb.auth.getSession = async () => ({ data: { session: { access_token: 'token-finto' } } });
window.mieTest = { messaggi: [], aperti: [] };
function App() {
  const [id, setId] = useState(null);
  const [versione, setVersione] = useState(0);
  const ctx = {
    esegui: async (fn) => { try { await fn(); } catch (e) { window.mieTest.messaggi.push(`ERRORE ${e.message}`); } },
    apri: (p) => { window.mieTest.aperti.push(p); if (p.tipo === 'cartella-mia') setId(p.id); },
    aggiorna: () => setVersione((v) => v + 1), mostra: (m) => window.mieTest.messaggi.push(m),
    versione, impostazioni: { persone: [], sezioni: [] }, fascicoli: [],
  };
  return <div className="pp-app" style={{ padding: 16 }}><PaginaCartellaMia key={id || 'radice'} id={id} ctx={ctx} /></div>;
}
createRoot(document.getElementById('root')).render(<App />);
