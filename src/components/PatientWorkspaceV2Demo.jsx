import React from 'react';
import PatientWorkspaceV2 from './PatientWorkspaceV2.jsx';

const patient = { id: 'demo-patient', nome: 'Alessandra', cognome: 'Ferrero', sesso: 'Donna', dataNascita: '1979-04-18', telefono: '333 123 4567', cf: 'FRRLSN79D58D205K', comune: 'Cuneo', indirizzo: 'Corso Nizza 24', email: 'alessandra@example.test', note: 'Allergia alla penicillina', annotazioni: [{ id: 1, data: '2026-08-12', testo: 'Controllare sensibilità elemento 26 alla prossima visita.' }] };
const plans = [{ id: 'plan-1', pazienteId: patient.id, titolo: 'Riabilitazione conservativa', stato: 'attivo', voci: [{ prestazione: 'Igiene professionale', sede: 'Generale', prezzo: 110, eseguita: true, dataEsec: '2026-08-12' }, { prestazione: 'Otturazione composito', sede: '14', prezzo: 180, eseguita: true, dataEsec: '2026-08-12' }, { prestazione: 'Corona zirconia', sede: '26', prezzo: 720, eseguita: false }, { prestazione: 'Implantologia', sede: '36', prezzo: 950, stato: 'in_corso', eseguita: false }, { prestazione: 'Igiene', sede: 'Generale', prezzo: 110, statoLabel: 'Richiamo da programmare', eseguita: false }, { prestazione: 'Controllo endodontico', sede: '46', prezzo: 90, eseguita: false }, { prestazione: 'Ricostruzione composito', sede: '25', prezzo: 190, eseguita: false }, { prestazione: 'Controllo occlusale', sede: 'Generale', prezzo: 70, eseguita: false }] }];
const payments = [{ id: 'pay-1', pazienteId: patient.id, importo: 200, data: '2026-08-12' }];
const appointments = [{ id: 'app-1', pazienteId: patient.id, data: '2026-08-12', ora: '10:30', tipo: 'Igiene' }, { id: 'app-2', pazienteId: patient.id, data: '2026-09-09', ora: '15:00', tipo: 'Controllo' }];

export default function PatientWorkspaceV2Demo() {
  return <PatientWorkspaceV2 patient={patient} plans={plans} payments={payments} appointments={appointments} />;
}
