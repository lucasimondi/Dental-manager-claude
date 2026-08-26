import React, { useEffect, useState } from 'react';
import PatientWorkspaceV2 from './PatientWorkspaceV2.jsx';
import { supabase } from '../lib/supabase.js';
import { loadRealPatientWorkspace } from '../lib/patientWorkspaceClinicalFinancial.js';

const patient = { id: 'demo-patient', nome: 'Alessandra', cognome: 'Ferrero', sesso: 'Donna', dataNascita: '1979-04-18', telefono: '333 123 4567', cf: 'FRRLSN79D58D205K', comune: 'Cuneo', indirizzo: 'Corso Nizza 24', email: 'alessandra@example.test', note: 'Allergia alla penicillina', annotazioni: [{ id: 1, data: '2026-08-12', testo: 'Controllare sensibilità elemento 26 alla prossima visita.' }] };
const plans = [{ id: 'plan-1', pazienteId: patient.id, titolo: 'Riabilitazione conservativa', stato: 'attivo', voci: [{ prestazione: 'Igiene professionale', sede: 'Generale', prezzo: 110, eseguita: true, dataEsec: '2026-08-12' }, { prestazione: 'Otturazione composito', sede: '14', prezzo: 180, eseguita: true, dataEsec: '2026-08-12' }, { prestazione: 'Corona zirconia', sede: '26', prezzo: 720, eseguita: false }, { prestazione: 'Implantologia', sede: '36', prezzo: 950, stato: 'in_corso', eseguita: false }, { prestazione: 'Igiene', sede: 'Generale', prezzo: 110, statoLabel: 'Richiamo da programmare', eseguita: false }, { prestazione: 'Controllo endodontico', sede: '46', prezzo: 90, eseguita: false }, { prestazione: 'Ricostruzione composito', sede: '25', prezzo: 190, eseguita: false }, { prestazione: 'Controllo occlusale', sede: 'Generale', prezzo: 70, eseguita: false }] }];
const payments = [{ id: 'pay-1', pazienteId: patient.id, importo: 200, data: '2026-08-12' }];
const appointments = [{ id: 'app-1', pazienteId: patient.id, data: '2026-08-12', ora: '10:30', tipo: 'Igiene' }, { id: 'app-2', pazienteId: patient.id, data: '2026-09-09', ora: '15:00', tipo: 'Controllo' }];
const studioInfo = { nome: 'Studio demo', spec: 'Odontoiatria', vertical: 'dentistico', documenti_settings: { ricetta: true } };

export default function PatientWorkspaceV2Demo() {
  const patientId = new URLSearchParams(window.location.search).get('patientId');
  const [live, setLive] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!patientId) return;
    let active = true;
    loadRealPatientWorkspace(supabase, patientId).then((value) => active && setLive(value)).catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, [patientId]);
  if (patientId && !live && !error) return <main style={{ padding: 32 }}>Caricamento dati reali del paziente…</main>;
  if (error) return <main style={{ padding: 32 }}><h1>Workspace non disponibile</h1><p>{error}</p><p>Accedi allo studio e verifica il patientId.</p></main>;
  const source = live || { patient, plans, payments, appointments };
  return <PatientWorkspaceV2 {...source} studioInfo={studioInfo} documentClient={supabase} realMode={Boolean(live)} capabilities={live?.capabilities} canonicalFinancial={live?.canonicalFinancial} />;
}
