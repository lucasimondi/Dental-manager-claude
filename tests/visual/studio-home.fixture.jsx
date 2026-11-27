// Synthetic-only fixture (HOME-STUDIO): the Studio Home with example data; no network writes.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/designTokens.css';
import StudioHome from '../../src/components/StudioHome.jsx';
import { today } from '../../src/lib/utils';
const t = today(); const tra = (g) => { const d = new Date(`${t}T12:00`); d.setDate(d.getDate() + g); return d.toISOString().slice(0, 10); };
if (new URLSearchParams(location.search).get('tema') === 'dark') document.documentElement.dataset.theme = 'dark';
window.studioTest = { vai: [], azioni: [] };
const NAV = [['paz', 'Pazienti'], ['paga', 'Incassi'], ['piani', 'Piani'], ['preventivi', 'Preventivi'], ['richiami', 'Richiami'], ['attivita', 'Attività'], ['spese', 'Spese'], ['controllo', 'Controllo'], ['listino', 'Listino'], ['wa', 'WhatsApp'], ['agenda', 'Agenda']].map(([id, l]) => ({ id, l }));
const patients = [{ id: 1, nome: 'Prova', cognome: 'Uno', telefono: '000' }, { id: 2, nome: 'Esempio', cognome: 'Due' }];
const appointments = [
  { id: 'a1', data: t, ora: '00:01', stato: 'confermato', pazienteId: 1, tipo: 'Visita' },
  { id: 'a2', data: t, ora: '23:58', stato: 'da confermare', pazienteId: 2, tipo: 'Igiene' },
  { id: 'a3', data: tra(2), ora: '10:00', stato: 'da confermare', pazienteId: 1 },
];
const richiami = [{ stato: 'da_fare', dataScadenza: tra(-5) }, { stato: 'da_fare', dataScadenza: tra(-1) }, { stato: 'da_fare', dataScadenza: t }];
const azione = (id) => () => window.studioTest.azioni.push(id);
createRoot(document.getElementById('root')).render(
  <div style={{ background: 'var(--pol-bg, #f4f6fa)', minHeight: '100vh', padding: '13px 15px 0', overflowX: 'hidden' }}>{/* come #app-scroll */}
    <StudioHome nav={NAV} patients={patients} appointments={appointments} richiami={richiami} plans={[]} payments={[]}
      managementControl={false} conSpese vai={(p) => window.studioTest.vai.push(p)} apriPaziente={(p) => window.studioTest.vai.push(`paziente-${p.id}`)}
      onImpostazioni={() => window.studioTest.vai.push('set')}
      azioni={{ appuntamento: azione('appuntamento'), appuntamentoPer: (p) => window.studioTest.azioni.push(`appuntamento-${p.id}`), paziente: azione('paziente'), ricetta: azione('ricetta'), preventivo: azione('preventivo'), incasso: azione('incasso'), spesa: azione('spesa'), acquisisci: azione('acquisisci') }} />
  </div>,
);
