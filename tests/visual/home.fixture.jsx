import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from '../../src/components/Dashboard.jsx';
import '../../src/styles.css';
import '../../src/styles/designTokens.css';
import '../../src/components/PremiumVisualSystem.css';

// HOME-AGENDA-CENTRIC — dati interamente sintetici, nessun dato reale.
const params = new URLSearchParams(location.search);
if (params.get('theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
const day = '2026-11-06';
const names = [['Anna','Ferri'],['Maria','Rossa'],['Sara','Colli'],['Paolo','Ricca'],['Luca','Bianco'],['Marco','Esposto'],['Elena','Romani'],['Giulio','Rossa']];
const patients = names.map(([nome, cognome], i) => ({ id: i + 1, nome, cognome, telefono: '3330000000' }));
const rows = params.has('empty') ? [] : [
  [1,'09:00',45,'Igiene'],[2,'10:15',60,'Chirurgia'],[3,'11:30',30,'Prima visita'],[4,'12:15',45,'Endodonzia'],
  [5,'08:30',45,'Controllo'],[6,'09:30',60,'Protesi'],[7,'11:00',20,'Controllo'],[8,'12:00',40,'Igiene'],[1,'15:00',30,'Controllo'],
];
const appointments = rows.map(([pazienteId, ora, durata, tipo], i) => ({ id: 100 + i, pazienteId, data: day, ora, durata, tipo, stato: 'confermato' }));
const appTypes = [
  { id: 1, nome: 'Igiene', colore: '#14B8A6' }, { id: 2, nome: 'Chirurgia', colore: '#2563EB' }, { id: 3, nome: 'Prima visita', colore: '#6366F1' },
  { id: 4, nome: 'Endodonzia', colore: '#F59E0B' }, { id: 5, nome: 'Controllo', colore: '#0EA5E9' }, { id: 6, nome: 'Protesi', colore: '#EC4899' },
];
const richiami = [{ id: 1, pazienteId: 1, categoria: 'igiene', motivo: 'Igiene semestrale', data_scadenza: '2026-10-30', stato: 'aperto' }];

function Fixture() {
  const [apps, setApps] = useState(appointments);
  window.__actions = window.__actions || [];
  return (
    <div className="app-shell app-shell--desktop" style={{ display: 'flex', height: '100dvh' }}>
      <div id="app-scroll" style={{ flex: 1, overflowY: 'auto', padding: 13 }}>
        <Dashboard patients={patients} setPatients={() => {}} appointments={apps} setAppointments={setApps} payments={[]} plans={[]} richiami={richiami}
          appTypes={appTypes} onOpenPaz={(p, tab) => window.__actions.push(['paz', p.id, tab])} onGoAgenda={() => window.__actions.push(['agenda'])}
          onGoRichiami={() => window.__actions.push(['richiami'])} onNavigate={(p) => window.__actions.push(['nav', p])} onNavigateNew={() => {}}
          templates={[]} userName="Dott. Test" si={{ nome: 'Studio di prova', vertical: 'dentistico' }} features={{}} studioId="synthetic-studio" currentUserId="synthetic-user"
          isStudioAdmin studioMembership={{ capabilities: [] }} onLogout={() => {}}
          onPatientAction={(p, a, action) => window.__actions.push(['action', p.id, a.id, action])}
          onOpenSearch={() => window.__actions.push(['search'])} />
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')).render(<Fixture />);
