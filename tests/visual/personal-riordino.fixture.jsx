// Synthetic-only fixture (POL-VITA-ORDINA fase 2): «Piano di riordino» con dati inventati e database finto in memoria.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import { VistaRiordino } from '../../personal/src/sezioni/riordino/Riordino.jsx';
window.rrTest = { messaggi: [], aperti: [], update: [] };
const P = [
  ['10 Utenze/Luce – Enel/2024', 0.9, '2024-03-02_Bolletta_Enel_Marzo.pdf', 'Bolletta marzo.pdf'],
  ['10 Utenze/Luce – Enel/2024', 0.72, '2024-04-02_Bolletta_Enel_Aprile.pdf', 'scansione_0042.pdf'],
  ['02 Casa e catasto/Cuneo – via Esempio 1/Bollette', 0.88, '2023-01-10_Visura_Catasto_Via-Esempio.pdf', 'visura.pdf'],
  ['05 Fisco e tasse/2023/F24 e pagamenti', 0.91, '2023-06-16_F24_Agenzia-Entrate_Saldo-IMU.pdf', 'F24 giugno.pdf'],
  ['05 Fisco e tasse/2023/F24 e pagamenti', 0.66, '2023-11-30_F24_Agenzia-Entrate_Acconto.pdf', 'documento (3).pdf'],
  ['99 Da verificare/Dubbi', 0.4, '2019-05-01_Documento_Ente-Esempio_Lettera.pdf', 'lettera.pdf'],
];
const righe = P.map(([percorso_nuovo, confidenza, nome_nuovo, nome_attuale], i) => ({ id: `r${i}`, documento_id: `d${i}`, file_id: `f${i}`, percorso_attuale: 'Altro', nome_attuale, percorso_nuovo, nome_nuovo, confidenza, motivo: 'esempio: regola sul contenuto', scorciatoie: i === 3 ? ['02 Casa e catasto/Cuneo – via Esempio 1/Tasse'] : [], duplicato_di: null, stato: 'proposto' }));
const categorie = [...new Set(P.map((p) => p[0]))].map((percorso, i) => ({ id: `c${i}`, percorso }));
// ?giro=1 (fase 3b): lo script sta spostando da solo; 3 file già eseguiti, uno fermo dopo 3 errori.
const GIRO = new URLSearchParams(location.search).has('giro');
if (GIRO) {
  righe.forEach((r, i) => { r.stato = i < 3 ? 'eseguito' : i < 5 ? 'approvato' : 'proposto'; });
  window.rrTest.stato = { attivo: true, pausa: false, ultimo_giro: '2026-11-23T20:05:00Z', totale: { spostati: 3, errori: 4 } };
}
const FERMI = [{ file_id: 'f4', nome_attuale: 'documento (3).pdf', nome_nuovo: '2023-11-30_F24_Agenzia-Entrate_Acconto.pdf', percorso_nuovo: '05 Fisco e tasse/2023/F24 e pagamenti', errori: 3, ultimo_errore: 'File nel cestino di Drive', ultimo_il: '2026-11-23T20:05:00Z' }];
const qb = (tab) => {
  const q = { _ids: null, _campi: null,
    select() { return q; }, order() { return q; },
    range() { return Promise.resolve({ data: tab === 'categorie' ? categorie : righe.map((r) => ({ ...r })), error: null }); },
    update(c) { q._campi = c; return q; }, in(k, v) { q._ids = v; return q; },
    neq() { window.rrTest.update.push([q._ids, q._campi]); righe.forEach((r) => { if (q._ids.includes(r.id)) Object.assign(r, q._campi); }); return Promise.resolve({ error: null }); },
    eq() { return q; },
    maybeSingle() { return Promise.resolve(tab === 'impostazioni_app' && GIRO ? { data: { valore: window.rrTest.stato }, error: null } : { data: null, error: null }); },
    limit() { return Promise.resolve(tab === 'v_riordino_errori_ripetuti' && GIRO ? { data: FERMI, error: null } : { data: [], error: null }); },
    then(ok) { return Promise.resolve({ data: categorie, error: null }).then(ok); },
  };
  return q;
};
const db = { from: qb };
const ctx = { esegui: async (fn) => { try { await fn(); } catch (e) { window.rrTest.messaggi.push(`ERRORE ${e.message}`); } }, mostra: (m) => window.rrTest.messaggi.push(m), apri: (p) => window.rrTest.aperti.push(p) };
createRoot(document.getElementById('root')).render(<div className="pp-app" style={{ padding: 16 }}><VistaRiordino ctx={ctx} db={db} /></div>);
