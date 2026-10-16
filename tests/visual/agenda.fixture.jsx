// Isolated real components, synthetic data, all remote requests intercepted by the runner.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
const q = new URLSearchParams(location.search), mode = q.get('mode') || 'studio';
if (mode === 'personal') await import('../../personal/src/personal.css');
else { await import('../../src/styles.css'); await import('../../src/styles/designTokens.css'); await import('../../src/components/PremiumVisualSystem.css'); }
const { default: StudioDock } = await import('../../src/components/poliedron/PoliedronMobileDock.jsx');
const { IconaOggi, IconaDocumenti, IconaCalendario, IconaEuro, IconaPortafoglio, IconaChat, IconaPiu, IconaImpostazioni } = await import('../../personal/src/Icone.jsx');
const { default: Studio } = await import('../../src/components/Agenda.jsx');
const { GrigliaPoliedra } = await import('../../personal/src/AgendaGriglia.jsx');
const { PaginaEvento } = await import('../../personal/src/Agenda.jsx');
const { studioDb } = await import('../../personal/src/lib/studio.js');
studioDb.auth.getSession = async () => ({ data: { session: { user: { id: 'fixture-user', app_metadata: { studio_id: 'fixture-studio' } } } } });
const { ETICHETTE_PREDEFINITE } = await import('../../personal/src/lib/agenda.js');
const Baseline = mode === 'baseline' ? (await import(/* @vite-ignore */ '/src/components/__AgendaBaseline.jsx')).default : null;
const date = '2026-10-16';
const patients = [{ id: 1, nome: 'Paziente', cognome: 'Esempio' }, { id: 2, nome: 'Persona', cognome: 'Prova' }];
const data = { appuntamenti: [
  { id: 10, pazienteId: 1, data: date, ora: '09:00', durata: 90, tipo: 'Visita', colore: '#185FA5', cognome: 'Esempio', paziente: 'Paziente Esempio' },
  { id: 11, pazienteId: 2, data: date, ora: '09:30', durata: 60, tipo: 'Visita', colore: '#0F6E56', cognome: 'Prova', paziente: 'Persona Prova' },
], impegni: [{ id: 20, titolo: 'Riunione', tipo: 'personale', colore: '#64748b', data_inizio: date, data_fine: date, ora_inizio: '11:30', ora_fine: '12:30', tutto_il_giorno: false }], scadenze: [] };
function Fixture() {
  const [view, setView] = useState(q.get('agendaView') || 'settimana'), [day, setDay] = useState(date), [opened, setOpened] = useState(null);
  const [appointments, setAppointments] = useState(data.appuntamenti), [events, setEvents] = useState(data.impegni);
  const ctx = { apri: setOpened, esegui: async fn => { try { await fn(); } catch (e) { window.__saveError = e.message; } }, aggiorna: () => {}, mostra: text => { window.__message = text; }, impostazioni: { etichette: ETICHETTE_PREDEFINITE } };
  window.__state = { day, view, opened, appointments };
  const Component = Baseline || Studio;
  return <>
    {mode === 'personal' ? <div className="pp-app"><header className="pp-testata pp-testata-agenda"><span className="pp-testata-azioni"><button className="pp-icona-bottone" aria-label="Impostazioni"><IconaImpostazioni size={20} /></button></span></header><main className="pp-contenuto pp-contenuto-agenda"><GrigliaPoliedra view={view} setView={setView} giorno={day} setGiorno={setDay} dati={{ ...data, settings: q.has('configured') ? { oraInizio: 7, oraFine: 22, slotMin: 15, hiddenWeekdays: [0,6] } : {} }} ctx={ctx} etichette={ETICHETTE_PREDEFINITE} coloriTipi={{}} /></main>
      <nav className="pp-schede" aria-label="Sezioni">{[['oggi','Oggi',IconaOggi],['documenti','Documenti',IconaDocumenti],['agenda','Agenda',IconaCalendario],['conti','Conti',IconaEuro],['personali','Personali',IconaPortafoglio]].map(([id,label,Icon]) => <button key={id} className={`pp-scheda${id === 'agenda' ? ' attiva' : ''}`}><Icon size={22} /><span>{label}</span></button>)}<button className="pp-scheda pp-scheda-poliedron" aria-label="Apri Poliedron"><IconaChat size={23} /><span>Poliedron</span></button></nav><button className="pp-fab" aria-label="Aggiungi" onClick={() => setOpened({ tipo: 'evento', evento: {} })}><IconaPiu size={26} /></button></div>
    : <div className="app-shell--mobile" style={{ display: 'flex', flexDirection: 'column', background: '#F7F8FA' }}><div className="app-main"><div id="app-scroll" style={{ display: 'flex', flexDirection: 'column', padding: '0 6px', overflow: 'hidden' }}><Component patients={patients} setPatients={() => {}} appointments={appointments} setAppointments={setAppointments} appTypes={[{ nome: 'Visita', colore: '#185FA5' }]} features={{}} impegni={events.map(e => ({ ...e, dataInizio: e.data_inizio, dataFine: e.data_fine, oraInizio: e.ora_inizio, oraFine: e.ora_fine, tuttoIlGiorno: e.tutto_il_giorno }))} setImpegni={setEvents} si={{ studio_id: 'fixture-studio', agenda_settings: q.has('configured') ? { oraInizio: 7, oraFine: 22, slotMin: 15, hiddenWeekdays: [0,6] } : {} }} setStudioInfo={() => {}} /></div></div><StudioDock page="agenda" setPage={() => {}} open={false} onToggle={() => {}} panelId="fixture-panel" positionLocked /></div>}
    {opened && <div data-testid="opened" style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'white', overflow: 'auto', padding: 16 }}><button onClick={() => setOpened(null)}>Chiudi</button>{opened.tipo === 'evento' ? <PaginaEvento evento={opened.evento} ctx={ctx} chiudi={() => setOpened(null)} /> : <p>Appuntamento dello studio — sola lettura</p>}</div>}
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
