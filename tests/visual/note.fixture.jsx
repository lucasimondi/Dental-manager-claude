import React from 'react';
import { createRoot } from 'react-dom/client';
import NotePage from '../../shared/note/NotePage.jsx';
import '../../src/styles/designTokens.css';
// NOTE-PERSONALI — dati sintetici in memoria, nessun database.
const now = new Date('2026-11-07T10:20:00Z').toISOString();
let rows = [
  { id: '1', testo: 'Nuovo studio\nChiedere all\'architetto la seconda poltrona vicino alla finestra.', area: 'idee', fissata: true, updated_at: now, created_at: now },
  { id: '2', testo: 'Spesa\nlatte\npellet\ndetersivo', area: 'casa', fissata: false, updated_at: now, created_at: now },
  { id: '3', testo: 'Regalo compleanno\nKit acquerelli, budget 25 €.', area: 'famiglia', fissata: false, updated_at: now, created_at: now },
  { id: '4', testo: 'Fornitore impianti\nOrdine 4.1×10 entro giovedì.', area: 'studio', fissata: false, updated_at: now, created_at: now },
  { id: '5', testo: 'Idea\nMessaggio il giorno prima con le istruzioni per l\'igiene.', area: 'idee', fissata: false, updated_at: now, created_at: now },
];
const db = { from: () => {
  const st = { op: 'select', payload: null, id: null, single: false };
  const chain = {
    select() { return chain; }, order() { return chain; }, limit() { return chain; }, single() { st.single = true; return chain; },
    insert(p) { st.op = 'insert'; st.payload = p; return chain; }, update(p) { st.op = 'update'; st.payload = p; return chain; }, delete() { st.op = 'delete'; return chain; },
    eq(_, v) { st.id = v; return chain; },
    then(ok, ko) { return Promise.resolve().then(() => {
      if (st.op === 'insert') { const r = { id: String(Date.now()), fissata: false, created_at: now, updated_at: now, ...st.payload }; rows = [r, ...rows]; return { data: r, error: null }; }
      if (st.op === 'update') { rows = rows.map(r => r.id === st.id ? { ...r, ...st.payload } : r); return { data: rows.find(r => r.id === st.id), error: null }; }
      if (st.op === 'delete') { rows = rows.filter(r => r.id !== st.id); return { data: null, error: null }; }
      return { data: rows, error: null };
    }).then(ok, ko); },
  };
  return chain;
} };
if (new URLSearchParams(location.search).get('theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
createRoot(document.getElementById('root')).render(<NotePage db={db} studioId="synthetic-studio" />);
