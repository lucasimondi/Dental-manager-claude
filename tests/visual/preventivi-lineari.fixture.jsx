// PREVENTIVI-LINEARI — synthetic data only (no real patient, no network).
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Preventivi from '../../src/components/Preventivi.jsx';
import PianoDrillDown from '../../src/components/PianoDrillDown.jsx';
import '../../src/styles.css';
const v = (prestazione, dente, prezzo) => ({ prestazione, dente, prezzo, eseguita: false, incassata: false });
const plan41 = { id: 41, pazienteId: 7, titolo: 'Preventivo', data: '2026-11-25', stato: 'attivo', sconto: 0, scontoTipo: 'pct', voci: [v('Estrazione', '44', 50), v('Devitalizzazione', '13', 90), v('Ricostruzione con perno', '13', 104), v('Igiene orale', '', 40)] };
const plan42 = { id: 42, pazienteId: 7, titolo: 'Seconda visita', data: '2026-11-25', stato: 'attivo', sconto: 0, scontoTipo: 'pct', voci: [v('Modifica scheletrato', '', 300)] };
const docs = [
  { id: 'a', piano_id: 41, paziente_id: 7, paziente_nome: 'Paziente Sintetico', titolo: 'Preventivo', data: '2026-11-25', numero: 'A1B2C3D4E5', archiviato: false, created_at: '2026-11-25T10:00:00Z', plan_snapshot: { ...plan41, voci: [...plan41.voci.slice(0, 1), { ...plan41.voci[1], prezzo: 80 }, ...plan41.voci.slice(2)] } },
  { id: 'b', piano_id: 42, paziente_id: 7, paziente_nome: 'Paziente Sintetico', titolo: 'Seconda visita', data: '2026-11-25', numero: 'F6G7H8I9J0', archiviato: false, created_at: '2026-11-25T09:00:00Z', plan_snapshot: plan42 },
  { id: 'c', piano_id: 41, paziente_id: 7, paziente_nome: 'Paziente Sintetico', titolo: 'Preventivo', data: '2026-11-25', numero: 'K1L2M3N4O5', archiviato: false, created_at: '2026-11-25T11:00:00Z', plan_snapshot: plan41 },
];
const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'u', app_metadata: { studio_id: 's' } } } } }) }, from: () => {
  const f = []; const q = { select: () => q, eq: (k, val) => { f.push([k, val]); return q; }, or: () => q, order: () => q, range: () => q,
    then: (res, rej) => Promise.resolve({ data: docs.filter((d) => f.every(([k, val]) => k === 'studio_id' || d[k] === val)), error: null }).then(res, rej) }; return q; } };
const patient = { id: 7, nome: 'Paziente', cognome: 'Sintetico' };
function Fixture() {
  const [plans, setPlans] = useState([plan41, plan42]);
  const view = new URLSearchParams(location.search).get('view');
  return <div style={{ padding: 12 }}>{view === 'piani'
    ? <PianoDrillDown plans={plans} patients={[patient]} setPlans={setPlans} quoteClient={client} />
    : <Preventivi patient={patient} plans={plans} setPlans={setPlans} si={{ nome: 'Studio Test' }} client={client} />}</div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
