import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PatientDentalOverview from '../../src/components/PatientDentalOverview.jsx';
import '../../src/styles/designTokens.css';
// PRESTAZIONI-ELIMINA — dati sintetici, nessun database.
const iniziali = [{ id: 'pl1', pazienteId: 'p1', titolo: 'Piano di prova', stato: 'accettato', sconto: 0, scontoTipo: 'pct', voci: [
  { prestazione: 'Otturazione', dente: '36', prezzo: 100, eseguita: true, dataEsec: '2026-11-02' },
  { prestazione: 'Corona', dente: '46', prezzo: 600, eseguita: false },
  { prestazione: 'Igiene', prezzo: 85, eseguita: false },
] }];
const payments = [{ pianoId: 'pl1', stato: 'pagato', importo: 300 }];
function Fixture() {
  const [plans, setPlans] = useState(iniziali);
  window.__plans = plans;
  return <PatientDentalOverview patientId="p1" plans={plans} payments={payments} setPlans={setPlans} onAddTreatment={() => {}} onCreateQuote={() => {}} />;
}
createRoot(document.getElementById('root')).render(<Fixture />);
