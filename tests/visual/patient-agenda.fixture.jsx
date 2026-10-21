// Real Studio agenda and patient record; synthetic records and intercepted IO.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import Agenda from '../../src/components/Agenda.jsx';
import PatientAgendaLayer from '../../src/components/PatientAgendaLayer.jsx';
import PatientWorkspaceBoundary from '../../src/components/PatientWorkspaceBoundary.jsx';
import { persistPatientAgendaBooking } from '../../src/lib/patientAgendaBooking.js';
import '../../src/styles.css';
import '../../src/styles/designTokens.css';
import '../../src/components/PremiumVisualSystem.css';
const patient = { id: 7, nome: 'Paziente', cognome: 'Test', email: 'test@example.invalid' };
const settings = { oraInizio: 8, oraFine: 20, slotMin: 30, durataDefault: 30, hiddenWeekdays: [] };
function Fixture() {
  const [appointments, setAppointments] = useState([{ id: 3, pazienteId: 7, data: '2026-10-23', ora: '10:00', durata: 60, tipo: 'Visita', stato: 'confermato' }]);
  const [request, setRequest] = useState(null), [saving, setSaving] = useState(false);
  window.__appointments = appointments;
  const db = { getAll: async key => key === 'dm_a' ? appointments : [], insert: async (key, row) => {
    window.__writes = (window.__writes || 0) + 1;
    await new Promise(resolve => setTimeout(resolve, 120));
    if (window.__failSave) throw new Error('Salvataggio di prova rifiutato');
    return { ...row, id: 99 };
  } };
  const book = async row => {
    setSaving(true);
    try { const saved = await persistPatientAgendaBooking({ appointment: row, db, agendaSettings: settings, today: '2026-10-21' }); setAppointments(prev => [...prev, saved]); setRequest(null); }
    finally { setSaving(false); }
  };
  return <div className="app-shell--mobile" style={{ display: 'flex', height: '100dvh', flexDirection: 'column', background: '#f8fafc' }}>
    <main style={{ display: 'flex', flex: 1, minHeight: 0, padding: 6 }}><Agenda patients={[patient]} setPatients={() => {}} appointments={appointments} setAppointments={setAppointments} impegni={[]} appTypes={[{ id: 1, nome: 'Controllo', colore: '#2563eb' }]} si={{ studio_id: 'fixture-only', agenda_settings: settings }} features={{}} followUpRequest={request} onBookFollowUp={book} onCancelFollowUp={() => setRequest(null)} /></main>
    {createPortal(<PatientAgendaLayer patient={patient} minimized={!!request} saving={saving} onRestore={() => { if (!saving) setRequest(null); }}><PatientWorkspaceBoundary paz={patient} initTab="info" plans={[]} payments={[]} appointments={appointments} si={{}} features={{}} setPatients={() => {}} onNuovoAppuntamento={id => setRequest({ pazienteId: id })} onClose={() => { window.__closed = true; }} /></PatientAgendaLayer>, document.body)}
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
