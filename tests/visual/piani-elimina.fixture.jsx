import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PianoDrillDown from '../../src/components/PianoDrillDown.jsx';
import '../../src/styles/designTokens.css';
// PIANI-ELIMINA — dati sintetici, nessun database.
const iniziali = [{ id: 'pl1', pazienteId: 'p1', titolo: 'Piano di prova', stato: 'accettato', data: '2026-11-01', sconto: 0, scontoTipo: 'pct', voci: [
  { prestazione: 'Corona', dente: '46', prezzo: 600, eseguita: false },
  { prestazione: 'Igiene', prezzo: 85, eseguita: false },
] }];
function Fixture() {
  const [plans, setPlans] = useState(iniziali);
  window.__plans = plans;
  return <PianoDrillDown plans={plans} setPlans={setPlans} patients={[{ id: 'p1', nome: 'Mario', cognome: 'Rossi' }]} payments={[{ pianoId: 'pl1', stato: 'pagato', importo: 300 }]} si={{ nome: 'Studio di prova', vertical: 'dentistico' }} features={{}} />;
}
createRoot(document.getElementById('root')).render(<Fixture />);
