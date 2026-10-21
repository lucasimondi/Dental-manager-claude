import { validatePatientAgendaSlot } from '../lib/patientAgendaBooking.js';
import DayEvents from '../../shared/agenda/DayEvents.jsx';
import { useTimeline } from '../../shared/agenda/useTimeline.js';
import AgendaVisibility from '../../shared/agenda/AgendaVisibility.jsx';
import { agendaVisible, keepOccupiedWeekends } from '../../shared/agenda/visibility.js';
import { layoutAgendaDay, layoutAppointments as layoutOverlap } from '../../shared/agenda/geometry.js';
import { readAgendaLocation } from '../../shared/agenda/navigation.js';
import { DayStrip, ViewPicker, TimeGrid, MonthCalendar, EventBlock, AppointmentBlock, useSlotHeight, AgendaSwitch, MonthDetailCard, MonthDateLabel, MonthToolbar, CalendarEmptyState, useGridSwipe } from '../../shared/agenda/AgendaPresentation.jsx';
import { createPortal } from 'react-dom';
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Bdg, Ic, PhStr, TimePicker, SelettorePaziente, EmptyState, PageHeader } from './ui';
import WaAction, { apriWaDiretto, waAbilitato } from './ui/WaAction.jsx';
import { pianificaInvioWABatch, annullaInvioWABatch } from '../lib/waBatchSender.js';
import { C, uid, fmtD, today, getAppTypesDefault, DEF_AGENDA_SETTINGS, VERTICALI_CON_RICETTA } from '../lib/utils';
import { useIsMobile } from '../lib/useIsMobile';
import { salvaPosizione, leggiPosizione } from '../lib/posizioneNavigazione';
import { useFormPersistente } from '../lib/useFormPersistente';
import { supabase } from '../lib/supabase.js';
import { getVisibleWeekDays, agendaHiddenWeekdays as computeHiddenWeekdays, weekendsHiddenState } from '../lib/agendaVisibleDays.js';
import { MOBILE_DOCK_BOTTOM, MOBILE_DOCK_HEIGHT } from '../lib/poliedron/poliedronMobileDock.js';
import { normalizePhoneForTel, APPOINTMENT_PATIENT_ACTIONS } from '../lib/appointmentQuickHub.js';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const toISO = (d) => d.toISOString().slice(0, 10);
const MOBILE_APPOINTMENT_MENU_DOCK_OFFSET = MOBILE_DOCK_BOTTOM + MOBILE_DOCK_HEIGHT;
const MOBILE_AGENDA_FAB_GAP_ABOVE_DOCK = 14;
const MOBILE_AGENDA_FAB_BOTTOM = MOBILE_APPOINTMENT_MENU_DOCK_OFFSET + MOBILE_AGENDA_FAB_GAP_ABOVE_DOCK;
const MOBILE_AGENDA_FAB_SIZE = 54;
const MOBILE_APPOINTMENT_MENU_FAB_OFFSET = MOBILE_AGENDA_FAB_BOTTOM + MOBILE_AGENDA_FAB_SIZE;
const orarioInMinutiUI = (ora) => {
  const [h, m] = (ora || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const TIPO_IMPEGNO = [
  { id: 'personale', label: 'Personale', colore: '#64748b' },
  { id: 'ferie', label: 'Ferie', colore: '#f59e0b' },
  { id: 'chiamata', label: 'Chiamata', colore: '#8b5cf6' },
  { id: 'altro', label: 'Altro', colore: '#6b7280' },
];
const ETICHETTE_SUGGERITE = [
  { titolo: 'Ferie', tipo: 'ferie' },
  { titolo: 'Malattia', tipo: 'personale' },
  { titolo: 'Corso/Formazione', tipo: 'altro' },
  { titolo: 'Riunione', tipo: 'chiamata' },
  { titolo: 'Chiamata', tipo: 'chiamata' },
  { titolo: 'Impegno privato', tipo: 'personale' },
  { titolo: 'Congresso', tipo: 'altro' },
];
const RIPETI_OPZIONI = [
  { id: 'no', label: 'Non si ripete', giorni: 0 },
  { id: 'giornaliera', label: 'Ogni giorno', giorni: 1 },
  { id: 'settimanale', label: 'Ogni settimana', giorni: 7 },
  { id: 'due_settimane', label: 'Ogni 2 settimane', giorni: 14 },
];
// Calcola per ogni appuntamento del giorno la colonna e il numero totale di colonne
// del suo "cluster" di sovrapposizione temporale, così quelli che si sovrappongono
// (tipicamente operatori/poltrone diversi alla stessa ora, con filtro "Tutti" attivo)
// si affiancano invece di disegnarsi uno sopra l'altro nascondendosi a vicenda.


const startOfWeek = (d) => {
  const dt = new Date(d + 'T12:00');
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  return dt;
};

function AppointmentMenuLayer({ portal, children }) {
  return portal ? createPortal(children, document.body) : children;
}

function GridView({ days, slots, slotH, slotMin, oraInizio, appointments, setAppointments, patients, getColore, getOperatore, getPoltrona, apriNuovo, apriEdit, apriWA, apriMail, apriSposta, delApp, selDay, setSelDay, setView, today: t, features, impegni, apriEditImpegno, onSwipeDay, selModeWA, selAppIds, toggleSelApp, isMobile, oraColW, onOpenPatient, onPatientAction, renderAppointmentWorkspace, onOpenRecall, onOpenActivity, onPoliedronCommand, mobileOverlayHeight, followUpMode, onOccupiedSlot, canPrescribe = true }) {
  const containerRef = useRef(null); // unico scroll container
  const resizeRef = useRef(null);
  const [now, setNow] = useState(new Date());
  const [resizing, setResizing] = useState(null); // { id, startY, startDurata }
  const [moving, setMoving] = useState(null); // { id, startY, startOra }
  const movedRef = useRef(false); // distingue click da drag: true se il mouse si e' spostato oltre la soglia
  const [menuApp, setMenuApp] = useState(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false); // appuntamento con menu contestuale aperto (WA/Mail/Modifica/Sposta/Elimina)
  const [poliedronQuery, setPoliedronQuery] = useState('');
  const [poliedronSubmitting, setPoliedronSubmitting] = useState(false);
  const isSettimana = days.length > 1;

  useEffect(() => {
    setPoliedronQuery('');
    setPoliedronSubmitting(false);
  }, [menuApp?.id]);

  // POL-UI-010 (slot fit): su mobile lo slotH "base" (calcolato dal genitore
  // su una stima approssimativa di window.innerHeight) non riempie sempre
  // davvero lo spazio reale del contenitore scrollabile — che invece è
  // misurabile con precisione, perché containerRef è flex:1/min-height:0
  // dentro overflow:auto (vedi commento più sotto): la sua altezza dipende
  // SOLO dal layout dei genitori, mai dal contenuto scrollabile interno.
  // gridHeight è quindi la vera "availableGridHeight". Misurata con
  // ResizeObserver (robusta a resize/orientazione/tastiera virtuale), non
  // con window.innerHeight e sottrazioni indovinate. useLayoutEffect (non
  // useEffect) per leggerla/applicarla PRIMA del paint, evitando un flash
  // di slot troppo corti al primo render.
  const { effectiveSlotH, swipe } = useTimeline({ containerRef, mobile: isMobile, slots, slotH, day: selDay, view: isSettimana ? 'settimana' : 'giorno', nowMinutes: (now.getHours() * 60 + now.getMinutes() - oraInizio * 60) / slotMin, onNavigate: onSwipeDay, enabled: !resizing && !moving });

  const appPosition = (a) => {
    const [ah, am] = a.ora.split(':').map(Number);
    const min = ah * 60 + am - oraInizio * 60; // relativo all'inizio dell'intervallo visibile
    const top = (min / slotMin) * effectiveSlotH;
    const height = Math.max((Number(a.durata) / slotMin) * effectiveSlotH - 2, effectiveSlotH * 0.6);
    return { top, height };
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Resize mouse handlers
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      const dy = (e.clientY || e.touches?.[0]?.clientY || 0) - resizing.startY;
      const deltaMins = Math.round(dy / effectiveSlotH * slotMin / slotMin) * slotMin;
      const newDurata = Math.max(slotMin, resizing.startDurata + deltaMins);
      setAppointments(prev => prev.map(a => a.id === resizing.id ? { ...a, durata: newDurata } : a));
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [resizing, effectiveSlotH, slotMin]);

  // Move (drag) mouse handlers — sposta l'orario trascinando l'intero blocco appuntamento,
  // stesso pattern del resize ma cambia "ora" invece di "durata".
  useEffect(() => {
    if (!moving) return;
    const onMove = (e) => {
      const clientY = e.clientY || e.touches?.[0]?.clientY || 0;
      const dy = clientY - moving.startY;
      if (!movedRef.current && Math.abs(dy) < 6) return; // soglia minima prima di considerarlo un drag
      movedRef.current = true;
      const deltaSlots = Math.round(dy / effectiveSlotH);
      const deltaMin = deltaSlots * slotMin;
      const [oh, om] = moving.startOra.split(':').map(Number);
      let totMin = Math.max(0, oh * 60 + om + deltaMin);
      const newOra = `${String(Math.floor(totMin / 60)).padStart(2, '0')}:${String(totMin % 60).padStart(2, '0')}`;
      setAppointments(prev => prev.map(a => a.id === moving.id ? { ...a, ora: newOra } : a));
    };
    const onUp = () => setMoving(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [moving, effectiveSlotH, slotMin]);

  // Swipe orizzontale sulla griglia: solo vista Giorno (days.length === 1), va al giorno
  // successivo/precedente. Ignorato se in corso un resize o uno spostamento di appuntamento,
  // per non entrare in conflitto con quei gesti.
  const { onTouchStartSwipe, onTouchEndSwipe } = useGridSwipe(days, onSwipeDay, resizing, moving);

  const nowMin = now.getHours() * 60 + now.getMinutes() - oraInizio * 60;
  const nowTop = (nowMin / slotMin) * effectiveSlotH;
  const showNowLine = nowMin >= 0 && nowMin <= slots.length * slotMin;

  // Mobile "final": la griglia stessa è la superficie principale (niente
  // grande card che la contiene) — bordo/raggio/ombra spariscono, resta solo
  // lo sfondo. Desktop/tablet mantengono il trattamento a card esistente.
  // POL-UI-007: su mobile anche lo sfondo sparisce (era rimasto C.sur pieno
  // per errore) — quel rettangolo bianco esteso fino quasi al dock era
  // esattamente la "barra" percepita dietro al dock, perché C.sur è diverso
  // dallo sfondo pagina (C.bg, ereditato da #app-scroll) e il confine tra i
  // due si vedeva proprio in fondo, a ridosso delle icone. Trasparente qui
  // lascia semplicemente vedere lo stesso sfondo pagina che usano Home e
  // tutte le altre schermate mobile — nessun'altra modifica alla griglia.
  return (
    <div {...(isMobile ? swipe : { onTouchStart: onTouchStartSwipe, onTouchEnd: onTouchEndSwipe })} style={{
      display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', background: C.sur,
      border: isMobile ? 'none' : `1px solid ${C.brd}`,
      borderRadius: isMobile ? 0 : 12,
      boxShadow: isMobile ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Contenitore della griglia — scrolla qui dentro, isolato dal resto della pagina.
            IMPORTANTE: ogni div con flex:1+overflow:auto in questa catena ha anche
            min-height:0 esplicito. Senza, su iOS Safari un elemento flex di default
            si allarga per contenere tutto il suo contenuto invece di rispettare lo
            spazio assegnato — e a quel punto è la PAGINA a scrollare per compensare,
            non l'elemento stesso. È il bug reale dietro lo scroll incoerente di prima:
            dipendeva da quanti appuntamenti/ore c'erano, non era mai stato casuale. */}
        <TimeGrid palette={C} containerRef={containerRef} isMobile={isMobile} slots={slots} slotH={slotH} effectiveSlotH={effectiveSlotH} oraColW={oraColW} days={days} today={t} showNowLine={showNowLine} nowTop={nowTop} selectionMode={selModeWA} onSlot={apriNuovo} renderDay={(ds) => {
          const dayApps = appointments.filter(a => a.data === ds).sort((a, b) => a.ora.localeCompare(b.ora));
          const dayImpOrari = (impegni || []).filter(imp => !imp.tuttoIlGiorno && imp.oraInizio && ds >= imp.dataInizio && ds <= imp.dataFine);
          const packed = layoutAgendaDay(dayApps, dayImpOrari);
          return <>                {packed.filter(x => x.a.agendaEvent).map(({ a, col, totalCols }) => {
                  const imp = a.agendaEvent;
                  const inizioMin = orarioInMinutiUI(imp.oraInizio) - oraInizio * 60;
                  const fineMin = orarioInMinutiUI(imp.oraFine || imp.oraInizio) - oraInizio * 60;
                  const top = (inizioMin / slotMin) * effectiveSlotH;
                  const height = Math.max(((fineMin - inizioMin) / slotMin) * effectiveSlotH, effectiveSlotH * 0.5);
                  if (top + height < 0 || top >= slots.length * effectiveSlotH) return null;
                  const co = imp.colore || TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.colore || C.pri;
                  return (
                    <EventBlock col={col} totalCols={totalCols} key={'imp-' + imp.id} title={imp.titolo} startTime={(imp.oraInizio || '').slice(0, 5)} description={imp.note || ''} aCapo={isSettimana} top={top} height={height} co={co} onClick={() => apriEditImpegno(imp)} />
                  );
                })}
                {packed.filter(x => !x.a.agendaEvent).map(({ a, col, totalCols }) => {
                  const { top, height } = appPosition(a);
                  if (top < 0 || top >= slots.length * effectiveSlotH) return null;
                  const p = patients.find(x => x.id === a.pazienteId);
                  const co = getColore(a);
                  const isBeingResized = resizing?.id === a.id;
                  const isBeingMoved = moving?.id === a.id;
                  const isSelezionabileWA = !!p?.telefono;
                  const isSelected = selAppIds?.includes(a.id);
                  const operatore = getOperatore ? getOperatore(a) : null;
                  const poltrona = getPoltrona ? getPoltrona(a) : null;
                  // Appuntamenti sovrapposti nello stesso slot (es. operatori diversi con filtro
                  // "Tutti" attivo) si affiancano in colonne invece di disegnarsi uno sopra
                  // l'altro, così restano tutti visibili e cliccabili.
                  return (
                    <AppointmentBlock touchScroll={isMobile} aCapo={isSettimana} key={a.id} a={a} label={p ? `${p.nome || ''} ${p.cognome || ''}`.trim() : '—'} co={co} top={top} height={height} col={col} totalCols={totalCols} isBeingResized={isBeingResized} isBeingMoved={isBeingMoved} selectionMode={selModeWA} selectable={isSelezionabileWA} selected={isSelected} operatore={operatore} poltrona={poltrona} selectionIndicator={<Ic n="ok" s={9} c="#fff" />}
                      onResizeMouse={e => { if (followUpMode) return; e.stopPropagation(); e.preventDefault(); setResizing({ id: a.id, startY: e.clientY, startDurata: Number(a.durata) }); }}
                      onMoveMouse={e => { if (followUpMode || selModeWA || isBeingResized) return; movedRef.current = false; setMoving({ id: a.id, startY: e.clientY, startOra: a.ora }); }}
                      onResizeTouch={e => { if (followUpMode) return; e.stopPropagation(); setResizing({ id: a.id, startY: e.touches[0].clientY, startDurata: Number(a.durata) }); }}
                      onMoveTouch={e => { if (followUpMode || selModeWA || isBeingResized) return; movedRef.current = false; setMoving({ id: a.id, startY: e.touches[0].clientY, startOra: a.ora }); }}
                      onOpen={e => {
                          e.stopPropagation();
                          if (followUpMode) { onOccupiedSlot?.(); return; }
                          if (selModeWA) { if (isSelezionabileWA) toggleSelApp(a.id); return; }
                          if (isBeingResized || movedRef.current) { movedRef.current = false; return; }
                          setMenuApp(a);
                        }}
                    />
                  );
                })}</>;
        }} />
      </div>
      {/* Menu contestuale appuntamento — si apre al tap (non al drag) su un blocco appuntamento */}
      {menuApp && (() => {
        const p = patients.find(x => x.id === menuApp.pazienteId);
        const co = getColore(menuApp);
        const phone = normalizePhoneForTel(p?.telefono);
        const runPatientAction = (action) => {
          if (!p || !action) return;
          setMenuApp(null);
          action(p, menuApp);
        };
        const submitPoliedron = () => {
          const command = poliedronQuery.trim();
          if (!command || !p || !onPoliedronCommand || poliedronSubmitting) return;
          setPoliedronSubmitting(true);
          setMenuApp(null);
          onPoliedronCommand({ command, patient: p, appointment: menuApp });
          setPoliedronQuery('');
          setPoliedronSubmitting(false);
        };
        const LegacyActions = renderAppointmentWorkspace && p ? 'details' : React.Fragment;
        const azioni = [
          { id: 'wa', label: 'WhatsApp', ic: 'wa', col: '#25D366', dis: !p?.telefono, onClick: () => { apriWA(menuApp); setMenuApp(null); } },
          { id: 'mail', label: 'Email', ic: 'mail', col: C.pri, dis: !p?.email, onClick: () => { apriMail(menuApp); setMenuApp(null); } },
          { id: 'edit', label: 'Modifica', ic: 'edit', col: C.txt, onClick: () => { apriEdit(menuApp); setMenuApp(null); } },
          { id: 'sposta', label: 'Sposta', ic: 'move', col: C.txt, onClick: () => { apriSposta(menuApp); setMenuApp(null); } },
          { id: 'del', label: 'Elimina', ic: 'del', col: C.dan, onClick: () => { setMenuApp(null); delApp(menuApp.id); } },
        ];
        return (
          <AppointmentMenuLayer portal={!!renderAppointmentWorkspace && !!p}>
          <div
            onClick={() => { if (!renderAppointmentWorkspace) setMenuApp(null); }}
            className="pol-modal-backdrop agenda-appointment-menu-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(10,20,40,0.55)',
              zIndex: 9999,
              display: 'flex',
              justifyContent: 'center',
              '--agenda-mobile-dock-offset': `${MOBILE_APPOINTMENT_MENU_DOCK_OFFSET}px`,
              '--agenda-mobile-fab-offset': `${MOBILE_APPOINTMENT_MENU_FAB_OFFSET}px`,
              '--agenda-mobile-overlay-clearance-menu': `${mobileOverlayHeight}px`,
            }}
          >
            <div onClick={e => e.stopPropagation()} role={renderAppointmentWorkspace && p ? "dialog" : undefined} aria-modal={renderAppointmentWorkspace && p ? true : undefined} aria-label={renderAppointmentWorkspace && p ? "Appuntamento" : undefined} className={`pol-modal-sheet agenda-appointment-menu-sheet${renderAppointmentWorkspace && p ? ' appointment-workspace-sheet' : ''}`} style={{ background: C.sur, width: '100%', maxWidth: renderAppointmentWorkspace && p ? 1040 : 480, overflow: 'hidden' }}>
              <div className="agenda-appointment-menu-header" style={{ padding: '14px 18px', borderBottom: `1px solid ${C.brd}`, display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: co, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : 'Paziente'}</div>
                  <div style={{ fontSize: 11.5, color: C.txm }}>{fmtD(menuApp.data)} · {menuApp.ora} · {menuApp.tipo}</div>
                </div>
                {renderAppointmentWorkspace && p && <button type="button" aria-label="Chiudi appuntamento" disabled={workspaceBusy} onClick={() => setMenuApp(null)} style={{ marginLeft: 'auto', minWidth: 44, minHeight: 44, border: 0, borderRadius: 10, cursor: 'pointer' }}>✕</button>}
              </div>
              <div className="agenda-appointment-menu-actions" style={{ padding: 8 }}>
                {renderAppointmentWorkspace && p ? renderAppointmentWorkspace(p, menuApp, () => setMenuApp(null), setWorkspaceBusy) : <>
                <div className="agenda-patient-actions" aria-label="Prestazioni e documenti del paziente" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, padding: 4, marginBottom: 8 }}>
                  {APPOINTMENT_PATIENT_ACTIONS.map(action => {
                    const disabled = !p || !onPatientAction || (action.id === 'prescription' && !canPrescribe);
                    return <button key={action.id} type="button" disabled={disabled} onClick={() => runPatientAction((patient, appointment) => onPatientAction(patient, appointment, action.id))} style={{ minHeight: 48, display: 'flex', alignItems: 'center', gap: 8, background: C.priL, color: C.pri, border: `1px solid ${C.brd}`, borderRadius: 10, padding: '10px 12px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}><Ic n={action.icon} s={17} c={C.pri} />{action.label}</button>;
                  })}
                </div>
                </>}
                <LegacyActions>
                {renderAppointmentWorkspace && p && <summary style={{ padding: 14, fontWeight: 700, cursor: 'pointer' }}>Altre azioni appuntamento</summary>}
                {isMobile && (
                  <>
                    <div className="agenda-quick-hub-grid">
                      <button
                        type="button"
                        disabled={!phone}
                        onClick={() => { if (phone) window.location.href = `tel:${phone}`; }}
                        className="agenda-quick-hub-action"
                      >
                        <Ic n="ph" s={17} c={phone ? C.pri : C.txl} />
                        <span>{phone ? 'Chiama' : 'Numero non disponibile'}</span>
                      </button>
                      <button type="button" disabled={!p || !onOpenPatient} onClick={() => runPatientAction(onOpenPatient)} className="agenda-quick-hub-action">
                        <Ic n="pz" s={17} c={C.pri} /><span>Scheda</span>
                      </button>
                      <button type="button" disabled={!p || !onOpenRecall} onClick={() => runPatientAction(onOpenRecall)} className="agenda-quick-hub-action">
                        <Ic n="bell" s={17} c={C.pur} /><span>Richiamo</span>
                      </button>
                      <button type="button" disabled={!p || !onOpenActivity} onClick={() => runPatientAction(onOpenActivity)} className="agenda-quick-hub-action">
                        <Ic n="ok" s={17} c={C.suc} /><span>Attività</span>
                      </button>
                    </div>
                    <form className="agenda-quick-hub-poliedron" onSubmit={(event) => { event.preventDefault(); submitPoliedron(); }}>
                      <div className="agenda-quick-hub-poliedron__label"><Ic n="spark" s={13} c={C.pri} />Poliedron</div>
                      <div className="agenda-quick-hub-poliedron__input-row">
                        <input
                          value={poliedronQuery}
                          onChange={(event) => setPoliedronQuery(event.target.value)}
                          onFocus={(event) => {
                            const input = event.currentTarget;
                            setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
                          }}
                          placeholder={`Cosa vuoi fare con ${p?.nome || 'il paziente'}?`}
                          aria-label="Comando contestuale per Poliedron"
                        />
                        <button type="submit" disabled={!poliedronQuery.trim() || !p || !onPoliedronCommand || poliedronSubmitting} aria-label="Invia a Poliedron">
                          <Ic n="send" s={15} c="#fff" />
                        </button>
                      </div>
                      {poliedronSubmitting && <div className="agenda-quick-hub-poliedron__loading">Poliedron sta elaborando…</div>}
                    </form>
                    <div className="agenda-quick-hub-divider">Appuntamento</div>
                  </>
                )}
                {azioni.map(az => (
                  <button
                    key={az.id}
                    disabled={az.dis}
                    onClick={az.onClick}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', background: 'none', border: 'none', borderRadius: 10, cursor: az.dis ? 'not-allowed' : 'pointer', opacity: az.dis ? 0.4 : 1, textAlign: 'left' }}
                    onMouseEnter={e => { if (!az.dis) e.currentTarget.style.background = C.bg; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Ic n={az.ic} s={18} c={az.col} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: az.id === 'del' ? C.dan : C.txt }}>{az.label}</span>
                    {az.dis && az.id === 'wa' && <span style={{ marginLeft: 'auto', fontSize: 10.5, color: C.txl }}>Nessun telefono</span>}
                    {az.dis && az.id === 'mail' && <span style={{ marginLeft: 'auto', fontSize: 10.5, color: C.txl }}>Nessuna email</span>}
                  </button>
                ))}
                </LegacyActions>
              </div>
              <div aria-hidden="true" className="agenda-appointment-menu-safe-area" style={{ height: 'env(safe-area-inset-bottom,12px)' }} />
            </div>
          </div>
          </AppointmentMenuLayer>
        );
      })()}
    </div>
  );
}

/* ── STRISCIA GIORNI/SETTIMANE stile iOS Calendar ──
   Mostra Lun–Dom, scrollabile in orizzontale a scatti di settimana (scroll-snap).
   Due modalità, secondo i prop passati:
   - Vista Giorno: lo scroll da solo NON cambia il giorno selezionato (come in iOS,
     serve solo a "sfogliare"); tocca un giorno per saltarci.
   - Vista Settimana: passando onWeekChange, anche lo SCROLL cambia la settimana
     visualizzata in agenda (la striscia guida direttamente il contenuto sotto).
   È un elemento statico (flexShrink: 0) fuori dal contenitore che scrolla verticalmente:
   resta sempre visibile, solo la griglia oraria sotto scorre. */
/* ── SELETTORE VISTA compatto ──
   Pillola "Giorno ▾" che apre un mini-menu per scegliere Giorno/Settimana/Mese.
   Va incollato sulla stessa riga dell'etichetta mese: non aggiunge nessuna riga
   in più, a differenza della vecchia barra a tre tab che occupava spazio prezioso
   sullo schermo del telefono. */
export default function Agenda({ patients, setPatients, appointments, setAppointments, appTypes, initPazienteId, onClearInitPaz, templates, features, impegni: tuttiImpegni = [], setImpegni, si, setStudioInfo, onOpenPatient, onPatientAction, renderAppointmentWorkspace, onOpenRecall, onOpenActivity, onPoliedronCommand, followUpRequest, onBookFollowUp, onCancelFollowUp }) {
  const [mostraEsclusi, setMostraEsclusi] = useState(false);
  const impegni = tuttiImpegni.filter(i => mostraEsclusi || agendaVisible(i, 'studio'));
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const labelPoltrona = isDentistico ? 'Poltrona' : 'Postazione';
  const labelPoltronePlurale = isDentistico ? 'poltrone' : 'postazioni';
  const tipiList = appTypes?.length ? appTypes : getAppTypesDefault(si?.vertical);
  const [followUpType, setFollowUpType] = useState(tipiList[0]?.nome || 'Visita');
  const [followUpDuration, setFollowUpDuration] = useState(si?.agenda_settings?.durataDefault || DEF_AGENDA_SETTINGS.durataDefault);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const followUpLock = useRef(false);
  useEffect(() => { if (followUpRequest) { setModal(false); setSelModeWA(false); setFabOpen(false); } }, [followUpRequest]);

  // Setup Agenda: le impostazioni sono condivise a livello di studio (studioInfo.agenda_settings),
  // così tutti i collaboratori vedono la stessa configurazione. localStorage resta solo come
  // valore iniziale offline-first prima che arrivi lo studioInfo dal server.
  const agSet = { ...DEF_AGENDA_SETTINGS, ...(si?.agenda_settings || {}) };
  const [oraInizio, setOraInizio] = useState(() => { try { return si?.agenda_settings?.oraInizio ?? Number(localStorage.getItem('ag_oraInizio') || DEF_AGENDA_SETTINGS.oraInizio); } catch { return DEF_AGENDA_SETTINGS.oraInizio; } });
  const [oraFine, setOraFine] = useState(() => { try { return si?.agenda_settings?.oraFine ?? Number(localStorage.getItem('ag_oraFine') || DEF_AGENDA_SETTINGS.oraFine); } catch { return DEF_AGENDA_SETTINGS.oraFine; } });
  const [slotMin, setSlotMin] = useState(() => { try { return si?.agenda_settings?.slotMin ?? Number(localStorage.getItem('ag_slotMin') || DEF_AGENDA_SETTINGS.slotMin); } catch { return DEF_AGENDA_SETTINGS.slotMin; } });
  const [zoom, setZoom] = useState(() => { try { return si?.agenda_settings?.zoom ?? (Number(localStorage.getItem('ag_zoom')) || DEF_AGENDA_SETTINGS.zoom); } catch { return DEF_AGENDA_SETTINGS.zoom; } });
  const [hiddenWeekdays, setHiddenWeekdays] = useState(() => si?.agenda_settings?.hiddenWeekdays || DEF_AGENDA_SETTINGS.hiddenWeekdays);
  // Scelta veloce della sola vista: non modifica le impostazioni condivise dello studio.
  // null = come configurato dallo studio; true/false = scelta esplicita dal selettore.
  const [weekendOverride, setWeekendOverride] = useState(null);
  const [view, setView] = useState(() => readAgendaLocation().view || 'settimana');
  const [selDay, setSelDay] = useState(() => readAgendaLocation().day || today());
  const [modal, setModal] = useState(false);

  // Ricorda se il modale "nuovo/modifica appuntamento" era aperto, così se
  // l'app si ricarica da zero (schermo spento, cambio app in multitasking)
  // lo ritroviamo aperto con il contenuto già scritto (il contenuto stesso
  // è persistito da useFormPersistente su "form", vedi sotto).
  useEffect(() => { salvaPosizione({ agendaModaleNuovo: modal }); }, [modal]);
  useEffect(() => {
    if (!followUpRequest && leggiPosizione()?.agendaModaleNuovo) setModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pazSearch, setPazSearch] = useState('');
  const [toast, setToast] = useState('');
  const [editApp, setEditApp] = useState(null);

  // Richieste di prenotazione arrivate dalla pagina pubblica (nessuna
  // integrazione live con gli slot: sono solo richieste da rivedere a mano
  // e trasformare in appuntamento vero, o rifiutare).
  const [richieste, setRichieste] = useState([]);
  const [richiesteAperte, setRichiesteAperte] = useState(false);
  const [richiestaInGestione, setRichiestaInGestione] = useState(null); // id della richiesta che si sta trasformando in appuntamento
  const caricaRichieste = () => {
    supabase.from('richieste_prenotazione').select('*').eq('stato', 'nuova').order('created_at', { ascending: false })
      .then(({ data }) => setRichieste(data || []));
  };
  useEffect(() => { caricaRichieste(); }, []);

  // Operatori/poltrone: caricati solo se la feature è attiva per lo studio —
  // un unico filtro qui evita query inutili per gli studi mono-agenda.
  const [operatori, setOperatori] = useState([]);
  const [filtroOperatore, setFiltroOperatore] = useState('tutti');
  const [poltrone, setPoltrone] = useState([]);
  const [filtroPoltrona, setFiltroPoltrona] = useState('tutti');
  useEffect(() => {
    if (!features?.multi_operatore || !si?.studio_id) return;
    supabase.from('operatori').select('*').eq('studio_id', si.studio_id).eq('attivo', true).order('created_at')
      .then(({ data }) => setOperatori(data || []));
    supabase.from('poltrone').select('*').eq('studio_id', si.studio_id).eq('attivo', true).order('created_at')
      .then(({ data }) => setPoltrone(data || []));
  }, [features?.multi_operatore, si?.studio_id]);

  const rifiutaRichiesta = async (id) => {
    await supabase.from('richieste_prenotazione').update({ stato: 'rifiutata' }).eq('id', id);
    setRichieste(prev => prev.filter(r => r.id !== id));
  };

  const confermaGestita = async (id) => {
    await supabase.from('richieste_prenotazione').update({ stato: 'gestita' }).eq('id', id);
    setRichieste(prev => prev.filter(r => r.id !== id));
  };

  // POL-WA-003b: conferma automatica al paziente per le richieste arrivate da WhatsApp.
  // Testo fisso composto dal server (whatsapp-webhook/invia), mai testo libero da qui.
  const inviaConfermaWhatsApp = async (richiesta, extra = {}) => {
    const { data, error } = await supabase.functions.invoke('whatsapp-webhook/invia', { body: { richiesta_id: richiesta.id, ...extra } });
    if (error || !data?.ok) setToast('Conferma WhatsApp non inviata: avvisa il paziente per telefono');
    else if (data.inviato) setToast('Conferma inviata al paziente su WhatsApp ✓');
    else setToast(`Conferma WhatsApp non inviata: ${data.errore || 'avvisa il paziente per telefono'}`);
  };
  const [fabOpen, setFabOpen] = useState(false);
  const [vd, setVd] = useState(() => new Date((readAgendaLocation().month || readAgendaLocation().day || today()) + 'T12:00'));
  // _editId: null = si sta creando un nuovo appuntamento, altrimenti è l'id
  // dell'appuntamento in modifica — persistito insieme al resto del form così
  // se l'app si ricarica da zero a metà modifica sappiamo quale riaprire
  // (vedi effetto di ripristino subito sotto).
  const [form, setForm, clearFormDraft] = useFormPersistente('nuovo_appuntamento', { pazienteId: '', data: today(), ora: '09:00', durata: agSet.durataDefault, tipo: tipiList[0]?.nome || 'Visita', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato', operatoreId: '', poltronaId: '', ripeti: 'nessuna', ripetiFino: '', _editId: null, visibileStudio: true, visibilePersonal: true });

  // Ricostruisce editApp da form._editId al primo caricamento: se l'app si
  // è ricaricata da zero mentre si stava modificando un appuntamento
  // esistente, form._editId è già stato ripristinato da useFormPersistente,
  // ma editApp no (non viene persistito, va ritrovato tra gli appuntamenti
  // già caricati). Una volta sola: non deve più intervenire dopo, altrimenti
  // sovrascriverebbe apriNuovo/apriEdit chiamati dall'utente in seguito.
  const editRestoredRef = useRef(false);
  useEffect(() => {
    if (editRestoredRef.current) return;
    if (form._editId == null) { editRestoredRef.current = true; return; }
    if (!appointments || appointments.length === 0) return;
    setEditApp(appointments.find(a => a.id === form._editId) || null);
    editRestoredRef.current = true;
  }, [appointments, form._editId]);

  const [waModal, setWaModal] = useState(null);
  const [waMsg, setWaMsg] = useState('');
  const [waTplId, setWaTplId] = useState('');
  const [selModeWA, setSelModeWA] = useState(false); // modalità selezione multipla per invio WhatsApp di massa
  const [selAppIds, setSelAppIds] = useState([]); // id appuntamenti selezionati in selModeWA
  const [waMassModal, setWaMassModal] = useState(false); // modal di composizione messaggio per l'invio di massa
  const [waMassTplId, setWaMassTplId] = useState('');
  const [waMassMsg, setWaMassMsg] = useState('Gentile {nome},\nricordiamo il suo appuntamento il {data} alle {ora} ({tipo}).\nGrazie!');
  // Invio WhatsApp di massa: una volta premuto "Invia a tutti" le aperture erano
  // già tutte pianificate e non c'era modo di fermarle. waBatch tiene lo stato
  // dell'invio in corso (totale/già aperti) per mostrare la barra con "Annulla
  // invio", che con clearTimeout blocca le aperture non ancora partite.
  const [waBatch, setWaBatch] = useState(null); // { totale, aperti } oppure null se nessun invio in corso
  const waBatchTimersRef = useRef([]);
  const [impModal, setImpModal] = useState(false);
  const [editImp, setEditImp] = useState(null);
  const [impForm, setImpForm] = useState({ titolo: '', tipo: 'personale', colore: '', dataInizio: today(), dataFine: today(), tuttoIlGiorno: true, oraInizio: '09:00', oraFine: '10:00', note: '', ripeti: 'no', ripetiFino: today(), visibileStudio: true, visibilePersonal: true });
  const IF = (f) => setImpForm((p) => ({ ...p, ...f }));

  const F = (f) => setForm(p => ({ ...p, ...f }));

  const gestisciRichiesta = (r) => {
    // POL-WA-003a: le richieste dell'assistente WhatsApp arrivano già col
    // paziente riconosciuto, l'orario scelto e, per spostamenti/disdette,
    // l'appuntamento da toccare: si apre direttamente quello in modifica.
    // Lo staff conferma salvando; al salvataggio la richiesta diventa "gestita".
    const appEsistente = r.appuntamento_id ? appointments.find((a) => String(a.id) === String(r.appuntamento_id)) : null;
    if ((r.tipo_richiesta === 'sposta' || r.tipo_richiesta === 'disdici') && appEsistente) {
      apriEdit(appEsistente);
      if (r.tipo_richiesta === 'sposta') F({ data: r.date_preferite?.[0] || appEsistente.data, ora: r.ora_preferita || appEsistente.ora });
      setRichiestaInGestione(r.id);
      setRichiesteAperte(false);
      return;
    }
    // Pre-compila il modale "nuovo appuntamento" con i dati del richiedente,
    // così lo studio deve solo scegliere data/ora esatte tra quelle indicate
    // e confermare — senza dover ricopiare a mano nome/telefono.
    setPazSearch(r.paziente_id ? '' : `${r.nome} ${r.cognome}`);
    F({
      pazienteId: r.paziente_id ? String(r.paziente_id) : '',
      note: [r.motivo, r.note].filter(Boolean).join(' — '),
      data: r.date_preferite?.[0] || today(),
      ...(r.ora_preferita ? { ora: r.ora_preferita } : {}),
    });
    setRichiestaInGestione(r.id);
    setModal(true);
    setRichiesteAperte(false);
  };

  useEffect(() => {
    if (initPazienteId) {
      setForm(f => ({ ...f, pazienteId: String(initPazienteId) }));
      setModal(true);
      if (onClearInitPaz) onClearInitPaz();
    }
  }, [initPazienteId]);

  const isMobile = useIsMobile();
  const overlayRef = useRef(null);
  const [mobileOverlayHeight, setMobileOverlayHeight] = useState(0);
  useLayoutEffect(() => {
    if (!isMobile || !overlayRef.current) {
      setMobileOverlayHeight(0);
      return undefined;
    }
    const overlay = overlayRef.current;
    const update = () => setMobileOverlayHeight(Math.ceil(overlay.getBoundingClientRect().height));
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(overlay);
    return () => observer.disconnect();
  }, [isMobile, view, selModeWA]);

  useEffect(() => {
    if (!si?.agenda_settings) return;
    setOraInizio(si.agenda_settings.oraInizio ?? DEF_AGENDA_SETTINGS.oraInizio);
    setOraFine(si.agenda_settings.oraFine ?? DEF_AGENDA_SETTINGS.oraFine);
    setSlotMin(si.agenda_settings.slotMin ?? DEF_AGENDA_SETTINGS.slotMin);
    setZoom(si.agenda_settings.zoom ?? DEF_AGENDA_SETTINGS.zoom);
    const configuredHidden = si.agenda_settings.hiddenWeekdays || DEF_AGENDA_SETTINGS.hiddenWeekdays;
    setHiddenWeekdays(configuredHidden);
  }, [si?.agenda_settings]);
  // availH reattivo: ricalcolato a ogni resize/orientazione, non solo al primo render.
  // Fornisce uno slot di base; su mobile il ResizeObserver di GridView misura poi
  // lo spazio effettivo del contenitore e adatta gli slot senza sottrazioni da dock.
  const [availH, setAvailH] = useState(() => (typeof window !== 'undefined' ? Math.max(360, window.innerHeight - 126) : 480));
  useEffect(() => {
    const chrome = 126; // controlli Agenda sopra la griglia, misurati empiricamente
    const recalc = () => setAvailH(Math.max(360, window.innerHeight - chrome));
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('orientationchange', recalc);
    return () => { window.removeEventListener('resize', recalc); window.removeEventListener('orientationchange', recalc); };
  }, []);
  // slotH calcolato per far stare l'intervallo scelto (oraInizio-oraFine) nello schermo, poi scalato dal fattore zoom
  const timelineStart = isMobile ? 0 : oraInizio;
  const timelineEnd = isMobile ? 24 : oraFine;
  const oreVisibili = Math.max(1, timelineEnd - timelineStart);
  const slotH = isMobile ? Math.round(Math.max(24, availH / (oreVisibili * 60 / slotMin) * zoom)) : Math.max(8, Math.round((availH / (oreVisibili * 60 / slotMin)) * zoom));
  // Griglia limitata all'intervallo oraInizio - oraFine scelto nelle impostazioni
  const slots = [];
  for (let h = timelineStart; h < timelineEnd; h++) {
    for (let m = 0; m < 60; m += slotMin) {
      slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  }

  const getColore = (a) => a.colore || tipiList.find(t => t.nome === a.tipo)?.colore || C.pri;

  const weekStart = startOfWeek(selDay);
  // La vista normale può mostrare/nascondere il fine settimana con il controllo rapido;
  // Settimana lavoro aggiunge i giorni del weekend occupati, senza cambiare la configurazione.
  // Finché non si tocca il selettore restano i giorni di chiusura configurati: uno studio
  // chiuso solo la domenica continua a vedere il sabato (e i suoi appuntamenti).
  const weekendsHidden = weekendsHiddenState({ configured: hiddenWeekdays, override: weekendOverride });

  const t = today();

  const bookFollowUpSlot = async (data, ora) => {
    if (followUpLock.current || !followUpRequest || !onBookFollowUp) return;
    try {
      const patient = patients.find(p => String(p.id) === String(followUpRequest.pazienteId));
      if (!patient) throw new Error('Paziente non disponibile. Riapri la scheda.');
      const tipo = tipiList.find(t => t.nome === followUpType.trim());
      const appointment = validatePatientAgendaSlot({
        appointment: { pazienteId: patient.id, data, ora, durata: followUpDuration, tipo: followUpType, colore: tipo?.colore || C.pri, stato: 'confermato', note: '', operatoreId: filtroOperatore !== 'tutti' ? Number(filtroOperatore) : null, poltronaId: filtroPoltrona !== 'tutti' ? Number(filtroPoltrona) : null, visibileStudio: true, visibilePersonal: true },
        appointments, impegni: tuttiImpegni, agendaSettings: { ...agSet, oraInizio, oraFine, slotMin }, today: today(),
      });
      setToast('');
      followUpLock.current = true;
      setFollowUpSaving(true);
      await onBookFollowUp(appointment);
    } catch (error) { setToast(error.message || 'Appuntamento non salvato. Riprova.'); }
    finally { followUpLock.current = false; setFollowUpSaving(false); }
  };
  const apriNuovo = (data, ora) => {
    if (followUpRequest) { if (data && ora) bookFollowUpSlot(data, ora); else setToast('Tocca uno spazio libero nella tua agenda.'); return; }
    setPazSearch('');
    setEditApp(null);
    setForm({ pazienteId: '', data: data || selDay, ora: ora || '09:00', durata: agSet.durataDefault, tipo: tipiList[0]?.nome || 'Visita', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato', operatoreId: filtroOperatore !== 'tutti' ? filtroOperatore : '', poltronaId: filtroPoltrona !== 'tutti' ? filtroPoltrona : '', ripeti: 'nessuna', ripetiFino: '', _editId: null, visibileStudio: true, visibilePersonal: true });
    setModal(true);
  };

  const apriEdit = (a) => {
    if (followUpRequest) { setToast('Questo spazio è occupato. Scegli un altro orario.'); return; }
    setEditApp(a);
    setPazSearch('');
    setForm({ pazienteId: String(a.pazienteId), data: a.data, ora: a.ora, durata: a.durata, tipo: a.tipo, colore: a.colore || C.pri, note: a.note || '', stato: a.stato || 'confermato', operatoreId: a.operatoreId ? String(a.operatoreId) : '', poltronaId: a.poltronaId ? String(a.poltronaId) : '', ripeti: 'nessuna', ripetiFino: '', _editId: a.id, visibileStudio: agendaVisible(a, 'studio'), visibilePersonal: agendaVisible(a, 'personal') });
    setModal(true);
  };

  const chiudiModalApp = () => { setModal(false); clearFormDraft(); };

  // Creazione rapida paziente dal form appuntamento: l'id locale viene generato
  // subito (stesso pattern usato ovunque nell'app) così il paziente è selezionabile
  // immediatamente nel campo, senza aspettare il salvataggio sul cloud.
  const limitePazienti = features?.max_pazienti ?? null;
  // POL-UI-042: setPatients (=setPatientsSync in App.jsx) salva il nuovo
  // paziente sul server in background e, appena risponde, sostituisce l'id
  // temporaneo generato qui con quello reale — silenziosamente, in un
  // useEffect più sotto. Se lo scambio avviene mentre l'utente sta ancora
  // compilando il resto dell'appuntamento (caso comune), form.pazienteId
  // resta puntato sul vecchio id temporaneo e SelettorePaziente non trova
  // più il paziente ("ti ritorna l'elenco scorrimento"). pendingQuickPatientRef
  // tiene traccia dell'ultimo paziente creato al volo per poterlo
  // ri-agganciare al suo id reale non appena compare in patients.
  const pendingQuickPatientRef = useRef(null);
  const creaPazienteRapido = (nome, cognome) => {
    if (!setPatients) return null;
    if (limitePazienti != null && patients.length >= limitePazienti) {
      setToast(`Hai raggiunto il limite di ${limitePazienti} pazienti del tuo piano.`);
      return null;
    }
    const id = uid();
    setPatients((p) => [...p, { nome, cognome, dataNascita: '', telefono: '', email: '', cf: '', indirizzo: '', cap: '', comune: '', provincia: '', opposizione_sts: false, note: '', id }]);
    setToast(`Paziente ${nome} ${cognome} creato ✓`);
    pendingQuickPatientRef.current = { tempId: String(id), nome, cognome };
    return id;
  };

  useEffect(() => {
    const pending = pendingQuickPatientRef.current;
    if (!pending) return;
    if (String(form.pazienteId) !== pending.tempId) { pendingQuickPatientRef.current = null; return; }
    if (patients.some((p) => String(p.id) === pending.tempId)) return;
    const reale = patients.find((p) => p.nome === pending.nome && p.cognome === pending.cognome);
    if (reale) {
      F({ pazienteId: String(reale.id) });
      pendingQuickPatientRef.current = null;
    }
  }, [patients]);

  // "Sposta" apre lo stesso editor di Modifica, ma serve come voce distinta nel menu contestuale
  // perché è lì che l'utente pensa di andare quando vuole cambiare data/ora/giorno di un appuntamento
  // (lo spostamento libero per lo stesso giorno resta comunque disponibile trascinando il blocco).
  const apriSposta = (a) => apriEdit(a);

  const apriMail = (a) => {
    const p = patients.find(x => x.id === a.pazienteId);
    if (!p?.email) { alert('Nessuna email per questo paziente'); return; }
    const oggetto = `Appuntamento del ${fmtD(a.data)}`;
    const corpo = `Gentile ${p.nome},\nricordiamo il suo appuntamento:\n${fmtD(a.data)} alle ${a.ora}\n${a.tipo}\nPer variazioni contattarci entro 24h. Grazie!`;
    window.open(`mailto:${p.email}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`, '_blank');
  };

  const apriWA = (a) => {
    const p = patients.find(x => x.id === a.pazienteId);
    if (!p?.telefono) { alert('Nessun telefono per questo paziente'); return; }
    const defMsg = `Gentile ${p.nome},\nricordiamo il suo appuntamento:\n📅 ${fmtD(a.data)} alle ${a.ora}\n📌 ${a.tipo}\nPer variazioni contattarci entro 24h. Grazie!`;
    setWaModal(a); setWaTplId(''); setWaMsg(defMsg);
  };

  const sendWA = () => {
    if (!waModal) return;
    const p = patients.find(x => x.id === waModal.pazienteId);
    if (!p?.telefono) return;
    apriWaDiretto(p.telefono, waMsg);
    setWaModal(null);
  };

  const selTplWA = (id) => {
    setWaTplId(id);
    if (!id || !waModal) return;
    const p = patients.find(x => x.id === waModal.pazienteId);
    const tpl = templates?.find(tt => String(tt.id) === String(id));
    if (tpl && p) setWaMsg(tpl.testo.replace(/{nome}/g, `${p.nome} ${p.cognome}`).replace(/{data}/g, fmtD(waModal.data)).replace(/{ora}/g, waModal.ora).replace(/{tipo}/g, waModal.tipo));
  };

  // ── Invio WhatsApp di massa: selezione multipla + composizione unica, poi apertura
  //    in sequenza di un link wa.me per ciascun paziente selezionato (con il proprio messaggio
  //    già compilato). Serve un piccolo ritardo tra un'apertura e l'altra perché i browser
  //    bloccano più popup aperti nello stesso istante da uno stesso click.
  const toggleSelApp = (id) => setSelAppIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selezionabiliWAMass = (lista) => lista.filter(a => patients.find(x => x.id === a.pazienteId)?.telefono);

  const selTplWAMass = (id) => {
    setWaMassTplId(id);
    const tpl = templates?.find(tt => String(tt.id) === String(id));
    if (tpl) setWaMassMsg(tpl.testo);
  };

  const inviaWAMassivo = () => {
    const selezionati = appointments.filter(a => selAppIds.includes(a.id));
    annullaInvioWABatch(waBatchTimersRef.current);
    waBatchTimersRef.current = pianificaInvioWABatch(selezionati, {
      apri: (a) => {
        const p = patients.find(x => x.id === a.pazienteId);
        if (!p?.telefono) return;
        const msg = waMassMsg
          .replace(/{nome}/g, `${p.nome} ${p.cognome}`)
          .replace(/{data}/g, fmtD(a.data)).replace(/{ora}/g, a.ora).replace(/{tipo}/g, a.tipo)
          .replace(/{totale}/g, '').replace(/{voci}/g, '');
        apriWaDiretto(p.telefono, msg);
      },
      onInviato: () => setWaBatch(prev => {
        if (!prev) return prev;
        const aperti = prev.aperti + 1;
        return aperti >= prev.totale ? null : { ...prev, aperti };
      }),
    });
    setWaBatch({ totale: selezionati.length, aperti: 0 });
    setWaMassModal(false);
    setSelModeWA(false);
    setSelAppIds([]);
  };

  // Ferma le aperture WhatsApp non ancora partite (quelle già aperte restano tali:
  // clearTimeout non può richiudere una finestra già aperta).
  const annullaWABatch = () => {
    annullaInvioWABatch(waBatchTimersRef.current);
    waBatchTimersRef.current = [];
    setWaBatch(prev => {
      if (prev) setToast(`Invio annullato: ${prev.aperti}/${prev.totale} già aperti`);
      return null;
    });
  };

  useEffect(() => () => annullaInvioWABatch(waBatchTimersRef.current), []);

  // Genera le date delle occorrenze ripetute (inclusa la prima), fino a ripetiFino incluso.
  // Limite di sicurezza a 104 occorrenze (~2 anni di settimanale) per evitare loop pericolosi
  // in caso di date immesse male.
  const generaDateRipetizione = (dataBase, tipo, dataFine) => {
    if (tipo === 'nessuna' || !dataFine || dataFine < dataBase) return [dataBase];
    const step = tipo === 'giornaliera' ? 1 : tipo === 'settimanale' ? 7 : null; // 'mensile' gestita a parte
    const out = [dataBase];
    let cur = new Date(dataBase + 'T12:00');
    let guard = 0;
    while (guard++ < 104) {
      if (tipo === 'mensile') cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate(), 12);
      else cur = new Date(cur.getTime() + step * 86400000);
      const ds = toISO(cur);
      if (ds > dataFine) break;
      out.push(ds);
    }
    return out;
  };

  const save = () => {
    if (!form.pazienteId) return;
    // form.operatoreId/poltronaId sono persistiti in localStorage (bozza) e possono
    // riferirsi a una risorsa nel frattempo eliminata o di un'altra sessione: se non
    // esiste più tra quelle attive caricate ora, la scartiamo silenziosamente invece
    // di mandare al DB un id non valido e far fallire il salvataggio dell'intero
    // appuntamento (il vincolo di coerenza studio lo rifiuterebbe).
    const operatoreId = form.operatoreId && operatori.some(o => String(o.id) === String(form.operatoreId)) ? Number(form.operatoreId) : null;
    const poltronaId = form.poltronaId && poltrone.some(p => String(p.id) === String(form.poltronaId)) ? Number(form.poltronaId) : null;
    if (editApp) {
      const { ripeti, ripetiFino, ...rest } = { ...form, visibileStudio: agendaVisible(form, 'studio'), visibilePersonal: agendaVisible(form, 'personal') };
      setAppointments(p => p.map(a => a.id === editApp.id ? { ...a, ...rest, pazienteId: Number(form.pazienteId), durata: Number(form.durata), operatoreId, poltronaId } : a));
      setToast('Aggiornato ✓');
    } else {
      const { ripeti, ripetiFino, ...rest } = { ...form, visibileStudio: agendaVisible(form, 'studio'), visibilePersonal: agendaVisible(form, 'personal') };
      const date = generaDateRipetizione(form.data, ripeti, ripetiFino);
      const nuovi = date.map((d) => ({ ...rest, data: d, id: uid() + Math.floor(Math.random() * 1000), pazienteId: Number(form.pazienteId), durata: Number(form.durata), operatoreId, poltronaId }));
      setAppointments(p => [...p, ...nuovi]);
      setToast(nuovi.length > 1 ? `${nuovi.length} appuntamenti creati ✓` : 'Salvato ✓');
    }
    // POL-WA-003b: la richiesta diventa "gestita" sia per un nuovo appuntamento sia
    // per uno spostamento/disdetta salvato sull'appuntamento esistente; se arrivava
    // da WhatsApp, parte la conferma al paziente con data e ora appena salvate.
    if (richiestaInGestione) {
      const richiesta = richieste.find((r) => r.id === richiestaInGestione);
      confermaGestita(richiestaInGestione);
      setRichiestaInGestione(null);
      if (richiesta?.origine === 'whatsapp' && (richiesta.tipo_richiesta !== 'disdici' || form.stato === 'annullato')) {
        inviaConfermaWhatsApp(richiesta, { data: form.data, ora: form.ora });
      }
    }
    clearFormDraft();
    setModal(false);
  };

  const del = (id) => { if (confirm('Eliminare?')) setAppointments(p => p.filter(a => a.id !== id)); };

  const apriNuovoImpegno = (data) => {
    setEditImp(null);
    setImpForm({ titolo: '', tipo: 'personale', colore: '', dataInizio: data || selDay, dataFine: data || selDay, tuttoIlGiorno: true, oraInizio: '09:00', oraFine: '10:00', note: '', ripeti: 'no', ripetiFino: data || selDay, visibileStudio: true, visibilePersonal: true });
    setImpModal(true);
  };

  const apriEditImpegno = (imp) => {
    if (followUpRequest) { setToast('Questo spazio è occupato da un impegno.'); return; }
    setEditImp(imp);
    setImpForm({
      titolo: imp.titolo, tipo: imp.tipo, colore: imp.colore || '', dataInizio: imp.dataInizio, dataFine: imp.dataFine,
      tuttoIlGiorno: imp.tuttoIlGiorno !== false, oraInizio: imp.oraInizio || '09:00', oraFine: imp.oraFine || '10:00', note: imp.note || '',
      ripeti: 'no', ripetiFino: imp.dataInizio,
      visibileStudio: agendaVisible(imp, 'studio'), visibilePersonal: agendaVisible(imp, 'personal'),
    });
    setImpModal(true);
  };

  const saveImpegno = () => {
    if (!impForm.titolo.trim()) return;
    const base = { titolo: impForm.titolo, tipo: impForm.tipo, colore: impForm.colore, tuttoIlGiorno: impForm.tuttoIlGiorno, note: impForm.note, visibileStudio: agendaVisible(impForm, 'studio'), visibilePersonal: agendaVisible(impForm, 'personal') };

    if (editImp) {
      const payload = impForm.tuttoIlGiorno
        ? { ...base, dataInizio: impForm.dataInizio, dataFine: impForm.dataFine, oraInizio: null, oraFine: null }
        : { ...base, dataInizio: impForm.dataInizio, dataFine: impForm.dataInizio, oraInizio: impForm.oraInizio, oraFine: impForm.oraFine };
      setImpegni(p => p.map(i => i.id === editImp.id ? { ...i, ...payload } : i));
      setToast('Aggiornato ✓');
      setImpModal(false);
      return;
    }

    if (impForm.tuttoIlGiorno) {
      if (impForm.dataFine < impForm.dataInizio) return;
      setImpegni(p => [...p, { ...base, dataInizio: impForm.dataInizio, dataFine: impForm.dataFine, oraInizio: null, oraFine: null, id: uid() }]);
      setToast('Salvato ✓');
      setImpModal(false);
      return;
    }

    // Impegno con orario specifico: opzionalmente ripetuto su piu' occorrenze,
    // ognuna un impegno indipendente (modificabile/eliminabile singolarmente).
    const passo = RIPETI_OPZIONI.find(r => r.id === impForm.ripeti)?.giorni || 0;
    const occorrenze = [];
    if (passo === 0) {
      occorrenze.push(impForm.dataInizio);
    } else {
      const fine = impForm.ripetiFino || impForm.dataInizio;
      let cursore = new Date(impForm.dataInizio + 'T12:00');
      const limite = new Date(fine + 'T12:00');
      let guardia = 0;
      while (cursore <= limite && guardia < 366) {
        occorrenze.push(toISO(cursore));
        cursore.setDate(cursore.getDate() + passo);
        guardia++;
      }
    }
    if (occorrenze.length === 0) return;
    // recurrence_id è uuid nel database (id invece è bigint).
    const recurrenceId = occorrenze.length > 1 ? crypto.randomUUID() : null;
    const nuovi = occorrenze.map(data => ({
      ...base, dataInizio: data, dataFine: data, oraInizio: impForm.oraInizio, oraFine: impForm.oraFine,
      recurrenceId, id: uid(),
    }));
    setImpegni(p => [...p, ...nuovi]);
    setToast(occorrenze.length > 1 ? `Creati ${occorrenze.length} impegni ✓` : 'Salvato ✓');
    setImpModal(false);
  };

  const delImpegno = () => {
    if (!editImp) return;
    if (!confirm('Eliminare questo impegno?')) return;
    setImpegni(p => p.filter(i => i.id !== editImp.id));
    setImpModal(false);
  };

  const navGiorno = (n) => { const d = new Date(selDay + 'T12:00'); d.setDate(d.getDate() + n); setSelDay(toISO(d)); };
  const navSettimana = (n) => { const d = new Date(selDay + 'T12:00'); d.setDate(d.getDate() + n * 7); setSelDay(toISO(d)); };
  const navMese = (n) => setVd(v => new Date(v.getFullYear(), v.getMonth() + n, 1));

  // Filtro operatore/poltrona: non tocca l'array condiviso "appointments" (usato
  // anche altrove, es. Richiami/Dashboard), agisce solo su cosa viene mostrato/
  // contato qui in Agenda. I due filtri si combinano in AND se entrambi impostati.
  const operatoriById = Object.fromEntries(operatori.map(o => [String(o.id), o]));
  const getOperatore = (a) => (a.operatoreId != null ? operatoriById[String(a.operatoreId)] : null);
  const poltroneById = Object.fromEntries(poltrone.map(p => [String(p.id), p]));
  const getPoltrona = (a) => (a.poltronaId != null ? poltroneById[String(a.poltronaId)] : null);
  // POL-AI-010: gli appuntamenti annullati non occupano più l'agenda (restano
  // nello storico del paziente; se non rifissati finiscono nei Richiami).
  const appointmentsAgenda = appointments.filter(a => a.stato !== 'annullato' && (mostraEsclusi || agendaVisible(a, 'studio')) && (!features?.multi_operatore || (
    (filtroOperatore === 'tutti' || String(a.operatoreId) === String(filtroOperatore)) &&
    (filtroPoltrona === 'tutti' || String(a.poltronaId) === String(filtroPoltrona))
  )));

  const agendaHiddenWeekdays = keepOccupiedWeekends(weekStart, computeHiddenWeekdays({ configured: hiddenWeekdays, view, override: weekendOverride }), appointmentsAgenda, impegni);
  const weekDays = getVisibleWeekDays(weekStart, agendaHiddenWeekdays);

  // Colonna orari compatta su mobile: deve restare identica tra DayStrip e
  // GridView (il commento su DayStrip spiega perché) — vedi item 5/2 della
  // spec "Agenda mobile final": non deve rubare spazio alle 7 colonne.
  const oraColW = isMobile ? 34 : 46;
  const gridProps = { slots, slotH, slotMin, oraInizio: timelineStart, appointments: appointmentsAgenda, setAppointments, patients, getColore, getOperatore, getPoltrona, apriNuovo, apriEdit, apriWA, apriMail, apriSposta, delApp: del, selDay, setSelDay, setView, today: t, impegni, apriEditImpegno, selModeWA, selAppIds, toggleSelApp, isMobile, oraColW, onOpenPatient, onPatientAction, renderAppointmentWorkspace, onOpenRecall, onOpenActivity, onPoliedronCommand, mobileOverlayHeight, canPrescribe: !si?.vertical || VERTICALI_CON_RICETTA.has(si.vertical), followUpMode: !!followUpRequest, onOccupiedSlot: () => setToast('Questo spazio è occupato. Scegli un altro orario.') };

  const ribbonDays = (view === 'giorno' ? [new Date(selDay + 'T12:00')] : weekDays).map(d => {
    const date = toISO(d);
    return { date, items: impegni.filter(i => (i.tuttoIlGiorno || !i.oraInizio) && date >= i.dataInizio && date <= (i.dataFine || i.dataInizio)).map(i => ({ id: i.id, title: i.titolo, color: i.colore || TIPO_IMPEGNO.find(t => t.id === i.tipo)?.colore, onOpen: () => apriEditImpegno(i) })) };
  });
  const dayEvents = <DayEvents days={ribbonDays} gutter={oraColW} />;
  // Appuntamenti effettivamente visibili nella vista corrente (per il conteggio "Seleziona tutti" e il badge)
  const giorniVisibili = view === 'giorno' ? [selDay] : (view === 'settimana' || view === 'settimana_lavoro') ? weekDays.map(toISO) : [];
  const appVisibili = appointmentsAgenda.filter(a => giorniVisibili.includes(a.data));
  const appVisibiliConTel = selezionabiliWAMass(appVisibili);

  // Campanella notifiche (richieste di prenotazione da gestire, ecc.): mostrata
  // in linea con il selettore vista invece che come banner a riga intera, perché
  // su mobile un banner tra l'header e la griglia rubava spazio verticale
  // prezioso ogni volta che c'erano richieste in sospeso, "rimpicciolendo"
  // l'agenda sotto. Il popup con l'elenco resta lo stesso (richiesteAperte).
  const notificheBell = richieste.length > 0 && (
    <button
      onClick={() => setRichiesteAperte(true)}
      aria-label={`${richieste.length} notifiche`}
      className="pol-icon-btn"
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', background: C.priL, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 2px rgba(15,23,42,.06), 0 4px 10px rgba(15,23,42,.08)' }}
    >
      <Ic n="bell" s={15} c={C.pri} />
      <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8, background: C.dan, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
        {richieste.length}
      </span>
    </button>
  );

  const haFiltriRisorse = features?.multi_operatore && (operatori.length > 0 || poltrone.length > 0);
  const filtroAttivo = filtroOperatore !== 'tutti' || filtroPoltrona !== 'tutti';
  const chipsRisorse = (
    <>
      {operatori.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: isMobile ? 'visible' : 'auto', flexWrap: isMobile ? 'wrap' : 'nowrap', paddingBottom: isMobile ? 0 : 2 }}>
          <button onClick={() => setFiltroOperatore('tutti')} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${filtroOperatore === 'tutti' ? C.pri : C.brd}`, background: filtroOperatore === 'tutti' ? C.priL : C.sur, color: filtroOperatore === 'tutti' ? C.pri : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Tutti</button>
          {operatori.map(o => (
            <button key={o.id} onClick={() => setFiltroOperatore(String(o.id))} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${filtroOperatore === String(o.id) ? o.colore : C.brd}`, background: filtroOperatore === String(o.id) ? o.colore + '18' : C.sur, color: filtroOperatore === String(o.id) ? o.colore : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: o.colore, flexShrink: 0 }} />
              {o.nome}
            </button>
          ))}
        </div>
      )}
      {poltrone.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: isMobile ? 0 : 8, overflowX: isMobile ? 'visible' : 'auto', flexWrap: isMobile ? 'wrap' : 'nowrap', paddingBottom: isMobile ? 0 : 2 }}>
          <button onClick={() => setFiltroPoltrona('tutti')} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${filtroPoltrona === 'tutti' ? C.pri : C.brd}`, background: filtroPoltrona === 'tutti' ? C.priL : C.sur, color: filtroPoltrona === 'tutti' ? C.pri : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Tutte le {labelPoltronePlurale}</button>
          {poltrone.map(p => (
            <button key={p.id} onClick={() => setFiltroPoltrona(String(p.id))} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${filtroPoltrona === String(p.id) ? p.colore : C.brd}`, background: filtroPoltrona === String(p.id) ? p.colore + '18' : C.sur, color: filtroPoltrona === String(p.id) ? p.colore : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: p.colore, flexShrink: 0 }} />
              {p.nome}
            </button>
          ))}
        </div>
      )}
    </>
  );

  // Su mobile i filtri operatore/poltrona non stanno più in righe fisse sopra la
  // griglia (rubavano spazio verticale esattamente come il banner notifiche):
  // diventano un bottone compatto in linea con campanella/selettore vista, che
  // apre le stesse chip dentro un popover. Su desktop restano le righe dirette,
  // più comode con lo spazio orizzontale disponibile.
  const [filtriAperti, setFiltriAperti] = useState(false);
  const filtroButton = haFiltriRisorse && (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setFiltriAperti(v => !v)}
        aria-label={`Filtra per operatore/${labelPoltrona.toLowerCase()}`}
        className="agenda-mobile-touch-target"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
      >
        <span className="pol-icon-btn" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', background: filtroAttivo ? C.priL : C.bg, boxShadow: '0 1px 2px rgba(15,23,42,.06), 0 4px 10px rgba(15,23,42,.08)', pointerEvents: 'none' }}>
          <Ic n="filter" s={13} c={filtroAttivo ? C.pri : C.txm} />
          {filtroAttivo && <span style={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: C.pri, border: `1.5px solid ${C.sur}` }} />}
        </span>
      </button>
      {filtriAperti && <div className="agenda-floating-interactive" onClick={() => setFiltriAperti(false)} style={{ position: 'fixed', inset: 0, zIndex: 34 }} />}
      {filtriAperti && (
        <div className="agenda-floating-interactive" style={{ position: 'absolute', top: 48, right: 0, background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 12, boxShadow: '0 8px 22px rgba(0,0,0,0.18)', width: 240, maxHeight: 320, overflowY: 'auto', padding: 10, zIndex: 35 }}>
          {chipsRisorse}
        </div>
      )}
    </div>
  );

  // Bottone WhatsApp compatto (mobile): l'idle button "Invia WhatsApp" a riga
  // intera restava lì sempre visibile, sottraendo spazio verticale alla griglia
  // esattamente come notifiche/filtri. La barra attiva di selezione (che appare
  // solo durante un invio in corso, transitoria) resta invece a riga intera.
  const waCompatta = !selModeWA && waAbilitato(features) && (view === 'giorno' || view === 'settimana' || view === 'settimana_lavoro') && (
    <button
      onClick={() => { setSelModeWA(true); setSelAppIds([]); }}
      disabled={appVisibiliConTel.length === 0}
      aria-label="Invia WhatsApp"
      className="agenda-mobile-touch-target"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, padding: 0, background: 'transparent', border: 'none', cursor: appVisibiliConTel.length === 0 ? 'not-allowed' : 'pointer', flexShrink: 0 }}
    >
      <span className="pol-icon-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', background: appVisibiliConTel.length === 0 ? C.bg : '#E6F9EE', boxShadow: appVisibiliConTel.length === 0 ? 'none' : '0 1px 2px rgba(15,23,42,.06), 0 4px 10px rgba(15,23,42,.08)', pointerEvents: 'none' }}>
        <Ic n="wa" s={14} c={appVisibiliConTel.length === 0 ? C.txl : '#128C7E'} />
      </span>
    </button>
  );

  const waSelectionToolbar = (
    <div className={isMobile ? 'agenda-mobile-selection-toolbar' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexShrink: 0 }}>
      {!selModeWA ? (
        <button
          onClick={() => { setSelModeWA(true); setSelAppIds([]); }}
          disabled={appVisibiliConTel.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: appVisibiliConTel.length === 0 ? C.bg : '#E6F9EE', border: 'none', borderRadius: 9, padding: '7px 12px', color: appVisibiliConTel.length === 0 ? C.txl : '#128C7E', fontWeight: 700, fontSize: 11.5, cursor: appVisibiliConTel.length === 0 ? 'not-allowed' : 'pointer' }}
        >
          <Ic n="wa" s={13} c={appVisibiliConTel.length === 0 ? C.txl : '#128C7E'} />
          Invia WhatsApp
        </button>
      ) : (
        <>
          <button
            onClick={() => setSelAppIds(selAppIds.length === appVisibiliConTel.length ? [] : appVisibiliConTel.map(a => a.id))}
            style={{ background: C.bg, border: `1.5px solid ${C.brd}`, borderRadius: 9, padding: '7px 11px', color: C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
          >
            {selAppIds.length === appVisibiliConTel.length ? 'Deseleziona tutti' : `Seleziona tutti (${appVisibiliConTel.length})`}
          </button>
          <div style={{ flex: 1, fontSize: 11.5, color: C.txm, fontWeight: 700 }}>{selAppIds.length} selezionat{selAppIds.length === 1 ? 'o' : 'i'}</div>
          <button
            onClick={() => { setSelModeWA(false); setSelAppIds([]); }}
            style={{ background: 'none', border: 'none', color: C.txl, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: '7px 8px' }}
          >
            Annulla
          </button>
          <button
            onClick={() => setWaMassModal(true)}
            disabled={selAppIds.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: selAppIds.length === 0 ? C.bg : '#25D366', border: 'none', borderRadius: 9, padding: '7px 12px', color: selAppIds.length === 0 ? C.txl : '#fff', fontWeight: 700, fontSize: 11.5, cursor: selAppIds.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Ic n="send" s={12} c={selAppIds.length === 0 ? C.txl : '#fff'} />
            Invia ({selAppIds.length})
          </button>
        </>
      )}
    </div>
  );

  const followUpControls = followUpRequest && <div className="patient-agenda-booking" style={{ padding: '8px 10px', background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 12, margin: '6px 0', flexShrink: 0 }}>
    <div style={{ fontSize: 12, color: C.pri, fontWeight: 700, marginBottom: 6 }}>{followUpSaving ? 'Salvataggio appuntamento…' : 'Prossimo appuntamento · tocca uno spazio libero'}</div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
      <label style={{ flex: '1 1 130px', fontSize: 12 }}>Prestazione<Inp aria-label="Prossima prestazione" value={followUpType} onChange={e => setFollowUpType(e.target.value)} disabled={followUpSaving} /></label>
      <label style={{ flex: '0 1 90px', fontSize: 12 }}>Minuti<Inp aria-label="Durata prossimo appuntamento" type="number" min={slotMin} step={slotMin} value={followUpDuration} onChange={e => setFollowUpDuration(e.target.value)} disabled={followUpSaving} /></label>
      <button type="button" onClick={onCancelFollowUp} disabled={followUpSaving} style={{ minHeight: 44, border: `1px solid ${C.brd}`, borderRadius: 8, background: C.bg, color: C.pri, padding: '8px 10px' }}>Riapri scheda</button>
    </div>
  </div>;

  return (
    // POL-UI-010 (structural): on mobile, #app-scroll is now itself a column
    // flex container for this page (App.jsx), so this root uses flex:1 —
    // pure flexbox sizing, not a percentage height, all the way down. On
    // desktop #app-scroll is unchanged (not flex), so height:'100%' stays
    // exactly as before — no desktop behavior change.
    <div
      className={isMobile ? 'agenda-mobile-page' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...(isMobile
          ? { flex: 1, position: 'relative', '--agenda-mobile-overlay-clearance': `${mobileOverlayHeight}px` }
          : { height: '100%', position: 'relative' }),
      }}
    >
      <AgendaSwitch target="personal" day={selDay} month={toISO(vd)} view={view} />
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* Barra invio WhatsApp di massa in corso — resta finché non sono partite tutte
          le aperture pianificate, con un bottone per fermare quelle non ancora avviate. */}
      {waBatch && (
        <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 3000, display: 'flex', alignItems: 'center', gap: 10, background: C.priD, color: '#fff', padding: '9px 10px 9px 16px', borderRadius: 28, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
          <span>Invio WhatsApp: {waBatch.aperti}/{waBatch.totale}</span>
          <button onClick={annullaWABatch} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, padding: '5px 12px', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Annulla invio</button>
        </div>
      )}

      {/* POL-UI-006: nessuna struttura superiore su mobile — la Home mobile
          (il riferimento strutturale per tutte le pagine) non ha più alcun
          header/brand-row in cima, quindi anche Agenda deve iniziare
          direttamente col contenuto funzionale (campanella/filtri/WA restano
          nella toolbar DayStrip subito sotto). Il logo torna solo nel dock
          mobile condiviso (pulsante centrale), non qui. Su desktop resta il
          PageHeader pieno, coerente con le altre pagine. */}
      {!isMobile && <PageHeader icon="cal" title="Agenda" />}
      {!isMobile && followUpControls}

      {haFiltriRisorse && !isMobile && chipsRisorse}

      {view === 'giorno' && (
        <DayStrip palette={C} selDay={selDay} setSelDay={setSelDay} today={t} compact={isMobile} oraColW={oraColW} singleDay={isMobile} hiddenWeekdays={agendaHiddenWeekdays} shortMonth={isMobile} overlayRef={isMobile ? overlayRef : undefined} floatingFooter={<>{isMobile && followUpControls}{dayEvents}{isMobile && selModeWA && waAbilitato(features) ? waSelectionToolbar : null}</>} viewPicker={<div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 8 }}>{notificheBell}{isMobile && filtroButton}{isMobile && waCompatta}<ViewPicker hiddenCount={tuttiImpegni.filter(i => !agendaVisible(i, 'studio')).length + appointments.filter(a => !agendaVisible(a, 'studio')).length} showHidden={mostraEsclusi} onToggleHidden={() => setMostraEsclusi(x => !x)} palette={C} view={view} setView={setView} touchSafe={isMobile} weekendsHidden={weekendsHidden || view === 'settimana_lavoro'} onToggleWeekends={() => setWeekendOverride(!weekendsHidden)} /></div>} />
      )}
      {(view === 'settimana' || view === 'settimana_lavoro') && (
        <DayStrip palette={C}
          selDay={selDay}
          setSelDay={(ds) => { setSelDay(ds); setView('giorno'); }}
          today={t}
          highlightSelected={false}
          onWeekChange={(wk) => { if (wk !== toISO(startOfWeek(selDay))) { const d = new Date(wk + 'T12:00'); d.setDate(d.getDate() + (new Date(selDay + 'T12:00').getDay() + 6) % 7); setSelDay(toISO(d)); } }}
          compact={isMobile}
          oraColW={oraColW}
          onPrevWeek={() => navSettimana(-1)}
          onNextWeek={() => navSettimana(1)}
          hiddenWeekdays={agendaHiddenWeekdays}
          shortMonth={isMobile}
          overlayRef={isMobile ? overlayRef : undefined}
          floatingFooter={<>{isMobile && followUpControls}{dayEvents}{isMobile && selModeWA && waAbilitato(features) ? waSelectionToolbar : null}</>}
          viewPicker={<div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 8 }}>{notificheBell}{isMobile && filtroButton}{isMobile && waCompatta}<ViewPicker hiddenCount={tuttiImpegni.filter(i => !agendaVisible(i, 'studio')).length + appointments.filter(a => !agendaVisible(a, 'studio')).length} showHidden={mostraEsclusi} onToggleHidden={() => setMostraEsclusi(x => !x)} palette={C} view={view} setView={setView} touchSafe={isMobile} weekendsHidden={weekendsHidden || view === 'settimana_lavoro'} onToggleWeekends={() => setWeekendOverride(!weekendsHidden)} /></div>}
        />
      )}
      {view === 'mese' && isMobile && (
        <MonthToolbar date={vd} overlayRef={overlayRef} floatingFooter={followUpControls}>
              {notificheBell}
              {filtroButton}
              <button onClick={() => setVd(new Date())} style={{ background: C.priL, border: 'none', borderRadius: 14, padding: '5px 10px', color: C.pri, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Oggi</button>
              <ViewPicker hiddenCount={tuttiImpegni.filter(i => !agendaVisible(i, 'studio')).length + appointments.filter(a => !agendaVisible(a, 'studio')).length} showHidden={mostraEsclusi} onToggleHidden={() => setMostraEsclusi(x => !x)} palette={C} view={view} setView={setView} touchSafe weekendsHidden={weekendsHidden || view === 'settimana_lavoro'} onToggleWeekends={() => setWeekendOverride(!weekendsHidden)} />
        </MonthToolbar>
      )}
      {view === 'mese' && !isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => navMese(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: C.txm }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 12 }}>{MESI[vd.getMonth()]} {vd.getFullYear()}</span>
            <button onClick={() => navMese(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: C.txm }}>›</button>
            {notificheBell}
            {isMobile && filtroButton}
            <button onClick={() => setVd(new Date())} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '4px 8px', color: C.pri, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Oggi</button>
          </div>
          <ViewPicker hiddenCount={tuttiImpegni.filter(i => !agendaVisible(i, 'studio')).length + appointments.filter(a => !agendaVisible(a, 'studio')).length} showHidden={mostraEsclusi} onToggleHidden={() => setMostraEsclusi(x => !x)} palette={C} view={view} setView={setView} weekendsHidden={weekendsHidden || view === 'settimana_lavoro'} onToggleWeekends={() => setWeekendOverride(!weekendsHidden)} />
        </div>
      )}

      {/* Toolbar invio WhatsApp di massa — solo vista Giorno/Settimana, dove ha senso "tutti gli appuntamenti visibili".
          Su mobile l'idle button è già in alto (icona compatta accanto al selettore vista): questa riga intera
          compare solo per la barra di selezione attiva (transitoria), non resta lì a occupare spazio in permanenza. */}
      {(view === 'giorno' || view === 'settimana' || view === 'settimana_lavoro') && waAbilitato(features) && !isMobile && waSelectionToolbar}

      {/* VIEWS */}
      {(view === 'giorno' || view === 'settimana' || view === 'settimana_lavoro') && (
        <div className={isMobile ? 'agenda-mobile-grid-surface' : undefined} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {view === 'giorno' && <GridView days={[new Date(selDay + 'T12:00')]} {...gridProps} onSwipeDay={navGiorno} features={features} />}
          {(view === 'settimana' || view === 'settimana_lavoro') && <GridView days={weekDays} {...gridProps} onSwipeDay={navSettimana} features={features} />}
        </div>
      )}
      {view === 'mese' && (() => {
        return (
          <div className={isMobile ? 'agenda-mobile-month-surface' : undefined}>
            <MonthCalendar palette={C} date={vd} selDay={selDay} today={t} onNavigate={navMese} onSelect={ds => { setSelDay(ds); setView('giorno'); }} daySummary={ds => ({ count: appointmentsAgenda.filter(a => a.data === ds).length, marks: (impegni || []).filter(imp => ds >= imp.dataInizio && ds <= imp.dataFine).map(imp => ({ ...imp, colore: imp.colore || TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.colore || C.pri })) })} />
            {(impegni || []).filter(imp => selDay >= imp.dataInizio && selDay <= imp.dataFine).map(imp => {
              const co = imp.colore || TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.colore || C.pri;
              return (
                <MonthDetailCard key={imp.id} palette={C} co={co} title={imp.titolo} badge={TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.label || imp.tipo} subtitle={<>{imp.tuttoIlGiorno ? 'Tutto il giorno' : `${(imp.oraInizio || '').slice(0,5)} – ${(imp.oraFine || '').slice(0,5)}`}{imp.dataInizio !== imp.dataFine ? ` · ${fmtD(imp.dataInizio)} – ${fmtD(imp.dataFine)}` : ''}</>} onClick={() => apriEditImpegno(imp)} />
              );
            })}
            <MonthDateLabel palette={C} day={selDay} />
            {appointmentsAgenda.filter(a => a.data === selDay).sort((a, b) => a.ora.localeCompare(b.ora)).map(a => {
              const p = patients.find(x => x.id === a.pazienteId);
              const co = getColore(a);
              return (
                <MonthDetailCard key={a.id} palette={C} co={co} title={p ? `${p.nome} ${p.cognome}` : '—'} subtitle={a.tipo} time={a.ora} duration={a.durata} onClick={() => apriEdit(a)} actions={<>                      <WaAction tel={p?.telefono} features={features} variant="icon" onClick={() => apriWA(a)} />
                      <button onClick={e => { e.stopPropagation(); del(a.id); }} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' }}><Ic n="del" s={13} c={C.dan} /></button></>} />
              );
            })}
            {appointmentsAgenda.filter(a => a.data === selDay).length === 0 && (
              <CalendarEmptyState palette={C} />
            )}
          </div>
        );
      })()}

      {/* MODAL WA */}
      {waModal && (
        <Modal title="Invia WhatsApp" icon="wa" iconColor="#25D366" onClose={() => setWaModal(null)}>
          {(() => { const p = patients.find(x => x.id === waModal.pazienteId); return (
            <div style={{ background: C.priL, borderRadius: 9, padding: '9px 12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p?.nome} {p?.cognome}</div>
              <div style={{ fontSize: 11, color: C.txm, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="cal" s={11} c={C.txm} />{fmtD(waModal.data)} · {waModal.ora} · {waModal.tipo}</div>
              {p?.telefono && <div style={{ fontSize: 11, color: C.txl, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="phone2" s={11} c={C.txl} />{p.telefono}</div>}
            </div>
          ); })()}
          {templates?.length > 0 && (
            <Fld label="Template (opzionale)">
              <Sel value={waTplId} onChange={e => selTplWA(e.target.value)}>
                <option value="">Messaggio personalizzato</option>
                {templates.map(tt => <option key={tt.id} value={tt.id}>{tt.nome}</option>)}
              </Sel>
            </Fld>
          )}
          <Fld label="Messaggio"><Txt value={waMsg} onChange={e => setWaMsg(e.target.value)} rows={6} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setWaModal(null)} full />
            <Btn ch="Apri WhatsApp" onClick={sendWA} dis={!waMsg} full />
          </div>
        </Modal>
      )}

      {/* MODAL WA MASSIVO — invio a più pazienti selezionati in agenda */}
      {waMassModal && (() => {
        const selezionati = appointments.filter(a => selAppIds.includes(a.id));
        return (
          <Modal title={`Invia a ${selezionati.length} pazient${selezionati.length === 1 ? 'e' : 'i'}`} icon="wa" iconColor="#25D366" onClose={() => setWaMassModal(false)}>
            <div style={{ background: C.priL, borderRadius: 9, padding: '9px 12px', marginBottom: 12, maxHeight: 130, overflowY: 'auto' }}>
              {selezionati.map(a => {
                const p = patients.find(x => x.id === a.pazienteId);
                return <div key={a.id} style={{ fontSize: 12, padding: '3px 0' }}>{p ? `${p.nome} ${p.cognome}` : '—'} <span style={{ color: C.txl }}>· {fmtD(a.data)} {a.ora}</span></div>;
              })}
            </div>
            {templates?.length > 0 && (
              <Fld label="Template (opzionale)">
                <Sel value={waMassTplId} onChange={e => selTplWAMass(e.target.value)}>
                  <option value="">Messaggio personalizzato</option>
                  {templates.map(tt => <option key={tt.id} value={tt.id}>{tt.nome}</option>)}
                </Sel>
              </Fld>
            )}
            <Fld label="Messaggio">
              <Txt value={waMassMsg} onChange={e => setWaMassMsg(e.target.value)} rows={6} />
            </Fld>
            <div style={{ fontSize: 10.5, color: C.txl, marginBottom: 8 }}>Segnaposto disponibili: {'{nome}'} {'{data}'} {'{ora}'} {'{tipo}'} — ogni paziente riceve il messaggio con i propri dati</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: `${C.war}1A`, borderRadius: 8, padding: '8px 10px', fontSize: 11, color: C.war, marginBottom: 8 }}>
              <Ic n="warn" s={13} c={C.war} />
              <span>Si apriranno {selezionati.length} finestre WhatsApp in sequenza, una per paziente: conferma l'invio in ciascuna.</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Btn ch="Annulla" v="sec" onClick={() => setWaMassModal(false)} full />
              <Btn ch={`Invia a tutti (${selezionati.length})`} onClick={inviaWAMassivo} dis={!waMassMsg || selezionati.length === 0} full />
            </div>
          </Modal>
        );
      })()}

      {/* MODAL NUOVO/MODIFICA */}
      {modal && (
        <Modal
          title={editApp ? 'Modifica appuntamento' : 'Nuovo appuntamento'} icon={editApp ? 'edit' : 'cal'} onClose={chiudiModalApp} wide mobileVariant="sheet"
          backdropClassName="agenda-appointment-form-backdrop" sheetClassName="agenda-appointment-form-sheet"
          backdropStyle={{
            '--agenda-mobile-overlay-clearance-form': `${mobileOverlayHeight}px`,
            '--agenda-mobile-dock-offset': `${MOBILE_APPOINTMENT_MENU_DOCK_OFFSET}px`,
            '--agenda-mobile-fab-offset': `${MOBILE_APPOINTMENT_MENU_FAB_OFFSET}px`,
          }}
        >
          <Fld label="Paziente">
            <SelettorePaziente
              patients={patients}
              value={form.pazienteId}
              onChange={(id) => F({ pazienteId: id })}
              search={pazSearch}
              onSearchChange={setPazSearch}
              autoFocus
              onCreaPaziente={setPatients ? creaPazienteRapido : undefined}
            />
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={form.data} onChange={e => F({ data: e.target.value })} /></Fld>
            <Fld label="Ora"><TimePicker value={form.ora} onChange={(v) => F({ ora: v })} label="Orario appuntamento" /></Fld>
            <Fld label="Durata">
              <Sel value={form.durata} onChange={e => F({ durata: e.target.value })}>
                {[15,30,45,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
              </Sel>
            </Fld>
            <Fld label="Stato">
              <Sel value={form.stato} onChange={e => F({ stato: e.target.value })}>
                <option value="confermato">Confermato</option>
                <option value="da confermare">Da confermare</option>
                <option value="annullato">Annullato</option>
              </Sel>
            </Fld>
          </div>
          <Fld label="Tipo visita">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {tipiList.map(tipo => (
                <button key={tipo.id} onClick={() => F({ tipo: tipo.nome, colore: tipo.colore })} style={{ padding: '5px 10px', borderRadius: 20, border: `1.5px solid ${form.tipo === tipo.nome ? tipo.colore : C.brd}`, background: form.tipo === tipo.nome ? tipo.colore + '18' : C.sur, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: tipo.colore }} />
                  <span style={{ fontSize: 11, fontWeight: form.tipo === tipo.nome ? 700 : 500, color: form.tipo === tipo.nome ? tipo.colore : C.txm }}>{tipo.nome}</span>
                </button>
              ))}
            </div>
            <Inp value={form.tipo} onChange={e => F({ tipo: e.target.value })} placeholder="Personalizza tipo visita" />
          </Fld>
          {features?.multi_operatore && (operatori.length > 0 || poltrone.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: operatori.length > 0 && poltrone.length > 0 ? '1fr 1fr' : '1fr', gap: 10 }}>
              {operatori.length > 0 && (
                <Fld label="Operatore">
                  <Sel value={form.operatoreId} onChange={e => F({ operatoreId: e.target.value })}>
                    <option value="">Nessuno</option>
                    {operatori.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </Sel>
                </Fld>
              )}
              {poltrone.length > 0 && (
                <Fld label={labelPoltrona}>
                  <Sel value={form.poltronaId} onChange={e => F({ poltronaId: e.target.value })}>
                    <option value="">Nessuna</option>
                    {poltrone.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </Sel>
                </Fld>
              )}
            </div>
          )}
          <AgendaVisibility value={form} onChange={flags => F({ visibileStudio: flags.visibile_studio, visibilePersonal: flags.visibile_personal })} />
          <Fld label="Note"><Txt value={form.note} onChange={e => F({ note: e.target.value })} /></Fld>
          {!editApp && (
            <Fld label="Ripeti">
              <Sel value={form.ripeti} onChange={e => F({ ripeti: e.target.value, ripetiFino: e.target.value === 'nessuna' ? '' : form.ripetiFino })}>
                <option value="nessuna">Non si ripete</option>
                <option value="giornaliera">Ogni giorno</option>
                <option value="settimanale">Ogni settimana</option>
                <option value="mensile">Ogni mese</option>
              </Sel>
              {form.ripeti !== 'nessuna' && (
                <div style={{ marginTop: 8 }}>
                  <Fld label="Ripeti fino al">
                    <Inp type="date" value={form.ripetiFino} min={form.data} onChange={e => F({ ripetiFino: e.target.value })} />
                  </Fld>
                  {form.ripetiFino && (
                    <div style={{ fontSize: 11, color: C.txm, marginTop: -4 }}>
                      Verranno creati {generaDateRipetizione(form.data, form.ripeti, form.ripetiFino).length} appuntamenti
                    </div>
                  )}
                </div>
              )}
            </Fld>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {editApp && <Btn ch="Elimina" v="dan" onClick={() => { del(editApp.id); clearFormDraft(); setModal(false); }} />}
            <Btn ch="Annulla" v="sec" onClick={chiudiModalApp} full />
            <Btn ch={editApp ? 'Aggiorna' : 'Salva'} onClick={save} dis={!form.pazienteId || (!editApp && form.ripeti !== 'nessuna' && !form.ripetiFino)} full />
          </div>
        </Modal>
      )}

      {/* MODAL IMPEGNO PERSONALE */}
      {impModal && (
        <Modal title={editImp ? 'Modifica impegno' : 'Nuovo impegno personale'} icon={editImp ? 'edit' : 'cal'} onClose={() => setImpModal(false)}>
          <Fld label="Titolo">
            <Inp value={impForm.titolo} onChange={e => IF({ titolo: e.target.value })} placeholder="Es. Ferie, Chiamata commercialista…" autoFocus />
          </Fld>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: -6, marginBottom: 12 }}>
            {ETICHETTE_SUGGERITE.map(et => (
              <button key={et.titolo} onClick={() => IF({ titolo: et.titolo, tipo: et.tipo })} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${C.brd}`, background: C.bg, cursor: 'pointer', fontSize: 10, fontWeight: 600, color: C.txm }}>
                {et.titolo}
              </button>
            ))}
          </div>
          <Fld label="Tipo / colore">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {TIPO_IMPEGNO.map(tp => (
                <button key={tp.id} onClick={() => IF({ tipo: tp.id, colore: '' })} style={{ padding: '5px 10px', borderRadius: 20, border: `1.5px solid ${impForm.tipo === tp.id && !impForm.colore ? tp.colore : C.brd}`, background: impForm.tipo === tp.id && !impForm.colore ? tp.colore + '18' : C.sur, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: tp.colore }} />
                  <span style={{ fontSize: 11, fontWeight: impForm.tipo === tp.id && !impForm.colore ? 700 : 500, color: impForm.tipo === tp.id && !impForm.colore ? tp.colore : C.txm }}>{tp.label}</span>
                </button>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 20, border: `1.5px solid ${impForm.colore ? impForm.colore : C.brd}`, background: impForm.colore ? impForm.colore + '18' : C.sur, cursor: 'pointer' }}>
                <input type="color" value={impForm.colore || TIPO_IMPEGNO.find(x => x.id === impForm.tipo)?.colore || C.pri} onChange={e => IF({ colore: e.target.value })} style={{ width: 16, height: 16, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: C.txm }}>Colore personalizzato</span>
              </label>
            </div>
          </Fld>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={impForm.tuttoIlGiorno} onChange={e => IF({ tuttoIlGiorno: e.target.checked })} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.txm }}>Tutto il giorno</span>
          </label>

          {impForm.tuttoIlGiorno ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Fld label="Dal"><Inp type="date" value={impForm.dataInizio} onChange={e => IF({ dataInizio: e.target.value, dataFine: e.target.value > impForm.dataFine ? e.target.value : impForm.dataFine })} /></Fld>
              <Fld label="Al"><Inp type="date" value={impForm.dataFine} onChange={e => IF({ dataFine: e.target.value })} /></Fld>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Fld label="Data"><Inp type="date" value={impForm.dataInizio} onChange={e => IF({ dataInizio: e.target.value, ripetiFino: e.target.value > impForm.ripetiFino ? e.target.value : impForm.ripetiFino })} /></Fld>
                <Fld label="Dalle"><TimePicker value={impForm.oraInizio} onChange={(v) => IF({ oraInizio: v })} label="Orario inizio" /></Fld>
                <Fld label="Alle"><TimePicker value={impForm.oraFine} onChange={(v) => IF({ oraFine: v })} label="Orario fine" /></Fld>
              </div>
              {!editImp && (
                <>
                  <Fld label="Ripeti">
                    <Sel value={impForm.ripeti} onChange={e => IF({ ripeti: e.target.value })}>
                      {RIPETI_OPZIONI.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </Sel>
                  </Fld>
                  {impForm.ripeti !== 'no' && (
                    <Fld label="Ripeti fino al"><Inp type="date" value={impForm.ripetiFino} onChange={e => IF({ ripetiFino: e.target.value })} /></Fld>
                  )}
                </>
              )}
            </>
          )}

          <AgendaVisibility value={impForm} onChange={flags => IF({ visibileStudio: flags.visibile_studio, visibilePersonal: flags.visibile_personal })} />
          <Fld label="Note (opzionale)"><Txt value={impForm.note} onChange={e => IF({ note: e.target.value })} /></Fld>
          {impForm.tuttoIlGiorno && impForm.dataFine < impForm.dataInizio && <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.danL, borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: C.dan, fontWeight: 700 }}><Ic n="warn" s={13} c={C.dan} />La data di fine deve essere uguale o successiva alla data di inizio</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {editImp && <Btn ch="Elimina" v="dan" onClick={delImpegno} />}
            <Btn ch="Annulla" v="sec" onClick={() => setImpModal(false)} full />
            <Btn ch={editImp ? 'Aggiorna' : 'Salva'} onClick={saveImpegno} dis={!impForm.titolo.trim() || (impForm.tuttoIlGiorno && impForm.dataFine < impForm.dataInizio)} full />
          </div>
        </Modal>
      )}

      {/* PULSANTE FLOTTANTE "Nuovo" — apre un piccolo popup per scegliere Appuntamento o Impegno,
          stile iOS. Su desktop resta dove sempre (basso sinistra). Su mobile
          (POL-UI-009) basso sinistra è ora occupato dal poliedro/menu: il
          FAB si sposta sopra di esso, sullo stesso bordo sinistro, senza
          sovrapposizioni. */}
      <div style={{
        position: 'fixed',
        left: isMobile ? 'max(18px, env(safe-area-inset-left, 0px))' : 16,
        bottom: isMobile ? `calc(${MOBILE_AGENDA_FAB_BOTTOM}px + env(safe-area-inset-bottom, 0px))` : 74,
        zIndex: 140,
      }}>
        {fabOpen && <div onClick={() => setFabOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: -1 }} />}
        {fabOpen && (
          <div style={{ position: 'absolute', bottom: 62, left: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <button onClick={() => { setFabOpen(false); apriNuovoImpegno(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 24, padding: '8px 8px 8px 14px', boxShadow: '0 4px 14px rgba(0,0,0,0.18)', cursor: 'pointer', flexDirection: 'row-reverse' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic n="clk" s={15} c={C.txm} /></div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>Impegno</span>
            </button>
            <button onClick={() => { setFabOpen(false); apriNuovo(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 24, padding: '8px 8px 8px 14px', boxShadow: '0 4px 14px rgba(0,0,0,0.18)', cursor: 'pointer', flexDirection: 'row-reverse' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.priL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic n="cal" s={15} c={C.pri} /></div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>Appuntamento</span>
            </button>
          </div>
        )}
        <button onClick={() => setFabOpen(v => !v)} aria-label="Nuovo" style={{ width: MOBILE_AGENDA_FAB_SIZE, height: MOBILE_AGENDA_FAB_SIZE, borderRadius: '50%', background: `linear-gradient(150deg, ${C.pri}, ${C.priD})`, border: 'none', boxShadow: `0 8px 20px ${C.pri}55`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: fabOpen ? 'rotate(45deg)' : 'none', transition: 'transform .2s ease' }}>
          <Ic n="plus" s={24} c="#fff" />
        </button>
      </div>

      {richiesteAperte && (
        <Modal title="Richieste di prenotazione" icon="bell" onClose={() => setRichiesteAperte(false)}>
          {richieste.length === 0 ? (
            <EmptyState icon="ok" title="Nessuna richiesta da gestire" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {richieste.map((r) => (
                <Crd key={r.id} style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      {r.origine === 'whatsapp' && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#25D3661A', color: '#128C4B', borderRadius: 20, padding: '2px 9px', fontSize: 10.5, fontWeight: 800, marginBottom: 5 }}>
                          <Ic n="wa" s={11} c="#128C4B" />WhatsApp · {{ prenota: 'Nuovo appuntamento', sposta: 'Spostamento', disdici: 'Disdetta' }[r.tipo_richiesta] || 'Richiesta'}
                        </div>
                      )}
                      <div style={{ fontWeight: 800, fontSize: 14, color: C.txt }}>{r.nome} {r.cognome}</div>
                      <div style={{ fontSize: 12, color: C.txm, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="ph" s={11} c={C.txm} />{r.telefono}{r.email ? ` · ${r.email}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 10.5, color: C.txl }}>{new Date(r.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {(r.date_preferite || []).map((d) => (
                      <span key={d} style={{ background: C.priL, color: C.pri, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                        {new Date(d + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', weekday: 'short' })}{r.ora_preferita ? ` · ${r.ora_preferita}` : ''}
                      </span>
                    ))}
                  </div>
                  {(r.motivo || r.note) && (
                    <div style={{ fontSize: 12, color: C.txm, marginBottom: 10, background: C.bg, borderRadius: 8, padding: '7px 10px' }}>
                      {r.motivo && <div><b>Motivo:</b> {r.motivo}</div>}
                      {r.note && <div style={{ marginTop: r.motivo ? 3 : 0 }}>{r.note}</div>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn ch={{ sposta: 'Sposta appuntamento', disdici: 'Apri per disdire' }[r.tipo_richiesta] || 'Crea appuntamento'} ic="cal" onClick={() => gestisciRichiesta(r)} full />
                    {r.origine === 'whatsapp' && r.tipo_richiesta !== 'prenota' && (
                      <button onClick={() => { confermaGestita(r.id); if (r.tipo_richiesta === 'disdici') inviaConfermaWhatsApp(r); }} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 9, padding: '0 12px', color: C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Gestita</button>
                    )}
                    <button onClick={() => rifiutaRichiesta(r.id)} style={{ background: C.danL, border: 'none', borderRadius: 9, padding: '0 14px', color: C.dan, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Rifiuta</button>
                  </div>
                </Crd>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
