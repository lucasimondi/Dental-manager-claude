// Synthetic-only fixture (DOCUMENTI-AZIONI): document list with «•••» per document, select one/all,
// «Scarica / invia» (files or ZIP) and «Pratica» (move into a case).
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import { ElencoSelezionabile } from '../../personal/src/sezioni/documenti/Selezione.jsx';
window.azioniTest = { aperte: [], messaggi: [], scaricati: [] };
// Downloads: record instead of saving.
const orig = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () { if (this.download) { window.azioniTest.scaricati.push(this.download); return; } return orig.call(this); };
try { localStorage.setItem('poliedron-personal-elenco', new URLSearchParams(location.search).get('modo') || 'righe'); } catch { /* */ }
const esegui = async (f) => { try { await f(); } catch (e) { window.azioniTest.messaggi.push(`ERR ${e.message}`); } };
const DOCS = [
  { id: 'd1', titolo: 'Precetto di prova', fascicolo: 'legale', ente: 'Studio Prova', email_data: '2026-10-02T10:00:00Z', drive_file_id: 'f1', pratica_id: null, tag: [] },
  { id: 'd2', titolo: 'Sentenza di prova', fascicolo: 'legale', ente: 'Tribunale Prova', email_data: '2026-09-20T10:00:00Z', drive_file_id: 'f2', pratica_id: 'p1', tag: [] },
  { id: 'd3', titolo: 'Bolletta di prova', fascicolo: 'utenze', ente: 'Luce Prova', email_data: '2026-08-01T10:00:00Z', drive_file_id: 'f3', pratica_id: null, tag: [] },
];
function App() {
  const [versione, setVersione] = useState(0);
  const ctx = { esegui, versione, fascicoli: [{ codice: 'legale', nome: 'Legale' }, { codice: 'utenze', nome: 'Utenze' }], impostazioni: { persone: [] },
    apri: (p) => window.azioniTest.aperte.push(p), aggiorna: () => setVersione((v) => v + 1), mostra: (m) => window.azioniTest.messaggi.push(m) };
  return <div className="pp-app" style={{ padding: 16 }}><ElencoSelezionabile elenco={DOCS} ctx={ctx} titoloInvio="Pratica di prova" intestazione="3 documenti, dal più recente" /></div>;
}
createRoot(document.getElementById('root')).render(<App />);
