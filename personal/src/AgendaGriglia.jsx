// POL-VITA-007 — Giorno e Settimana fedeli all'agenda di Poliedra (src/components/Agenda.jsx,
// versione mobile): pillola del mese e selettore "Settimana ▾" in alto, striscia dei giorni
// con colonna ore da 34 px (tocca un giorno → vista Giorno, scorri → settimana dopo/prima),
// griglia 8–20 a mezz'ore che riempie lo schermo, appuntamenti a blocchi pieni con "ora
// cognome", tipo e durata, impegni personali tratteggiati, linea rossa dell'ora attuale.
// In più rispetto allo studio: una riga sottile per eventi di tutto il giorno e pagamenti.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { daIso, piuGiorni, oggi, minuti, coloreEvento, COLORE_SCADENZA, elementiDelGiorno, inizioSettimana, layoutOverlap, etichettaMese, MESI, giorniSettimana as settimana } from './lib/agenda.js';

const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const ORA_COL = 34; // colonna ore su telefono, come nello studio
const SLOT_MIN = 30;

export function ViewPicker({ view, setView }) {
  const [open, setOpen] = useState(false);
  const LABEL = { giorno: 'Giorno', settimana: 'Settimana', mese: 'Mese' };
  return (
    <div className="ag-picker">
      <button className="ag-picker-pillola" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        {LABEL[view]}
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: open ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div className="ag-picker-velo" onClick={() => setOpen(false)} />}
      {open && (
        <div className="ag-picker-menu" role="menu">
          {['giorno', 'settimana', 'mese'].map((v) => (
            <button key={v} role="menuitem" className={view === v ? 'attivo' : ''} onClick={() => { setView(v); setOpen(false); }}>{LABEL[v]}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Striscia dei giorni: 5 settimane affiancate, si scorre a scatti; quella al centro è la mostrata.
function DayStrip({ giorno, settimanale, onScegli, onSettimana, segni }) {
  const ref = useRef(null);
  const base = inizioSettimana(giorno);
  const timer = useRef(null);
  const settimane = settimanale ? [-2, -1, 0, 1, 2].map((n) => settimana(piuGiorni(base, n * 7))) : [[giorno]];
  useLayoutEffect(() => { const el = ref.current; if (el && settimanale) el.scrollLeft = el.clientWidth * 2; }, [base, settimanale]);
  const onScroll = () => {
    if (!settimanale) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el || !el.clientWidth) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i !== 2) onSettimana(i - 2);
    }, 120);
  };
  return (
    <div className="ag-striscia">
      <div className="ag-striscia-gutter" style={{ width: ORA_COL }} />
      <div className="ag-striscia-scorri" ref={ref} onScroll={onScroll} style={{ overflowX: settimanale ? 'auto' : 'hidden' }}>
        {settimane.map((sett, wi) => (
          <div key={wi} className="ag-striscia-settimana" style={{ gridTemplateColumns: `repeat(${sett.length}, minmax(0, 1fr))` }}>
            {sett.map((ds) => {
              const d = daIso(ds);
              const eOggi = ds === oggi();
              const scelto = !settimanale && ds === giorno;
              return (
                <button key={ds} className="ag-giorno" onClick={() => onScegli(ds)} aria-label={d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}>
                  <span className={`ag-giorno-nome${eOggi ? ' oggi' : ''}`}>{WD_SHORT[d.getDay()]}</span>
                  <span className={`ag-giorno-numero${eOggi ? ' oggi' : ''}${scelto && !eOggi ? ' scelto' : ''}`}>{d.getDate()}</span>
                  <span className="ag-giorno-segni">{(segni[ds] || []).slice(0, 3).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GrigliaPoliedra({ view, setView, giorno, setGiorno, dati, ctx, etichette, coloriTipi }) {
  const settimanale = view === 'settimana';
  const giorni = settimanale ? settimana(giorno) : [giorno];
  const contenitore = useRef(null);
  const pagina = useRef(null);
  const [altezzaGriglia, setAltezzaGriglia] = useState(0);
  const [altezzaPagina, setAltezzaPagina] = useState(null);
  const [adesso, setAdesso] = useState(new Date());

  // Orario 8–20 come lo studio, allargato se c'è qualcosa prima o dopo.
  const minuti_ = giorni.flatMap((g) => elementiDelGiorno(g, dati).aOrario.flatMap((x) => [x.inizio, x.fine]));
  const oraInizio = Math.min(8, ...minuti_.map((m) => Math.floor(m / 60)));
  const oraFine = Math.max(20, ...minuti_.map((m) => Math.ceil(m / 60)));
  const slots = [];
  for (let h = oraInizio; h < oraFine; h += 1) for (let m = 0; m < 60; m += SLOT_MIN) slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

  // La pagina occupa lo spazio tra la testata e il dock; la griglia riempie il resto.
  useLayoutEffect(() => {
    const calcola = () => {
      const el = pagina.current;
      if (!el) return;
      const dock = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pp-dock')) || 62;
      const sotto = dock + (parseFloat(getComputedStyle(el).getPropertyValue('--ag-sicura')) || 0) + 8;
      setAltezzaPagina(Math.max(380, window.innerHeight - el.getBoundingClientRect().top - sotto));
      if (contenitore.current) setAltezzaGriglia(contenitore.current.clientHeight);
    };
    calcola();
    window.addEventListener('resize', calcola);
    return () => window.removeEventListener('resize', calcola);
  }, []);
  useLayoutEffect(() => { if (contenitore.current) setAltezzaGriglia(contenitore.current.clientHeight); }, [altezzaPagina]);
  useEffect(() => { const t = setInterval(() => setAdesso(new Date()), 60000); return () => clearInterval(t); }, []);

  const slotH = Math.max(22, altezzaGriglia ? altezzaGriglia / slots.length : 22);
  const nowMin = adesso.getHours() * 60 + adesso.getMinutes() - oraInizio * 60;
  const nowTop = (nowMin / SLOT_MIN) * slotH;
  const mostraAdesso = nowMin >= 0 && nowMin <= slots.length * SLOT_MIN;
  useEffect(() => {
    if (contenitore.current) contenitore.current.scrollTop = mostraAdesso ? Math.max(0, nowTop - slotH * 2) : 0;
  }, [slotH, giorno, view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scorrere a destra/sinistra sulla griglia: giorno o settimana successivi, come nello studio.
  const swipe = useRef(null);
  const passo = settimanale ? 7 : 1;
  const onTouchStart = (e) => { swipe.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; };
  const onTouchEnd = (e) => {
    const s = swipe.current; swipe.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x; const dy = t.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setGiorno(piuGiorni(giorno, (dx < 0 ? 1 : -1) * passo));
  };

  // Segni sotto i numeri della striscia: pagamenti (ambra) ed eventi di tutto il giorno.
  const segni = {};
  const inAlto = giorni.map((g) => {
    const el = elementiDelGiorno(g, dati);
    segni[g] = [...el.scadenze.map(() => COLORE_SCADENZA), ...el.tuttoIlGiorno.map((e) => coloreEvento(e, etichette))];
    return { g, el };
  });
  const conRigaAlta = inAlto.some(({ el }) => el.scadenze.length || el.tuttoIlGiorno.length);
  const nuovo = (ds, slot) => ctx.apri({ tipo: 'evento', evento: { data_inizio: ds, ora_inizio: slot, ora_fine: `${String(Math.floor((minuti(slot) + 60) / 60) % 24).padStart(2, '0')}:${slot.slice(3)}` } });

  return (
    <div className="ag-pagina" ref={pagina} style={altezzaPagina ? { height: altezzaPagina } : undefined}>
      <div className="ag-barra">
        <button className="ag-mese" onClick={() => setGiorno(oggi())} title="Torna a oggi">{settimanale ? etichettaMese(inizioSettimana(giorno)) : `${MESI[daIso(giorno).getMonth()]} ${daIso(giorno).getFullYear()}`}</button>
        <span className="ag-barra-destra">
          {giorno !== oggi() && !giorni.includes(oggi()) && <button className="ag-oggi" onClick={() => setGiorno(oggi())}>Oggi</button>}
          <ViewPicker view={view} setView={setView} />
        </span>
      </div>
      <DayStrip giorno={giorno} settimanale={settimanale} segni={segni}
        onScegli={(ds) => { setGiorno(ds); if (settimanale) setView('giorno'); }}
        onSettimana={(n) => setGiorno(piuGiorni(inizioSettimana(giorno), n * 7))} />
      {conRigaAlta && (
        <div className="ag-alto">
          <div style={{ width: ORA_COL, flexShrink: 0 }} />
          {inAlto.map(({ g, el }) => (
            <div key={g} className="ag-alto-giorno">
              {el.tuttoIlGiorno.map((e) => (
                <button key={e.id} className="ag-alto-voce" style={{ '--c': coloreEvento(e, etichette) }} onClick={() => ctx.apri({ tipo: 'evento', evento: e })}>{e.titolo}</button>
              ))}
              {el.scadenze.map((s) => (
                <button key={s.id} className={`ag-alto-voce ag-alto-scadenza${s.completata ? ' fatta' : ''}`} style={{ '--c': COLORE_SCADENZA }} onClick={() => ctx.apri({ tipo: 'pagamento', s })}>€ {s.descrizione}</button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="ag-superficie" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="ag-scorri" ref={contenitore}>
          <div className="ag-tempo" style={{ minHeight: slots.length * slotH }}>
            <div className="ag-ore" style={{ width: ORA_COL }}>
              {slots.map((slot) => {
                const intera = slot.endsWith(':00');
                return <div key={slot} className={`ag-ora${intera ? ' intera' : ''}`} style={{ height: slotH }}><span>{intera ? slot : ''}</span></div>;
              })}
            </div>
            <div className="ag-giorni">
              {inAlto.map(({ g: ds, el }, di) => {
                const eOggi = ds === oggi();
                return (
                  <div key={ds} className="ag-colonna" style={{ borderLeft: di > 0 ? undefined : 'none' }}>
                    {slots.map((slot) => (
                      <div key={slot} className={`ag-slot${slot.endsWith(':00') ? ' intera' : ''}`} style={{ height: slotH }} onClick={() => nuovo(ds, slot)} />
                    ))}
                    {eOggi && mostraAdesso && (
                      <div className="ag-adesso" style={{ top: nowTop, left: di === 0 ? -6 : 0 }}>{di === 0 && <i />}<b /></div>
                    )}
                    {layoutOverlap(el.aOrario.map((x) => ({ ...x, start: x.inizio, end: Math.max(x.fine, x.inizio + 1) }))).map((x) => {
                      const top = ((x.inizio - oraInizio * 60) / SLOT_MIN) * slotH;
                      const larg = 100 / x.totalCols;
                      if (x.tipo === 'evento') {
                        const e = x.dato;
                        const co = coloreEvento(e, etichette);
                        const height = Math.max(((x.fine - x.inizio) / SLOT_MIN) * slotH, slotH * 0.5);
                        return (
                          <button key={x.id} className="ag-impegno" title={e.titolo} onClick={(ev) => { ev.stopPropagation(); ctx.apri({ tipo: 'evento', evento: e }); }}
                            style={{ top, height, left: `calc(${x.col * larg}% + 2px)`, width: `calc(${larg}% - 4px)`, '--c': co }}>
                            <span>{e.titolo}</span>
                          </button>
                        );
                      }
                      const a = x.dato;
                      const co = a.colore || coloriTipi[a.tipo] || '#185FA5';
                      const height = Math.max((Number(a.durata || 30) / SLOT_MIN) * slotH - 2, slotH * 0.6);
                      return (
                        <button key={x.id} className="ag-app" onClick={(ev) => { ev.stopPropagation(); ctx.apri({ tipo: 'appuntamento', a }); }}
                          style={{ top, height, left: `calc(${x.col * larg}% + 2px)`, width: `calc(${larg}% - 4px)`, '--c': co }}>
                          <span className="ag-app-1">{String(a.ora || '').slice(0, 5)} {a.cognome || a.paziente || '—'}</span>
                          {height > 28 && <span className="ag-app-2">{a.tipo}</span>}
                          {height > 44 && <span className="ag-app-3">{a.durata} min</span>}
                        </button>
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
  );
}

