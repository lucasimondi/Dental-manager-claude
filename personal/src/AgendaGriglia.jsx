import { layoutAppointments } from '../../shared/agenda/geometry.js';
import { euro } from './lib/coreArchivio.js';
// POL-VITA-010: Personal adapter; original presentation is owned by shared/agenda.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DayStrip, ViewPicker, TimeGrid, MonthCalendar, AppointmentBlock, EventBlock, useSlotHeight, AgendaSwitch, MonthDetailCard, MonthDateLabel, MonthToolbar, CalendarEmptyState } from '../../shared/agenda/AgendaPresentation.jsx';
import { getVisibleWeekDays } from '../../shared/agenda/visibleDays.js';
import { useSwipeAgenda } from './lib/swipeAgenda.js';
import { usePinchZoom, scrollAncorato } from './lib/pinchZoom.js';
import { daIso, piuGiorni, oggi, coloreEvento, nomeEtichetta, elementiDelGiorno, giorniSettimana } from './lib/agenda.js';
export { ViewPicker };

const GIORNI_NASCOSTI_PERSONAL = [];

export function GrigliaPoliedra({ view, setView, giorno, setGiorno, mese, setMese, dati, ctx, etichette, coloriTipi }) {
  const [localMonth, setLocalMonth] = useState(giorno);
  const month = mese || localMonth, changeMonth = setMese || setLocalMonth;
  const weekly = view === 'settimana' || view === 'settimana_lavoro';
  const [weekendsHidden, setWeekendsHidden] = useState(false);
  // La scelta rapida è solo locale alla schermata: non cambia l'orario/configurazione
  // condivisa dello studio. Settimana lavoro nasconde sempre sabato e domenica.
  const { slotMin = 30, zoom = 1 } = dati.settings || {};
  const hiddenWeekdays = view === 'settimana_lavoro' || weekendsHidden ? [0, 6] : GIORNI_NASCOSTI_PERSONAL;
  const oraInizio = 0, oraFine = 24;
  const days = weekly ? getVisibleWeekDays(daIso(giorniSettimana(giorno)[0]), hiddenWeekdays) : [daIso(giorno)];
  const slots = [];
  for (let h = oraInizio; h < oraFine; h++) for (let m = 0; m < 60; m += slotMin) slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  const containerRef = useRef(null), overlayRef = useRef(null);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const [availH, setAvailH] = useState(() => Math.max(360, window.innerHeight - 126));
  const [now, setNow] = useState(new Date());
  // PO 2026-10-17: slot come prima ("troppo alti") e, per gli appuntamenti corti,
  // pinch-to-zoom con due dita: pinch 1 è l'altezza di sempre.
  const [pinch, ancoraPinch] = usePinchZoom(containerRef, view !== 'mese');
  const slotH = Math.round(Math.max(24, availH / slots.length * zoom) * pinch);
  const effectiveSlotH = useSlotHeight(containerRef, true, slots, slotH, view);
  const slotHPrima = useRef(effectiveSlotH);
  useLayoutEffect(() => {
    const el = containerRef.current, a = ancoraPinch.current;
    ancoraPinch.current = null;
    if (el && a && slotHPrima.current !== effectiveSlotH) {
      const grid = el.querySelector('.agenda-time-grid');
      const gridTop = grid ? grid.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop : 0;
      el.scrollTop = scrollAncorato({ scrollTop: a.scrollTop, y: a.y, gridTop, oldSlotH: slotHPrima.current, newSlotH: effectiveSlotH });
    }
    slotHPrima.current = effectiveSlotH;
  }, [effectiveSlotH]);
  useEffect(() => {
    const resize = () => setAvailH(Math.max(360, window.innerHeight - 126));
    window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize);
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => { clearInterval(timer); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize); };
  }, []);
  useLayoutEffect(() => {
    if (!overlayRef.current) return;
    const update = () => setOverlayHeight(Math.ceil(overlayRef.current.getBoundingClientRect().height));
    update(); const observer = new ResizeObserver(update); observer.observe(overlayRef.current);
    return () => observer.disconnect();
  }, [view]);
  const nowMin = now.getHours() * 60 + now.getMinutes() - oraInizio * 60;
  const nowTop = nowMin / slotMin * effectiveSlotH;
  const showNowLine = nowMin >= 0 && nowMin <= slots.length * slotMin;
  useEffect(() => { if (containerRef.current) containerRef.current.scrollTop = showNowLine ? Math.max(0, nowTop - effectiveSlotH * 2) : 0; }, [giorno, view]);
  // POL-VITA-008: "Vai a Studio" accanto al selettore della vista, alla sua sinistra.
  const appSwitch = <AgendaSwitch inline target="studio" day={giorno} month={month} view={view} />;
  const pick = <span className="personal-agenda-azioni">{appSwitch}<ViewPicker view={view} setView={setView} touchSafe weekendsHidden={weekendsHidden || view === 'settimana_lavoro'} onToggleWeekends={() => setWeekendsHidden(hidden => !hidden)} /></span>;
  const navigate = n => setGiorno(piuGiorni(giorno, n * (weekly ? 7 : 1)));
  // DayStrip notifica anche al primo mount la settimana che sta mostrando.
  // In Personal ignoriamo quella prima notifica: altrimenti il 16 diventa lunedì 12.
  const skipWeekSync = useRef(true);
  const lastViewForWeekSync = useRef(view);
  if (lastViewForWeekSync.current !== view) {
    lastViewForWeekSync.current = view;
    if (view === 'settimana') skipWeekSync.current = true;
  }
  const sincronizzaSettimana = (weekStart) => {
    if (skipWeekSync.current) {
      skipWeekSync.current = false;
      return;
    }
    // Conserva il giorno della settimana selezionato: se sto guardando venerdì,
    // passare alla settimana successiva deve portarmi al venerdì successivo, non al lunedì.
    const offset = (daIso(giorno).getDay() + 6) % 7;
    setGiorno(piuGiorni(weekStart, offset));
  };
  // POL-VITA-009: la griglia segue il dito e cambia giorno o settimana (anche fuori dalla striscia).
  const swipe = useSwipeAgenda(containerRef, navigate, view !== 'mese');
  const monthNavigate = n => { const d = daIso(month); d.setMonth(d.getMonth() + n, 1); changeMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`); };
  const openSlot = (ds, slot) => ctx.apri({ tipo: 'evento', evento: { data_inizio: ds, ora_inizio: slot, ora_fine: Number(slot.slice(0,2)) === 23 ? '23:59' : `${String(Number(slot.slice(0,2)) + 1).padStart(2,'0')}:${slot.slice(3)}` } });
  const renderDay = ds => {
    const el = elementiDelGiorno(ds, dati);
    return <>
      {el.aOrario.filter(x => x.tipo === 'evento').map(x => {
        const top = (x.inizio - oraInizio * 60) / slotMin * effectiveSlotH;
        const height = Math.max((x.fine - x.inizio) / slotMin * effectiveSlotH, effectiveSlotH * .5);
        if (top + height < 0 || top >= slots.length * effectiveSlotH) return null;
        return <EventBlock key={x.id} title={x.dato.titolo} startTime={(x.dato.ora_inizio || '').slice(0, 5)} description={x.dato.note || ''} aCapo={weekly} top={top} height={height} co={coloreEvento(x.dato, etichette)} onClick={() => ctx.apri({ tipo: 'evento', evento: x.dato })} />;
      })}
      {layoutAppointments(dati.appuntamenti.filter(a => a.data === ds).sort((a,b) => a.ora.localeCompare(b.ora))).map(x => {
        const a = x.a, top = (x.start - oraInizio * 60) / slotMin * effectiveSlotH;
        if (top < 0 || top >= slots.length * effectiveSlotH) return null;
        return <AppointmentBlock key={a.id} a={a} label={weekly ? (a.cognome ? [a.cognome, String(a.paziente || '').replace(a.cognome, '').trim()].filter(Boolean).join(' ') : (a.paziente || a.tipo || '—')) : (a.cognome || a.paziente || '—')} aCapo={weekly} co={a.colore || coloriTipi[a.tipo] || '#185FA5'} top={top} height={Math.max(Number(a.durata) / slotMin * effectiveSlotH - 2, effectiveSlotH * .6)} col={x.col} totalCols={x.totalCols} readOnly onOpen={e => { e.stopPropagation(); ctx.apri({ tipo: 'appuntamento', a }); }} />;
      })}
    </>;
  };
  const extras = elementiDelGiorno(giorno, dati);
  // La fascia degli eventi di tutto il giorno usa le stesse colonne della griglia oraria,
  // incluse le giornate nascoste: ogni impegno resta sopra il proprio giorno.
  const visibleExtras = days.map(d => {
    const day = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { day, ...elementiDelGiorno(day, dati) };
  });
  // POL-VITA-008: eventi di tutto il giorno e scadenze flottano subito sotto la striscia dei giorni,
  // dentro i controlli flottanti: la griglia scorre sotto di loro e solo le pillole sono toccabili.
  const fasciaGiorno = visibleExtras.some(e => e.scadenze.length || e.tuttoIlGiorno.length)
    ? <div className="personal-agenda-extras" aria-label="Scadenze ed eventi del giorno" style={{ gridTemplateColumns: `34px repeat(${days.length}, minmax(0, 1fr))` }}>
      <div aria-hidden="true" className="personal-agenda-extras-gutter" />
      {visibleExtras.map(el => <div key={el.day} className="personal-agenda-extras-day" aria-label={daIso(el.day).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}>
        {el.scadenze.map(s => <button key={`${el.day}-s-${s.id}`} title={s.descrizione} onClick={() => ctx.apri({ tipo: 'pagamento', s })}>€ {s.descrizione}</button>)}
        {el.tuttoIlGiorno.map(evento => <button key={`${el.day}-e-${evento.id}`} title={evento.titolo} onClick={() => ctx.apri({ tipo: 'evento', evento })}>{evento.titolo}</button>)}
      </div>)}
    </div>
    : null;
  return <div className="agenda-mobile-page" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', '--agenda-mobile-overlay-clearance': `${overlayHeight}px` }}>
    {view === 'mese' ? <>
      <MonthToolbar date={daIso(month)} overlayRef={overlayRef}><button onClick={() => changeMonth(oggi())} style={{ background: '#E6F1FB', border: 'none', borderRadius: 14, padding: '5px 10px', color: '#185FA5', fontWeight: 700, fontSize: 10 }}>Oggi</button>{pick}</MonthToolbar>
      <div className="agenda-mobile-month-surface"><MonthCalendar date={daIso(month)} selDay={giorno} today={oggi()} onNavigate={monthNavigate} onSelect={ds => { setGiorno(ds); setView('giorno'); }} daySummary={ds => { const el = elementiDelGiorno(ds, dati); return { count: el.aOrario.filter(x => x.tipo === 'appuntamento').length, marks: [...el.scadenze.map(s => ({ id: `scadenza-${s.id}`, colore: '#b54708' })), ...el.tuttoIlGiorno, ...el.aOrario.filter(x => x.tipo === 'evento').map(x => x.dato)].map(e => ({ id: e.id, colore: e.colore || coloreEvento(e, etichette) })) }; }} />
        {[...extras.tuttoIlGiorno, ...extras.aOrario.filter(x => x.tipo === 'evento').map(x => x.dato)].map(e => <MonthDetailCard key={e.id} co={coloreEvento(e, etichette)} title={e.titolo} badge={nomeEtichetta(e.tipo, etichette)} subtitle={e.tutto_il_giorno ? 'Tutto il giorno' : `${(e.ora_inizio || '').slice(0,5)} – ${(e.ora_fine || '').slice(0,5)}`} onClick={() => ctx.apri({ tipo: 'evento', evento: e })} />)}
        {extras.scadenze.map(s => <MonthDetailCard key={'scadenza-' + s.id} co="#b45309" title={s.descrizione} subtitle={(s.completata ? 'Pagato' : 'Scadenza') + (s.importo != null ? ' · ' + euro(s.importo) : '')} onClick={() => ctx.apri({ tipo: 'pagamento', s })} />)}
        <MonthDateLabel day={giorno} />
        {extras.aOrario.filter(x => x.tipo === 'appuntamento').map(({ dato: a }) => <MonthDetailCard key={a.id} co={a.colore || coloriTipi[a.tipo] || '#185FA5'} title={a.paziente || a.cognome || '—'} subtitle={a.tipo} time={a.ora} duration={a.durata} onClick={() => ctx.apri({ tipo: 'appuntamento', a })} />)}
        {!extras.aOrario.some(x => x.tipo === 'appuntamento') && <CalendarEmptyState />}
      </div>
    </> : <>
      <DayStrip selDay={giorno} setSelDay={ds => { setGiorno(ds); if (weekly) setView('giorno'); }} today={oggi()} compact oraColW={34} singleDay={!weekly} hiddenWeekdays={hiddenWeekdays} highlightSelected={!weekly} onWeekChange={weekly ? sincronizzaSettimana : undefined} overlayRef={overlayRef} viewPicker={pick} floatingFooter={fasciaGiorno} shortMonth />
      <div className="agenda-mobile-grid-surface" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} {...swipe}>
        <TimeGrid containerRef={containerRef} isMobile slots={slots} slotH={slotH} effectiveSlotH={effectiveSlotH} oraColW={34} days={days} today={oggi()} showNowLine={showNowLine} nowTop={nowTop} onSlot={openSlot} renderDay={renderDay} />
      </div>
    </>}
  </div>;
}
