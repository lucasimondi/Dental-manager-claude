// Synthetic-only fixture (PERSONAL-ESPLORA-WIN11 fase 1): Esplora file inside a Personal page; the network is answered by the test.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import { archivioDb } from '../../personal/src/lib/supabasePersonal.js';
import { Pagina } from '../../personal/src/Pagina.jsx';
import { PaginaEsplora } from '../../personal/src/sezioni/documenti/Esplora.jsx';
archivioDb.auth.getSession = async () => ({ data: { session: { access_token: 'token-finto' } } });
window.espTest = { aperti: [], aggiornato: 0 };
const fascicoli = [
  { codice: 'utenze', nome: 'Utenze', ordine: 1, n: 3, n_azioni: 1 },
  { codice: 'veicoli', nome: 'Veicoli', ordine: 2, n: 1, n_azioni: 0 },
  { codice: 'clinico_pazienti', nome: 'Pazienti', ordine: 0, n: 9, n_azioni: 0 },
];
const ctx = {
  esegui: async (fn) => fn(), apri: (p) => window.espTest.aperti.push(p), aggiorna: () => { window.espTest.aggiornato += 1; },
  mostra: () => {}, versione: 0, impostazioni: { persone: [] }, fascicoli,
};
createRoot(document.getElementById('root')).render(
  <div className="pp-app"><Pagina titolo="Esplora file" visibile onIndietro={() => {}} senzaChiudi><PaginaEsplora ctx={ctx} /></Pagina></div>,
);
