import CalendarIcon from './CalendarIcon.jsx';
import { agendaDestination } from './navigation.js';
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { getVisibleWeekDays } from './visibleDays.js';
import './agenda.css';
import { C_LIGHT as DEFAULT_PALETTE } from './palette.js';
const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const toISO = d => d.toISOString().slice(0,10);
const startOfWeek = d => { const dt = new Date(d + 'T12:00'); const day = dt.getDay(); dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day)); return dt; };
export function ViewPicker({ view, setView, touchSafe = false, palette: C = DEFAULT_PALETTE }) {
  const [open, setOpen] = useState(false);
  const LABEL = { giorno: 'Giorno', settimana: 'Settimana', mese: 'Mese' };
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        className={touchSafe ? 'agenda-mobile-touch-target' : 'agenda-view-picker'}
        onClick={() => setOpen(v => !v)}
        style={touchSafe
          ? { display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, height: 44, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }
          : { display: 'flex', alignItems: 'center', gap: 4, background: C.priL, color: C.pri, border: 'none', borderRadius: 14, padding: '5px 8px 5px 11px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
      >
        <span className={touchSafe ? 'agenda-view-picker' : undefined} style={touchSafe ? { display: 'flex', alignItems: 'center', gap: 4, borderRadius: 14, padding: '5px 8px 5px 11px', fontSize: 12, fontWeight: 800, pointerEvents: 'none' } : { display: 'contents' }}>
          {LABEL[view]}
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke={C.pri} strokeWidth="3" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>
      {open && <div className="agenda-floating-interactive" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 34 }} />}
      {open && (
        <div className="agenda-floating-interactive" style={{ position: 'absolute', top: touchSafe ? 48 : 30, right: 0, background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 10, boxShadow: '0 8px 22px rgba(0,0,0,0.18)', width: 126, overflow: 'hidden', zIndex: 35 }}>
          {['giorno', 'settimana', 'mese'].map((v) => (
            <button key={v} onClick={() => { setView(v); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '9px 12px', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left', background: view === v ? C.priL : 'transparent', color: view === v ? C.pri : C.txt }}>{LABEL[v]}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DayStrip({ palette: C = DEFAULT_PALETTE, selDay, setSelDay, today: t, onWeekChange, highlightSelected = true, viewPicker, compact, oraColW, onPrevWeek, onNextWeek, hiddenWeekdays = [], singleDay = false, overlayRef, floatingFooter }) {
  const scrollRef = useRef(null);
  const [stripBaseWeek, setStripBaseWeek] = useState(() => toISO(startOfWeek(selDay)));
  const settleTimer = useRef(null);
  const itemWidthRef = useRef(0);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

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
  const weeks = singleDay
    ? [[new Date(selDay + 'T12:00')]]
    : Array.from({ length: 5 }, (_, wi) => {
      const ws = new Date(windowStart);
      ws.setDate(ws.getDate() + wi * 7);
      return getVisibleWeekDays(ws, hiddenWeekdays);
    });

  const onScroll = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el || !itemWidthRef.current) return;
      const idx = Math.round(el.scrollLeft / itemWidthRef.current);
      if (!singleDay && idx !== 2) {
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

  // "compact" (mobile): striscia più bassa, per lasciare più spazio verticale
  // alla griglia oraria sotto — cerchio del giorno e padding ridotti, il
  // gutter resta 46px (deve coincidere con la colonna ore della griglia).
  const circleD = compact ? 25 : 30;
  return (
    <div ref={overlayRef} className={compact ? 'agenda-mobile-floating-controls' : undefined} style={{ flexShrink: 0 }}>
      <div className={compact ? 'agenda-mobile-floating-toolbar' : undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: compact ? '0 4px 4px' : '0 4px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* POL-UI-006: controlli espliciti settimana precedente/successiva
              per desktop, oltre allo scroll/swipe già esistente sulla
              striscia sotto — stesso pattern già usato dalla vista Mese
              (frecce ‹/›). Cambiano realmente la settimana mostrata: usano
              lo stesso navSettimana(n) del gesto di swipe, non un
              placeholder finto. Non mostrati su mobile (compact), dove lo
              swipe resta l'interazione primaria. */}
          {!compact && onPrevWeek && (
            <button onClick={onPrevWeek} aria-label="Settimana precedente" style={{ background: C.bg, border: 'none', borderRadius: 7, width: 26, height: 26, cursor: 'pointer', fontSize: 15, color: C.txm, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
          )}
          <span className={compact ? 'agenda-mobile-floating-month' : undefined} style={{ fontSize: 13, fontWeight: 800, color: C.txt, textTransform: 'capitalize' }}>{meseLabel}</span>
          {!compact && onNextWeek && (
            <button onClick={onNextWeek} aria-label="Settimana successiva" style={{ background: C.bg, border: 'none', borderRadius: 7, width: 26, height: 26, cursor: 'pointer', fontSize: 15, color: C.txm, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>›</button>
          )}
        </div>
        {viewPicker}
      </div>
      {/* Gutter da 46px, identico alla colonna ore della griglia sotto: senza, le colonne di
          questa striscia non coinciderebbero con quelle della griglia (uno sfasamento che
          confonde su quale giorno si sta guardando). */}
      <div className={compact ? 'agenda-mobile-floating-week-strip' : undefined} style={{ display: 'flex', marginBottom: compact ? 6 : 8, borderRadius: 12, background: C.sur, border: `1px solid ${C.brd}`, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 6px 16px rgba(15,23,42,.06)' }}>
        <div style={{ width: oraColW || 46, flexShrink: 0, borderRight: `1px solid ${C.brd}` }} />
        <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, minWidth: 0, display: 'flex', overflowX: singleDay ? 'hidden' : 'auto', scrollSnapType: singleDay ? 'none' : 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', display: 'grid', gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))`, padding: compact ? '3px 0' : '8px 4px' }}>
              {week.map((d, di) => {
                const ds = toISO(d);
                const isToday = ds === t;
                const isSel = highlightSelected && ds === selDay;
                return (
                  <div className={compact ? 'agenda-mobile-day-item' : undefined} key={di} onClick={() => setSelDay(ds)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 1 : 3, cursor: 'pointer', padding: compact ? 0 : '2px 0' }}>
                    <span style={{ fontSize: compact ? 8 : 9, fontWeight: 700, color: compact && isToday ? C.dan : isToday ? C.pri : C.txl, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{WD_SHORT[d.getDay()]}</span>
                    <span
                      className={compact ? `agenda-mobile-day-number${isToday ? ' is-today' : ''}${isSel && !isToday ? ' is-selected' : ''}` : undefined}
                      style={{ fontSize: compact ? 13 : 15, fontWeight: 800, width: circleD, height: circleD, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: compact ? 'transparent' : isSel ? C.pri : isToday ? C.priL : 'transparent', color: compact ? (isToday ? C.dan : isSel ? C.pri : C.txt) : isSel ? '#fff' : isToday ? C.pri : C.txt, boxShadow: compact ? 'none' : isSel ? `0 4px 10px -2px ${C.pri}66` : 'none', transition: 'background .14s ease, box-shadow .14s ease' }}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {floatingFooter}
    </div>
  );
}

export function TimeGrid({ palette: C = DEFAULT_PALETTE, containerRef, isMobile, slots, slotH, effectiveSlotH, oraColW, days, today: t, showNowLine, nowTop, selectionMode = false, onSlot, renderDay }) {
  return (
        <div ref={containerRef} className={isMobile ? 'agenda-mobile-calendar-scroller' : undefined} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain', position: 'relative' }}>
          {/* POL-UI-010 (slot fit): minHeight ora usa slots.length*effectiveSlotH
              — coerente con ogni altro uso di effectiveSlotH sopra — invece del
              precedente max(100%, slots.length*slotH). Quando il range orario è
              corto, effectiveSlotH si è già espanso per riempire gridHeight, quindi
              slots.length*effectiveSlotH combacia esattamente con lo spazio
              disponibile (niente più margine di sicurezza necessario); quando il
              range è lungo, effectiveSlotH resta lo slotH base e il contenitore
              scrolla come sempre. Desktop invariato. */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: isMobile ? slots.length * effectiveSlotH : slots.length * slotH, background: C.sur }}>
            {isMobile && <div aria-hidden="true" className="agenda-mobile-scroll-spacer agenda-mobile-scroll-spacer--top" />}
            <div className="agenda-time-grid" style={{ display: 'flex', flex: 1 }}>

            {/* Colonna ore — sticky. Compatta su mobile (oraColW), per rubare meno spazio
                possibile alle 7 colonne giorno; deve restare identica al gutter di DayStrip. */}
            <div className="agenda-time-gutter" style={{ width: oraColW || 46, flexShrink: 0, borderRight: `1.5px solid ${C.brd}`, background: C.bg, position: 'sticky', left: 0, zIndex: 3 }}>
              {slots.map((slot) => {
                const isHour = slot.endsWith(':00');
                return (
                  <div key={slot} style={{ height: effectiveSlotH, borderBottom: `1px solid ${isHour ? C.brd : C.brd + '40'}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: isMobile ? 3 : 5, paddingTop: 2, boxSizing: 'border-box' }}>
                    <span style={{ fontSize: isHour ? 9.5 : 8, color: isHour ? C.txm : C.txl, fontWeight: isHour ? 800 : 500 }}>{isHour ? slot : ''}</span>
                  </div>
                );
              })}
            </div>

            {/* Griglia giorni */}
            <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          {days.map((d, di) => {
            const ds = toISO(d);
            const isToday = ds === t;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div className="agenda-grid-day" key={di} style={{ flex: 1, position: 'relative', borderLeft: di > 0 ? `1.5px solid ${C.brd}` : 'none', background: isMobile ? C.sur : isWeekend ? C.bg : isToday ? C.priL : C.sur }}>
                {slots.map((slot) => {
                  const isHour = slot.endsWith(':00');
                  return (
                    <div key={slot} onClick={() => { if (!selectionMode) onSlot(ds, slot); }} style={{ height: effectiveSlotH, borderBottom: `1px solid ${isHour ? C.brd + '60' : C.brd + '25'}`, cursor: selectionMode ? 'default' : 'pointer', boxSizing: 'border-box' }}
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
                {renderDay(ds, di)}
              </div>
            );
          })}
            </div>
            </div>
            {isMobile && <div aria-hidden="true" className="agenda-mobile-scroll-spacer agenda-mobile-scroll-spacer--bottom" />}
          </div>
        </div>
  );
}
export function MonthCalendar({ palette: C = DEFAULT_PALETTE, date: vd, selDay, today: t, onNavigate: navMese, onSelect, daySummary }) {
  const wheelRef = useRef(null), touchXRef = useRef(null);
  const K = vd.getFullYear(), mese = vd.getMonth();
  const primo = new Date(K, mese, 1).getDay();
  const giorni = new Date(K, mese + 1, 0).getDate();
  const celle = Array(primo === 0 ? 6 : primo - 1).fill(null).concat(Array.from({ length: giorni }, (_, i) => i + 1));
  return (            <div
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
              style={{ background: C.sur, borderRadius: 16, padding: 14, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 20px rgba(15,23,42,.07)', border: `1px solid ${C.brd}`, cursor: 'default', marginBottom: 10 }}
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
                  const { count: cnt = 0, marks: dayImp = [] } = daySummary(ds);
                  const isSel = ds === selDay, isTod = ds === t;
                  return (
                    <div key={i} onClick={() => { onSelect(ds); }} style={{ textAlign: 'center', padding: '5px 2px', borderRadius: 7, cursor: 'pointer', background: isSel ? C.pri : isTod ? C.priL : 'transparent', color: isSel ? '#fff' : isTod ? C.pri : C.txt, fontWeight: isSel || isTod ? 700 : 400, fontSize: 12, position: 'relative', minHeight: 28 }}>
                      {dayImp.length > 0 && (
                        <div style={{ display: 'flex', gap: 1, position: 'absolute', top: 2, left: 3, right: 3, height: 3 }}>
                          {dayImp.slice(0, 3).map((imp) => (
                            <div key={imp.id} style={{ flex: 1, height: 3, borderRadius: 2, background: imp.colore || C.pri }} />
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
            </div>);
}

export function EventBlock({ title, top, height, co, onClick, startTime, description }) {
  const showDetails = Boolean(startTime || description);
  return (                    <div onClick={onClick} title={[startTime, title, description].filter(Boolean).join(' · ')} style={{
                      position: 'absolute', top, left: 2, right: 2, height, zIndex: 1, cursor: 'pointer',
                      background: co + '35', border: `1.5px dashed ${co}AA`, borderRadius: 5,
                      display: 'flex', ...(showDetails ? { flexDirection: 'column', gap: 1, padding: '1px 4px' } : {}), alignItems: 'flex-start', ...(showDetails ? {} : { padding: '2px 5px' }), boxSizing: 'border-box', overflow: 'hidden',
                    }}>
                      <span style={{ ...(showDetails ? { width: '100%' } : {}), fontSize: 9, fontWeight: 800, color: co, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{startTime ? startTime + ' ' : ''}{title}</span>
                      {height > 36 && description && <span style={{ width: '100%', fontSize: 8, lineHeight: '9px', fontWeight: 600, color: co, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, whiteSpace: 'normal', overflowWrap: 'anywhere', overflow: 'hidden' }}>{description}</span>}
                    </div>);
}

export function AppointmentBlock({ a, label, co, top, height, col = 0, totalCols = 1, isBeingResized = false, isBeingMoved = false, selectionMode: selModeWA = false, selectable: isSelezionabileWA = false, selected: isSelected = false, operatore, poltrona, onMoveMouse, onMoveTouch, onOpen, onResizeMouse, onResizeTouch, selectionIndicator, readOnly = false }) {
  const widthPct = 100 / totalCols, leftPct = col * widthPct;
  return (                    <div data-appointment-id={a.id} onClick={readOnly ? onOpen : undefined} style={{ position: 'absolute', top, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`, height, background: co, borderRadius: 5, overflow: 'hidden', zIndex: isBeingResized || isBeingMoved ? 10 : 2, borderLeft: `3px solid ${co}DD`, boxShadow: isBeingResized || isBeingMoved ? '0 6px 16px rgba(0,0,0,0.35)' : '0 1px 3px rgba(0,0,0,0.15)', userSelect: 'none', opacity: isBeingMoved ? 0.85 : (selModeWA && !isSelezionabileWA ? 0.35 : 1), outline: isSelected ? '2.5px solid #25D366' : 'none', outlineOffset: -1 }}>
                      {/* Contenuto appuntamento — in modalità selezione tocca per selezionare/deselezionare;
                          altrimenti trascina per spostare l'orario, tocca/clicca senza muovere per aprire il menu azioni */}
                      <div
                        onMouseDown={onMoveMouse}
                        onTouchStart={onMoveTouch}
                        onClick={onOpen}
                        style={{ padding: '2px 5px', cursor: selModeWA ? (isSelezionabileWA ? 'pointer' : 'not-allowed') : (readOnly ? 'pointer' : isBeingMoved ? 'grabbing' : 'grab'), paddingBottom: height > 26 ? 9 : 2, touchAction: readOnly ? 'pan-y' : 'none' }}
                      >
                        {operatore && !selModeWA && (
                          <div title={operatore.nome} style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', background: operatore.colore, border: '1px solid rgba(255,255,255,0.8)' }} />
                        )}
                        {poltrona && !selModeWA && (
                          <div title={poltrona.nome} style={{ position: 'absolute', top: 3, right: operatore ? 13 : 3, width: 7, height: 7, borderRadius: 2, background: poltrona.colore, border: '1px solid rgba(255,255,255,0.8)' }} />
                        )}
                        <div style={{ fontSize: 9, lineHeight: '10px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.ora} {label}</div>
                        {height > 28 && <div style={{ fontSize: 8, lineHeight: '9px', color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tipo}</div>}
                        {height > 44 && <div style={{ fontSize: 8, lineHeight: '9px', color: 'rgba(255,255,255,0.7)' }}>{a.durata} min</div>}
                      </div>
                      {/* Checkbox selezione — solo in modalità invio WhatsApp di massa */}
                      {selModeWA && isSelezionabileWA && (
                        <div style={{ position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: 4, background: isSelected ? '#25D366' : 'rgba(255,255,255,0.85)', border: `1.5px solid ${isSelected ? '#25D366' : 'rgba(0,0,0,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 3 }}>
                          {isSelected && selectionIndicator}
                        </div>
                      )}
                      {/* RESIZE HANDLE - nascosta sugli appuntamenti troppo brevi per contenerla senza sovrapporsi al testo, e comunque disattivata in modalità selezione */}
                      {height > 26 && !selModeWA && <div
                        onMouseDown={onResizeMouse}
                        onTouchStart={onResizeTouch}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderBottomLeftRadius: 5, borderBottomRightRadius: 5, touchAction: readOnly ? 'pan-y' : 'none' }}>
                        <div style={{ width: 16, height: 2, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }} />
                      </div>}
                    </div>);
}

export function useSlotHeight(containerRef, isMobile, slots, slotH, resetKey) {
  const [gridHeight, setGridHeight] = useState(0);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const update = () => setGridHeight(el.clientHeight);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile, resetKey]);

  // effectiveSlotH è l'UNICA altezza-slot usata ovunque su mobile — righe,
  // posizione/durata appuntamenti, now-line, drag, resize, scroll iniziale —
  // per non avere metà codice su slotH e metà su un valore diverso. Se il
  // range orario configurato (slots.length * slotH) è più corto dello
  // spazio reale disponibile, gli slot si espandono uniformemente fino a
  // riempirlo; altrimenti resta lo slotH base e la vista scrolla come
  // sempre. Desktop invariato: usa sempre e solo lo slotH base del padre.
  const effectiveSlotH = isMobile && gridHeight > 0
    ? Math.max(slotH, gridHeight / slots.length)
    : slotH;

  return effectiveSlotH;
}

export function AgendaSwitch({ target, day, view, month, inline = false }) {
  return <a className={`agenda-app-switch${inline ? ' agenda-app-switch-inline' : ''}`} href={agendaDestination(target, day, view, globalThis.location, month)}>Vai a {target === 'studio' ? 'Studio' : 'Personal'} <span aria-hidden="true">↗</span></a>;
}

// Original month list card. Apps provide labels and permitted actions, never clinical services.
export function MonthDetailCard({ palette: C = DEFAULT_PALETTE, co, title, subtitle, badge, time, duration, actions, onClick }) {
  return <div className="pol-card--interactive" onClick={onClick} style={{ background: C.sur, borderRadius: 16, padding: 14, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 20px rgba(15,23,42,.07)', border: `1px solid ${C.brd}`, marginBottom: 8, borderLeft: `4px solid ${co}`, cursor: 'pointer' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ background: co + '20', borderRadius: 7, padding: badge ? '4px 9px' : '4px 7px', textAlign: 'center', flexShrink: 0 }}>
        {badge ? <div style={{ fontSize: 10, fontWeight: 900, color: co, textTransform: 'uppercase' }}>{badge}</div> : <><div style={{ fontSize: 13, fontWeight: 900, color: co }}>{time}</div><div style={{ fontSize: 9, color: co }}>{duration}m</div></>}
      </div>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{title}</div><div style={{ fontSize: 11, color: C.txm }}>{subtitle}</div></div>
      {actions && <div style={{ display: 'flex', gap: 5 }}>{actions}</div>}
    </div>
  </div>;
}
export function MonthDateLabel({ palette: C = DEFAULT_PALETTE, day }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: C.txm, marginBottom: 8 }}>{new Date(day + 'T12:00').toLocaleDateString('it-IT')}</div>;
}

export function MonthToolbar({ date, overlayRef, children, floatingFooter }) {
  return <div ref={overlayRef} className="agenda-mobile-floating-controls"><div className="agenda-mobile-floating-toolbar">
    <span className="agenda-mobile-floating-month">{MESI[date.getMonth()]} {date.getFullYear()}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>{children}</div>
  </div>{floatingFooter}</div>;
}

export function CalendarEmptyState({ palette: C = DEFAULT_PALETTE }) {
  return <div style={{ width: '100%', padding: '32px 16px', borderRadius: 14, textAlign: 'center' }}>
    <div style={{ width: 48, height: 48, margin: '0 auto 12px', borderRadius: 14, display: 'grid', placeItems: 'center', background: C.bg }}><CalendarIcon color={C.txl} /></div>
    <div style={{ color: C.txm, fontSize: 14, fontWeight: 800 }}>Nessun appuntamento</div>
    <div style={{ color: C.txl, marginTop: 4, fontSize: 12, lineHeight: 1.5 }}>Tocca un giorno per aggiungerne uno</div>
  </div>;
}

export function useGridSwipe(days, onSwipeDay, resizing, moving) {
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

  return { onTouchStartSwipe, onTouchEndSwipe };
}
