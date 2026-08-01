import React, { useState, useRef, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Bdg, Ic, PhStr } from './ui';
import WaAction, { apriWaDiretto, waAbilitato } from './ui/WaAction.jsx';
import { C, uid, fmtD, today, DEF_APP_TYPES, DEF_AGENDA_SETTINGS } from '../lib/utils';
import { useIsMobile } from '../lib/useIsMobile';

const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const toISO = (d) => d.toISOString().slice(0, 10);
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
const startOfWeek = (d) => {
  const dt = new Date(d + 'T12:00');
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  return dt;
};

function GridView({ days, slots, slotH, slotMin, oraInizio, appointments, setAppointments, patients, getColore, appPosition, apriNuovo, apriEdit, apriWA, apriMail, apriSposta, delApp, selDay, setSelDay, setView, today: t, features, impegni, apriEditImpegno, onSwipeDay, selModeWA, selAppIds, toggleSelApp }) {
  const containerRef = useRef(null); // unico scroll container
  const resizeRef = useRef(null);
  const [now, setNow] = useState(new Date());
  const [resizing, setResizing] = useState(null); // { id, startY, startDurata }
  const [moving, setMoving] = useState(null); // { id, startY, startOra }
  const movedRef = useRef(false); // distingue click da drag: true se il mouse si e' spostato oltre la soglia
  const [menuApp, setMenuApp] = useState(null); // appuntamento con menu contestuale aperto (WA/Mail/Modifica/Sposta/Elimina)
  const isSettimana = days.length > 1;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Scroll iniziale: vicino all'ora corrente se è dentro l'intervallo visibile, altrimenti in cima
    const target = showNowLine ? Math.max(0, nowTop - slotH * 2) : 0;
    if (containerRef.current) containerRef.current.scrollTop = target;
  }, [slotH, slotMin, oraInizio]);

  // Resize mouse handlers
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      const dy = (e.clientY || e.touches?.[0]?.clientY || 0) - resizing.startY;
      const deltaMins = Math.round(dy / slotH * slotMin / slotMin) * slotMin;
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
  }, [resizing, slotH, slotMin]);

  // Move (drag) mouse handlers — sposta l'orario trascinando l'intero blocco appuntamento,
  // stesso pattern del resize ma cambia "ora" invece di "durata".
  useEffect(() => {
    if (!moving) return;
    const onMove = (e) => {
      const clientY = e.clientY || e.touches?.[0]?.clientY || 0;
      const dy = clientY - moving.startY;
      if (!movedRef.current && Math.abs(dy) < 6) return; // soglia minima prima di considerarlo un drag
      movedRef.current = true;
      const deltaSlots = Math.round(dy / slotH);
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
  }, [moving, slotH, slotMin]);

  // Swipe orizzontale sulla griglia: solo vista Giorno (days.length === 1), va al giorno
  // successivo/precedente. Ignorato se in corso un resize o uno spostamento di appuntamento,
  // per non entrare in conflitto con quei gesti.
  const swipeStartRef = useRef(null);
  const swipeAttivo = (days.length === 1 || days.length === 7) && typeof onSwipeDay === 'function';
  const onTouchStartSwipe = (e) => {
    if (swipeAttivo && e.touches.length === 1 && !resizing && !moving) {
      swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      swipeStartRef.current = null;
    }
  };
  const onTouchEndSwipe = (e) => {
    if (!swipeAttivo || !swipeStartRef.current || resizing || moving) { swipeStartRef.current = null; return; }
    const touch = e.changedTouches[0];
    const dx = touch.clientX - swipeStartRef.current.x;
    const dy = touch.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onSwipeDay(dx < 0 ? 1 : -1);
    }
  };

  const nowMin = now.getHours() * 60 + now.getMinutes() - oraInizio * 60;
  const nowTop = (nowMin / slotMin) * slotH;
  const showNowLine = nowMin >= 0 && nowMin <= slots.length * slotMin;

  return (
    <div onTouchStart={onTouchStartSwipe} onTouchEnd={onTouchEndSwipe} style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', border: `1px solid ${C.brd}`, borderRadius: 12, background: C.sur, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Contenitore della griglia — scrolla qui dentro, isolato dal resto della pagina.
            IMPORTANTE: ogni div con flex:1+overflow:auto in questa catena ha anche
            min-height:0 esplicito. Senza, su iOS Safari un elemento flex di default
            si allarga per contenere tutto il suo contenuto invece di rispettare lo
            spazio assegnato — e a quel punto è la PAGINA a scrollare per compensare,
            non l'elemento stesso. È il bug reale dietro lo scroll incoerente di prima:
            dipendeva da quanti appuntamenti/ore c'erano, non era mai stato casuale. */}
        <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: slots.length * slotH }}>

            <div style={{ display: 'flex', flex: 1 }}>

            {/* Colonna ore — sticky */}
            <div style={{ width: 46, flexShrink: 0, borderRight: `1.5px solid ${C.brd}`, background: C.bg, position: 'sticky', left: 0, zIndex: 3 }}>
              {slots.map((slot) => {
                const isHour = slot.endsWith(':00');
                return (
                  <div key={slot} style={{ height: slotH, borderBottom: `1px solid ${isHour ? C.brd : C.brd + '40'}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 5, paddingTop: 2, boxSizing: 'border-box' }}>
                    <span style={{ fontSize: isHour ? 9.5 : 8, color: isHour ? C.txm : C.txl, fontWeight: isHour ? 800 : 500 }}>{isHour ? slot : ''}</span>
                  </div>
                );
              })}
            </div>

            {/* Griglia giorni */}
            <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          {days.map((d, di) => {
            const ds = toISO(d);
            const dayApps = appointments.filter(a => a.data === ds).sort((a, b) => a.ora.localeCompare(b.ora));
            const dayImpOrari = (impegni || []).filter(imp => !imp.tuttoIlGiorno && imp.oraInizio && ds >= imp.dataInizio && ds <= imp.dataFine);
            const isToday = ds === t;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div key={di} style={{ flex: 1, position: 'relative', borderLeft: di > 0 ? `1.5px solid ${C.brd}` : 'none', background: isWeekend ? C.bg : isToday ? C.priL : C.sur }}>
                {slots.map((slot) => {
                  const isHour = slot.endsWith(':00');
                  return (
                    <div key={slot} onClick={() => { if (!selModeWA) apriNuovo(ds, slot); }} style={{ height: slotH, borderBottom: `1px solid ${isHour ? C.brd + '60' : C.brd + '25'}`, cursor: selModeWA ? 'default' : 'pointer', boxSizing: 'border-box' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.priL + '70'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                  );
                })}
                {isToday && showNowLine && (
                  <div style={{ position: 'absolute', top: nowTop, left: di === 0 ? -6 : 0, right: 0, zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    {di === 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E63946', flexShrink: 0 }} />}
                    <div style={{ flex: 1, height: 1.5, background: '#E63946' }} />
                  </div>
                )}
                {dayImpOrari.map(imp => {
                  const inizioMin = orarioInMinutiUI(imp.oraInizio) - oraInizio * 60;
                  const fineMin = orarioInMinutiUI(imp.oraFine || imp.oraInizio) - oraInizio * 60;
                  const top = (inizioMin / slotMin) * slotH;
                  const height = Math.max(((fineMin - inizioMin) / slotMin) * slotH, slotH * 0.5);
                  if (top + height < 0 || top >= slots.length * slotH) return null;
                  const co = imp.colore || TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.colore || C.pri;
                  return (
                    <div key={'imp-' + imp.id} onClick={() => apriEditImpegno(imp)} title={imp.titolo} style={{
                      position: 'absolute', top, left: 2, right: 2, height, zIndex: 1, cursor: 'pointer',
                      background: co + '35', border: `1.5px dashed ${co}AA`, borderRadius: 5,
                      display: 'flex', alignItems: 'flex-start', padding: '2px 5px', boxSizing: 'border-box', overflow: 'hidden',
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: co, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{imp.titolo}</span>
                    </div>
                  );
                })}
                {dayApps.map(a => {
                  const { top, height } = appPosition(a);
                  if (top < 0 || top >= slots.length * slotH) return null;
                  const p = patients.find(x => x.id === a.pazienteId);
                  const co = getColore(a);
                  const isBeingResized = resizing?.id === a.id;
                  const isBeingMoved = moving?.id === a.id;
                  const isSelezionabileWA = !!p?.telefono;
                  const isSelected = selAppIds?.includes(a.id);
                  return (
                    <div key={a.id} style={{ position: 'absolute', top, left: 2, right: 2, height, background: co, borderRadius: 5, overflow: 'hidden', zIndex: isBeingResized || isBeingMoved ? 10 : 2, borderLeft: `3px solid ${co}DD`, boxShadow: isBeingResized || isBeingMoved ? '0 6px 16px rgba(0,0,0,0.35)' : '0 1px 3px rgba(0,0,0,0.15)', userSelect: 'none', opacity: isBeingMoved ? 0.85 : (selModeWA && !isSelezionabileWA ? 0.35 : 1), outline: isSelected ? '2.5px solid #25D366' : 'none', outlineOffset: -1 }}>
                      {/* Contenuto appuntamento — in modalità selezione tocca per selezionare/deselezionare;
                          altrimenti trascina per spostare l'orario, tocca/clicca senza muovere per aprire il menu azioni */}
                      <div
                        onMouseDown={e => { if (selModeWA || isBeingResized) return; movedRef.current = false; setMoving({ id: a.id, startY: e.clientY, startOra: a.ora }); }}
                        onTouchStart={e => { if (selModeWA || isBeingResized) return; movedRef.current = false; setMoving({ id: a.id, startY: e.touches[0].clientY, startOra: a.ora }); }}
                        onClick={e => {
                          e.stopPropagation();
                          if (selModeWA) { if (isSelezionabileWA) toggleSelApp(a.id); return; }
                          if (isBeingResized || movedRef.current) { movedRef.current = false; return; }
                          setMenuApp(a);
                        }}
                        style={{ padding: '2px 5px', cursor: selModeWA ? (isSelezionabileWA ? 'pointer' : 'not-allowed') : (isBeingMoved ? 'grabbing' : 'grab'), paddingBottom: height > 26 ? 9 : 2, touchAction: 'none' }}
                      >
                        <div style={{ fontSize: 9, lineHeight: '10px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.ora} {p ? `${p.cognome}` : '—'}</div>
                        {height > 28 && <div style={{ fontSize: 8, lineHeight: '9px', color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tipo}</div>}
                        {height > 44 && <div style={{ fontSize: 8, lineHeight: '9px', color: 'rgba(255,255,255,0.7)' }}>{a.durata} min</div>}
                      </div>
                      {/* Checkbox selezione — solo in modalità invio WhatsApp di massa */}
                      {selModeWA && isSelezionabileWA && (
                        <div style={{ position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: 4, background: isSelected ? '#25D366' : 'rgba(255,255,255,0.85)', border: `1.5px solid ${isSelected ? '#25D366' : 'rgba(0,0,0,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 3 }}>
                          {isSelected && <Ic n="ok" s={9} c="#fff" />}
                        </div>
                      )}
                      {/* RESIZE HANDLE - nascosta sugli appuntamenti troppo brevi per contenerla senza sovrapporsi al testo, e comunque disattivata in modalità selezione */}
                      {height > 26 && !selModeWA && <div
                        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setResizing({ id: a.id, startY: e.clientY, startDurata: Number(a.durata) }); }}
                        onTouchStart={e => { e.stopPropagation(); setResizing({ id: a.id, startY: e.touches[0].clientY, startDurata: Number(a.durata) }); }}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderBottomLeftRadius: 5, borderBottomRightRadius: 5, touchAction: 'none' }}>
                        <div style={{ width: 16, height: 2, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }} />
                      </div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
            </div>
            </div>
          </div>
        </div>
      </div>
      {/* Menu contestuale appuntamento — si apre al tap (non al drag) su un blocco appuntamento */}
      {menuApp && (() => {
        const p = patients.find(x => x.id === menuApp.pazienteId);
        const co = getColore(menuApp);
        const azioni = [
          { id: 'wa', label: 'WhatsApp', ic: 'wa', col: '#25D366', dis: !p?.telefono, onClick: () => { apriWA(menuApp); setMenuApp(null); } },
          { id: 'mail', label: 'Email', ic: 'mail', col: C.pri, dis: !p?.email, onClick: () => { apriMail(menuApp); setMenuApp(null); } },
          { id: 'edit', label: 'Modifica', ic: 'edit', col: C.txt, onClick: () => { apriEdit(menuApp); setMenuApp(null); } },
          { id: 'sposta', label: 'Sposta', ic: 'move', col: C.txt, onClick: () => { apriSposta(menuApp); setMenuApp(null); } },
          { id: 'del', label: 'Elimina', ic: 'del', col: C.dan, onClick: () => { setMenuApp(null); delApp(menuApp.id); } },
        ];
        return (
          <div
            onClick={() => setMenuApp(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.55)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <div onClick={e => e.stopPropagation()} style={{ background: C.sur, borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 480, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.brd}`, display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: co, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : 'Paziente'}</div>
                  <div style={{ fontSize: 11.5, color: C.txm }}>{fmtD(menuApp.data)} · {menuApp.ora} · {menuApp.tipo}</div>
                </div>
              </div>
              <div style={{ padding: 8 }}>
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
              </div>
              <div style={{ height: 'env(safe-area-inset-bottom,12px)' }} />
            </div>
          </div>
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
function ViewPicker({ view, setView }) {
  const [open, setOpen] = useState(false);
  const LABEL = { giorno: 'Giorno', settimana: 'Settimana', mese: 'Mese' };
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.priL, color: C.pri, border: 'none', borderRadius: 14, padding: '5px 8px 5px 11px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
        {LABEL[view]}
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke={C.pri} strokeWidth="3" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 34 }} />}
      {open && (
        <div style={{ position: 'absolute', top: 30, right: 0, background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 10, boxShadow: '0 8px 22px rgba(0,0,0,0.18)', width: 126, overflow: 'hidden', zIndex: 35 }}>
          {['giorno', 'settimana', 'mese'].map((v) => (
            <div key={v} onClick={() => { setView(v); setOpen(false); }} style={{ padding: '9px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: view === v ? C.priL : 'transparent', color: view === v ? C.pri : C.txt }}>{LABEL[v]}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function DayStrip({ selDay, setSelDay, today: t, onWeekChange, highlightSelected = true, viewPicker }) {
  const scrollRef = useRef(null);
  const [stripBaseWeek, setStripBaseWeek] = useState(() => toISO(startOfWeek(selDay)));
  const settleTimer = useRef(null);
  const itemWidthRef = useRef(0);

  useEffect(() => {
    const wk = toISO(startOfWeek(selDay));
    if (wk !== stripBaseWeek) setStripBaseWeek(wk);
  }, [selDay]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth;
    itemWidthRef.current = w;
    el.scrollLeft = w * 2;
    if (onWeekChange) onWeekChange(stripBaseWeek);
  }, [stripBaseWeek]);

  const windowStart = new Date(stripBaseWeek + 'T12:00');
  windowStart.setDate(windowStart.getDate() - 14);
  const weeks = Array.from({ length: 5 }, (_, wi) => {
    const ws = new Date(windowStart);
    ws.setDate(ws.getDate() + wi * 7);
    return Array.from({ length: 7 }, (_, di) => { const d = new Date(ws); d.setDate(d.getDate() + di); return d; });
  });

  const onScroll = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el || !itemWidthRef.current) return;
      const idx = Math.round(el.scrollLeft / itemWidthRef.current);
      if (idx !== 2) {
        const nb = new Date(stripBaseWeek + 'T12:00');
        nb.setDate(nb.getDate() + (idx - 2) * 7);
        setStripBaseWeek(toISO(nb));
      }
    }, 120);
  };

  // Etichetta mese, fissa, calcolata dalla settimana attualmente mostrata (si aggiorna
  // anche solo scorrendo, senza dover toccare un giorno) — se la settimana attraversa
  // due mesi (o due anni) li mostra entrambi, es. "Lug – Ago 2026".
  const wkMonStart = new Date(stripBaseWeek + 'T12:00');
  const wkMonEnd = new Date(wkMonStart); wkMonEnd.setDate(wkMonEnd.getDate() + 6);
  const meseLabel = wkMonStart.getMonth() === wkMonEnd.getMonth()
    ? `${MESI[wkMonStart.getMonth()]} ${wkMonStart.getFullYear()}`
    : wkMonStart.getFullYear() === wkMonEnd.getFullYear()
      ? `${MESI[wkMonStart.getMonth()].slice(0, 3)} – ${MESI[wkMonEnd.getMonth()].slice(0, 3)} ${wkMonStart.getFullYear()}`
      : `${MESI[wkMonStart.getMonth()].slice(0, 3)} ${wkMonStart.getFullYear()} – ${MESI[wkMonEnd.getMonth()].slice(0, 3)} ${wkMonEnd.getFullYear()}`;

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 6px' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.txt, textTransform: 'capitalize' }}>{meseLabel}</span>
        {viewPicker}
      </div>
      {/* Gutter da 46px, identico alla colonna ore della griglia sotto: senza, le colonne di
          questa striscia non coinciderebbero con quelle della griglia (uno sfasamento che
          confonde su quale giorno si sta guardando). */}
      <div style={{ display: 'flex', marginBottom: 8, borderRadius: 12, background: C.sur, border: `1px solid ${C.brd}`, overflow: 'hidden' }}>
        <div style={{ width: 46, flexShrink: 0, borderRight: `1px solid ${C.brd}` }} />
        <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, minWidth: 0, display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '8px 4px' }}>
              {week.map((d, di) => {
                const ds = toISO(d);
                const isToday = ds === t;
                const isSel = highlightSelected && ds === selDay;
                return (
                  <div key={di} onClick={() => setSelDay(ds)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', padding: '2px 0' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isToday ? C.pri : C.txl, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{WD_SHORT[d.getDay()]}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSel ? C.pri : isToday ? C.priL : 'transparent', color: isSel ? '#fff' : isToday ? C.pri : C.txt }}>{d.getDate()}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Agenda({ patients, appointments, setAppointments, appTypes, initPazienteId, onClearInitPaz, templates, features, impegni, setImpegni, si, setStudioInfo }) {
  const tipiList = appTypes?.length ? appTypes : DEF_APP_TYPES;

  // Setup Agenda: le impostazioni sono condivise a livello di studio (studioInfo.agenda_settings),
  // così tutti i collaboratori vedono la stessa configurazione. localStorage resta solo come
  // valore iniziale offline-first prima che arrivi lo studioInfo dal server.
  const agSet = { ...DEF_AGENDA_SETTINGS, ...(si?.agenda_settings || {}) };
  const [oraInizio, setOraInizio] = useState(() => { try { return si?.agenda_settings?.oraInizio ?? Number(localStorage.getItem('ag_oraInizio') || DEF_AGENDA_SETTINGS.oraInizio); } catch { return DEF_AGENDA_SETTINGS.oraInizio; } });
  const [oraFine, setOraFine] = useState(() => { try { return si?.agenda_settings?.oraFine ?? Number(localStorage.getItem('ag_oraFine') || DEF_AGENDA_SETTINGS.oraFine); } catch { return DEF_AGENDA_SETTINGS.oraFine; } });
  const [slotMin, setSlotMin] = useState(() => { try { return si?.agenda_settings?.slotMin ?? Number(localStorage.getItem('ag_slotMin') || DEF_AGENDA_SETTINGS.slotMin); } catch { return DEF_AGENDA_SETTINGS.slotMin; } });
  const [zoom, setZoom] = useState(() => { try { return si?.agenda_settings?.zoom ?? (Number(localStorage.getItem('ag_zoom')) || DEF_AGENDA_SETTINGS.zoom); } catch { return DEF_AGENDA_SETTINGS.zoom; } });
  const [hiddenWeekdays, setHiddenWeekdays] = useState(() => si?.agenda_settings?.hiddenWeekdays || DEF_AGENDA_SETTINGS.hiddenWeekdays);
  const [view, setView] = useState('settimana');
  const [selDay, setSelDay] = useState(today());
  const [modal, setModal] = useState(false);
  const [pazSearch, setPazSearch] = useState('');
  const [toast, setToast] = useState('');
  const [editApp, setEditApp] = useState(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [vd, setVd] = useState(new Date());
  const wheelRef = useRef(0);
  const touchXRef = useRef(null);
  const [form, setForm] = useState({ pazienteId: '', data: today(), ora: '09:00', durata: agSet.durataDefault, tipo: tipiList[0]?.nome || 'Visita', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato', ripeti: 'nessuna', ripetiFino: '' });
  const [waModal, setWaModal] = useState(null);
  const [waMsg, setWaMsg] = useState('');
  const [waTplId, setWaTplId] = useState('');
  const [selModeWA, setSelModeWA] = useState(false); // modalità selezione multipla per invio WhatsApp di massa
  const [selAppIds, setSelAppIds] = useState([]); // id appuntamenti selezionati in selModeWA
  const [waMassModal, setWaMassModal] = useState(false); // modal di composizione messaggio per l'invio di massa
  const [waMassTplId, setWaMassTplId] = useState('');
  const [waMassMsg, setWaMassMsg] = useState('Gentile {nome},\nricordiamo il suo appuntamento il {data} alle {ora} ({tipo}).\nGrazie!');
  const [impModal, setImpModal] = useState(false);
  const [editImp, setEditImp] = useState(null);
  const [impForm, setImpForm] = useState({ titolo: '', tipo: 'personale', colore: '', dataInizio: today(), dataFine: today(), tuttoIlGiorno: true, oraInizio: '09:00', oraFine: '10:00', note: '', ripeti: 'no', ripetiFino: today() });
  const IF = (f) => setImpForm((p) => ({ ...p, ...f }));

  const F = (f) => setForm(p => ({ ...p, ...f }));

  useEffect(() => {
    if (initPazienteId) {
      setForm(f => ({ ...f, pazienteId: String(initPazienteId) }));
      setModal(true);
      if (onClearInitPaz) onClearInitPaz();
    }
  }, [initPazienteId]);

  const isMobile = useIsMobile();
  // availH reattivo: ricalcolato a ogni resize/orientazione, non solo al primo render.
  // Sottrae header app + header agenda + tab switcher + dock (84px mobile / 60px desktop),
  // così la griglia è sempre tarata sullo spazio reale disponibile, non su un valore fisso.
  const [availH, setAvailH] = useState(() => (typeof window !== 'undefined' ? Math.max(360, window.innerHeight - 210) : 480));
  useEffect(() => {
    const dockH = isMobile ? 84 : 60;
    const chrome = 126 + dockH; // header studio + header agenda + tab switcher, misurati empiricamente
    const recalc = () => setAvailH(Math.max(360, window.innerHeight - chrome));
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('orientationchange', recalc);
    return () => { window.removeEventListener('resize', recalc); window.removeEventListener('orientationchange', recalc); };
  }, [isMobile]);
  // slotH calcolato per far stare l'intervallo scelto (oraInizio-oraFine) nello schermo, poi scalato dal fattore zoom
  const oreVisibili = Math.max(1, oraFine - oraInizio);
  const slotH = Math.max(8, Math.round((availH / (oreVisibili * 60 / slotMin)) * zoom));
  // Griglia limitata all'intervallo oraInizio - oraFine scelto nelle impostazioni
  const slots = [];
  for (let h = oraInizio; h < oraFine; h++) {
    for (let m = 0; m < 60; m += slotMin) {
      slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  }

  const getColore = (a) => a.colore || tipiList.find(t => t.nome === a.tipo)?.colore || C.pri;

  const appPosition = (a) => {
    const [ah, am] = a.ora.split(':').map(Number);
    const min = ah * 60 + am - oraInizio * 60; // relativo all'inizio dell'intervallo visibile
    const top = (min / slotMin) * slotH;
    const height = Math.max((Number(a.durata) / slotMin) * slotH - 2, slotH * 0.6);
    return { top, height };
  };

  const weekStart = startOfWeek(selDay);
  const weekDaysAll = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  // Non nasconde MAI tutti i 7 giorni: se per errore lo studio ha nascosto tutta la settimana, mostra comunque tutto.
  const weekDaysVisibili = weekDaysAll.filter(d => !hiddenWeekdays.includes(d.getDay()));
  const weekDays = weekDaysVisibili.length > 0 ? weekDaysVisibili : weekDaysAll;
  const t = today();

  const apriNuovo = (data, ora) => {
    setPazSearch('');
    setEditApp(null);
    setForm({ pazienteId: '', data: data || selDay, ora: ora || '09:00', durata: agSet.durataDefault, tipo: tipiList[0]?.nome || 'Visita', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato', ripeti: 'nessuna', ripetiFino: '' });
    setModal(true);
  };

  const apriEdit = (a) => {
    setEditApp(a);
    setPazSearch('');
    setForm({ pazienteId: String(a.pazienteId), data: a.data, ora: a.ora, durata: a.durata, tipo: a.tipo, colore: a.colore || C.pri, note: a.note || '', stato: a.stato || 'confermato', ripeti: 'nessuna', ripetiFino: '' });
    setModal(true);
  };

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
    const defMsg = `Gentile ${p.nome},\nricordiamo il suo appuntamento:\n📅 ${fmtD(a.data)} alle ${a.ora}\n🦷 ${a.tipo}\nPer variazioni contattarci entro 24h. Grazie!`;
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
    selezionati.forEach((a, i) => {
      const p = patients.find(x => x.id === a.pazienteId);
      if (!p?.telefono) return;
      const msg = waMassMsg
        .replace(/{nome}/g, `${p.nome} ${p.cognome}`)
        .replace(/{data}/g, fmtD(a.data)).replace(/{ora}/g, a.ora).replace(/{tipo}/g, a.tipo)
        .replace(/{totale}/g, '').replace(/{voci}/g, '');
      setTimeout(() => apriWaDiretto(p.telefono, msg), i * 350);
    });
    setToast(`Invio avviato per ${selezionati.length} pazient${selezionati.length === 1 ? 'e' : 'i'} ✓`);
    setWaMassModal(false);
    setSelModeWA(false);
    setSelAppIds([]);
  };

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
    if (editApp) {
      const { ripeti, ripetiFino, ...rest } = form;
      setAppointments(p => p.map(a => a.id === editApp.id ? { ...a, ...rest, pazienteId: Number(form.pazienteId), durata: Number(form.durata) } : a));
      setToast('Aggiornato ✓');
    } else {
      const { ripeti, ripetiFino, ...rest } = form;
      const date = generaDateRipetizione(form.data, ripeti, ripetiFino);
      const nuovi = date.map((d) => ({ ...rest, data: d, id: uid() + Math.floor(Math.random() * 1000), pazienteId: Number(form.pazienteId), durata: Number(form.durata) }));
      setAppointments(p => [...p, ...nuovi]);
      setToast(nuovi.length > 1 ? `${nuovi.length} appuntamenti creati ✓` : 'Salvato ✓');
    }
    setModal(false);
  };

  const del = (id) => { if (confirm('Eliminare?')) setAppointments(p => p.filter(a => a.id !== id)); };

  const apriNuovoImpegno = (data) => {
    setEditImp(null);
    setImpForm({ titolo: '', tipo: 'personale', colore: '', dataInizio: data || selDay, dataFine: data || selDay, tuttoIlGiorno: true, oraInizio: '09:00', oraFine: '10:00', note: '', ripeti: 'no', ripetiFino: data || selDay });
    setImpModal(true);
  };

  const apriEditImpegno = (imp) => {
    setEditImp(imp);
    setImpForm({
      titolo: imp.titolo, tipo: imp.tipo, colore: imp.colore || '', dataInizio: imp.dataInizio, dataFine: imp.dataFine,
      tuttoIlGiorno: imp.tuttoIlGiorno !== false, oraInizio: imp.oraInizio || '09:00', oraFine: imp.oraFine || '10:00', note: imp.note || '',
      ripeti: 'no', ripetiFino: imp.dataInizio,
    });
    setImpModal(true);
  };

  const saveImpegno = () => {
    if (!impForm.titolo.trim()) return;
    const base = { titolo: impForm.titolo, tipo: impForm.tipo, colore: impForm.colore, tuttoIlGiorno: impForm.tuttoIlGiorno, note: impForm.note };

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
    const recurrenceId = occorrenze.length > 1 ? uid() : null;
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

  const gridProps = { slots, slotH, slotMin, oraInizio, appointments, setAppointments, patients, getColore, appPosition, apriNuovo, apriEdit, apriWA, apriMail, apriSposta, delApp: del, selDay, setSelDay, setView, today: t, impegni, apriEditImpegno, selModeWA, selAppIds, toggleSelApp };

  // Appuntamenti effettivamente visibili nella vista corrente (per il conteggio "Seleziona tutti" e il badge)
  const giorniVisibili = view === 'giorno' ? [selDay] : view === 'settimana' ? weekDays.map(toISO) : [];
  const appVisibili = appointments.filter(a => giorniVisibili.includes(a.data));
  const appVisibiliConTel = selezionabiliWAMass(appVisibili);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {view === 'giorno' && (
        <DayStrip selDay={selDay} setSelDay={setSelDay} today={t} viewPicker={<ViewPicker view={view} setView={setView} />} />
      )}
      {view === 'settimana' && (
        <DayStrip
          selDay={selDay}
          setSelDay={(ds) => { setSelDay(ds); setView('giorno'); }}
          today={t}
          highlightSelected={false}
          onWeekChange={(wk) => setSelDay(wk)}
          viewPicker={<ViewPicker view={view} setView={setView} />}
        />
      )}
      {view === 'mese' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => navMese(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: C.txm }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 12 }}>{MESI[vd.getMonth()]} {vd.getFullYear()}</span>
            <button onClick={() => navMese(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: C.txm }}>›</button>
            <button onClick={() => setVd(new Date())} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '4px 8px', color: C.pri, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Oggi</button>
          </div>
          <ViewPicker view={view} setView={setView} />
        </div>
      )}

      {/* Toolbar invio WhatsApp di massa — solo vista Giorno/Settimana, dove ha senso "tutti gli appuntamenti visibili" */}
      {(view === 'giorno' || view === 'settimana') && waAbilitato(features) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexShrink: 0 }}>
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
      )}

      {/* VIEWS */}
      {(view === 'giorno' || view === 'settimana') && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {view === 'giorno' && <GridView days={[new Date(selDay + 'T12:00')]} {...gridProps} onSwipeDay={navGiorno} features={features} />}
          {view === 'settimana' && <GridView days={weekDays} {...gridProps} onSwipeDay={navSettimana} features={features} />}
        </div>
      )}
      {view === 'mese' && (() => {
        const K = vd.getFullYear(), mese = vd.getMonth();
        const primo = new Date(K, mese, 1).getDay();
        const giorni = new Date(K, mese + 1, 0).getDate();
        const celle = Array(primo === 0 ? 6 : primo - 1).fill(null).concat(Array.from({ length: giorni }, (_, i) => i + 1));
        return (
          <div>
            <Crd
              onWheel={e => {
                const now = Date.now();
                if (now - (wheelRef.current || 0) < 350) return; // throttle: uno scatto di mese per volta
                if (Math.abs(e.deltaY) < 15) return;
                wheelRef.current = now;
                navMese(e.deltaY > 0 ? 1 : -1);
              }}
              onTouchStart={e => { touchXRef.current = e.touches[0].clientX; }}
              onTouchEnd={e => {
                if (touchXRef.current == null) return;
                const dx = e.changedTouches[0].clientX - touchXRef.current;
                if (Math.abs(dx) > 50) navMese(dx < 0 ? 1 : -1);
                touchXRef.current = null;
              }}
              style={{ marginBottom: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button onClick={() => navMese(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17, color: C.txm }}>‹</button>
                <span style={{ fontWeight: 700 }}>{MESI[mese]} {K}</span>
                <button onClick={() => navMese(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17, color: C.txm }}>›</button>
              </div>
              <div style={{ textAlign: 'center', fontSize: 10, color: C.txl, marginBottom: 6 }}>Scorri con la rotellina o trascina per cambiare mese</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                {['L','M','M','G','V','S','D'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.txm, padding: '2px 0' }}>{d}</div>)}
                {celle.map((g, i) => {
                  if (!g) return <div key={i} />;
                  const ds = `${K}-${String(mese+1).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
                  const cnt = appointments.filter(a => a.data === ds).length;
                  const dayImp = (impegni || []).filter(imp => ds >= imp.dataInizio && ds <= imp.dataFine);
                  const isSel = ds === selDay, isTod = ds === t;
                  return (
                    <div key={i} onClick={() => { setSelDay(ds); setView('giorno'); }} style={{ textAlign: 'center', padding: '5px 2px', borderRadius: 7, cursor: 'pointer', background: isSel ? C.pri : isTod ? C.priL : 'transparent', color: isSel ? '#fff' : isTod ? C.pri : C.txt, fontWeight: isSel || isTod ? 700 : 400, fontSize: 12, position: 'relative', minHeight: 28 }}>
                      {dayImp.length > 0 && (
                        <div style={{ display: 'flex', gap: 1, position: 'absolute', top: 2, left: 3, right: 3, height: 3 }}>
                          {dayImp.slice(0, 3).map((imp) => (
                            <div key={imp.id} style={{ flex: 1, height: 3, borderRadius: 2, background: imp.colore || TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.colore || C.pri }} />
                          ))}
                        </div>
                      )}
                      {g}
                      {cnt > 0 && <div style={{ display: 'flex', gap: 1, justifyContent: 'center', position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)' }}>
                        {Array.from({ length: Math.min(cnt, 3) }, (_, j) => <div key={j} style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? '#fff' : C.pri }} />)}
                      </div>}
                    </div>
                  );
                })}
              </div>
            </Crd>
            {(impegni || []).filter(imp => selDay >= imp.dataInizio && selDay <= imp.dataFine).map(imp => {
              const co = imp.colore || TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.colore || C.pri;
              return (
                <Crd key={imp.id} style={{ marginBottom: 8, borderLeft: `4px solid ${co}`, cursor: 'pointer' }} onClick={() => apriEditImpegno(imp)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ background: co + '20', borderRadius: 7, padding: '4px 9px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: co, textTransform: 'uppercase' }}>{TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.label || imp.tipo}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{imp.titolo}</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{imp.tuttoIlGiorno ? 'Tutto il giorno' : `${(imp.oraInizio || '').slice(0,5)} – ${(imp.oraFine || '').slice(0,5)}`}{imp.dataInizio !== imp.dataFine ? ` · ${fmtD(imp.dataInizio)} – ${fmtD(imp.dataFine)}` : ''}</div>
                    </div>
                  </div>
                </Crd>
              );
            })}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.txm, marginBottom: 8 }}>{fmtD(selDay)}</div>
            {appointments.filter(a => a.data === selDay).sort((a, b) => a.ora.localeCompare(b.ora)).map(a => {
              const p = patients.find(x => x.id === a.pazienteId);
              const co = getColore(a);
              return (
                <Crd key={a.id} style={{ marginBottom: 8, borderLeft: `4px solid ${co}`, cursor: 'pointer' }} onClick={() => apriEdit(a)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ background: co + '20', borderRadius: 7, padding: '4px 7px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: co }}>{a.ora}</div>
                      <div style={{ fontSize: 9, color: co }}>{a.durata}m</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{a.tipo}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <WaAction tel={p?.telefono} features={features} variant="icon" onClick={() => apriWA(a)} />
                      <button onClick={e => { e.stopPropagation(); del(a.id); }} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' }}><Ic n="del" s={13} c={C.dan} /></button>
                    </div>
                  </div>
                </Crd>
              );
            })}
            {appointments.filter(a => a.data === selDay).length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 20, fontSize: 13 }}>Nessun appuntamento — tocca un giorno per aggiungerne</div>}
          </div>
        );
      })()}

      {/* MODAL WA */}
      {waModal && (
        <Modal title="💬 Invia WhatsApp" onClose={() => setWaModal(null)}>
          {(() => { const p = patients.find(x => x.id === waModal.pazienteId); return (
            <div style={{ background: C.priL, borderRadius: 9, padding: '9px 12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p?.nome} {p?.cognome}</div>
              <div style={{ fontSize: 11, color: C.txm }}>📅 {fmtD(waModal.data)} · {waModal.ora} · {waModal.tipo}</div>
              {p?.telefono && <div style={{ fontSize: 11, color: C.txl }}>📱 {p.telefono}</div>}
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
          <Modal title={`💬 Invia a ${selezionati.length} pazient${selezionati.length === 1 ? 'e' : 'i'}`} onClose={() => setWaMassModal(false)}>
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
            <div style={{ background: '#FFF7E6', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#946200', marginBottom: 8 }}>
              ⚠️ Si apriranno {selezionati.length} finestre WhatsApp in sequenza, una per paziente: conferma l'invio in ciascuna.
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
        <Modal title={editApp ? '✏️ Modifica appuntamento' : '📅 Nuovo appuntamento'} onClose={() => setModal(false)} wide>
          <Fld label="Paziente">
            {(() => {
              const sel = patients.find(p => String(p.id) === String(form.pazienteId));
              const filtered = pazSearch.trim() ? patients.filter(p => `${p.nome} ${p.cognome} ${p.cognome} ${p.nome}`.toLowerCase().includes(pazSearch.toLowerCase())) : patients;
              return (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${sel && !pazSearch ? C.suc : C.brd}`, borderRadius: 10, padding: '10px 12px', background: C.sur }}>
                    {sel && !pazSearch ? (
                      <><div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{sel.nome} {sel.cognome}</div>{sel.telefono && <div style={{ fontSize: 11, color: C.txl }}>{sel.telefono}</div>}</div>
                        <button onClick={() => { F({ pazienteId: '' }); setPazSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txl, fontSize: 18, padding: 0 }}>✕</button></>
                    ) : (
                      <input autoFocus value={pazSearch} onChange={e => { setPazSearch(e.target.value); if (!e.target.value) F({ pazienteId: '' }); }} placeholder="Cerca per nome o cognome…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: C.txt, outline: 'none', fontFamily: 'inherit' }} />
                    )}
                  </div>
                  {(!sel || pazSearch) && filtered.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: C.sur, border: `1.5px solid ${C.pri}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: 3, maxHeight: 200, overflowY: 'auto' }}>
                      {filtered.slice(0, 20).map(p => (
                        <div key={p.id} onClick={() => { F({ pazienteId: String(p.id) }); setPazSearch(''); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.brd}` }} onMouseEnter={e => e.currentTarget.style.background = C.priL} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.cognome} {p.nome}</div>
                          {p.telefono && <div style={{ fontSize: 11, color: C.txl }}>{p.telefono}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={form.data} onChange={e => F({ data: e.target.value })} /></Fld>
            <Fld label="Ora"><Inp type="time" value={form.ora} onChange={e => F({ ora: e.target.value })} /></Fld>
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
            {editApp && <Btn ch="Elimina" v="dan" onClick={() => { del(editApp.id); setModal(false); }} />}
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch={editApp ? 'Aggiorna' : 'Salva'} onClick={save} dis={!form.pazienteId || (!editApp && form.ripeti !== 'nessuna' && !form.ripetiFino)} full />
          </div>
        </Modal>
      )}

      {/* MODAL IMPEGNO PERSONALE */}
      {impModal && (
        <Modal title={editImp ? '✏️ Modifica impegno' : '🗓️ Nuovo impegno personale'} onClose={() => setImpModal(false)}>
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
                <Fld label="Dalle"><Inp type="time" value={impForm.oraInizio} onChange={e => IF({ oraInizio: e.target.value })} /></Fld>
                <Fld label="Alle"><Inp type="time" value={impForm.oraFine} onChange={e => IF({ oraFine: e.target.value })} /></Fld>
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

          <Fld label="Note (opzionale)"><Txt value={impForm.note} onChange={e => IF({ note: e.target.value })} /></Fld>
          {impForm.tuttoIlGiorno && impForm.dataFine < impForm.dataInizio && <div style={{ background: C.danL, borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: C.dan, fontWeight: 700 }}>⚠️ La data di fine deve essere uguale o successiva alla data di inizio</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {editImp && <Btn ch="Elimina" v="dan" onClick={delImpegno} />}
            <Btn ch="Annulla" v="sec" onClick={() => setImpModal(false)} full />
            <Btn ch={editImp ? 'Aggiorna' : 'Salva'} onClick={saveImpegno} dis={!impForm.titolo.trim() || (impForm.tuttoIlGiorno && impForm.dataFine < impForm.dataInizio)} full />
          </div>
        </Modal>
      )}

      {/* PULSANTE FLOTTANTE "Nuovo" — apre un piccolo popup per scegliere Appuntamento o Impegno,
          stile iOS. A sinistra, alla stessa altezza del pulsante dell'assistente AI (che sta
          a destra): niente più sovrapposizione tra i due flottanti. */}
      <div style={{ position: 'fixed', left: 16, bottom: 74, zIndex: 140 }}>
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
        <button onClick={() => setFabOpen(v => !v)} aria-label="Nuovo" style={{ width: 54, height: 54, borderRadius: '50%', background: `linear-gradient(150deg, ${C.pri}, ${C.priD})`, border: 'none', boxShadow: `0 8px 20px ${C.pri}55`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: fabOpen ? 'rotate(45deg)' : 'none', transition: 'transform .2s ease' }}>
          <Ic n="plus" s={24} c="#fff" />
        </button>
      </div>
    </div>
  );
}
