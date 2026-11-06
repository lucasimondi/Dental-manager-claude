import React, { useEffect, useMemo, useRef, useState } from 'react';
import Ic from './ui/Ic.jsx';
import { supabase } from '../lib/supabase.js';
import { buildHomeToday, fromMinutes } from '../lib/homeToday.js';
import { APPOINTMENT_PATIENT_ACTIONS } from '../lib/appointmentQuickHub.js';
import { labelColor } from '../../shared/agenda/labelPalette.js';

/* HOME-AGENDA-CENTRIC — centro della Home: la giornata di oggi su una
   griglia oraria (per poltrona quando lo studio le usa) e, a lato, il
   paziente in poltrona adesso con le stesse quattro azioni dell'agenda
   (Prestazione, Ricetta, Documenti, Incasso). Ogni azione riusa gli
   handler esistenti passati da Dashboard/App: nessuna scrittura qui. */

const HOUR_PX = 60;
const ACTION_ICON = { treatment: 'tooth', prescription: 'file', documents: 'folder', payment: 'eur' };

function useChairs(features, si) {
  const [chairs, setChairs] = useState([]);
  useEffect(() => {
    if (!features?.multi_operatore || !si?.studio_id) { setChairs([]); return undefined; }
    let cancelled = false;
    // Stessa lettura (tabella, filtri, ordinamento) già usata da Agenda.jsx.
    supabase.from('poltrone').select('*').eq('studio_id', si.studio_id).eq('attivo', true).order('created_at')
      .then(({ data }) => { if (!cancelled) setChairs(data || []); }, () => {});
    return () => { cancelled = true; };
  }, [features?.multi_operatore, si?.studio_id]);
  return chairs;
}

export default function HomeToday({ today, now, appointments, patients, getColore, features, si, onOpenAgenda, onOpenAppointment, onNewAppointment, onPatientAction, onOpenPatient, children }) {
  const chairs = useChairs(features, si);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const day = useMemo(() => buildHomeToday({ appointments, patients, today, nowMinutes, poltrone: chairs }),
    [appointments, patients, today, nowMinutes, chairs]);
  const { range, columns, current, next } = day;
  const height = ((range.end - range.start) / 60) * HOUR_PX;
  const hours = [];
  for (let m = range.start; m <= range.end; m += 60) hours.push(m);
  const nowTop = nowMinutes >= range.start && nowMinutes <= range.end ? ((nowMinutes - range.start) / 60) * HOUR_PX : null;

  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = nowTop != null ? nowTop - 2 * HOUR_PX : (day.items[0] ? ((day.items[0].start - range.start) / 60) * HOUR_PX - HOUR_PX / 2 : 0);
    el.scrollTop = Math.max(0, target);
    // Solo all'apertura della Home: dopo, lo scroll resta all'utente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focus = current || next;
  const dateLabel = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="home-oggi__layout">
      <section className="home-oggi__agenda" aria-label="Agenda di oggi" data-testid="home-today-agenda">
        <header className="home-oggi__agenda-head">
          <div>
            <h2 className="home-oggi__title">{dateLabel}</h2>
            <p className="home-oggi__sub">
              {day.total === 0 ? 'Nessun appuntamento oggi'
                : `${day.total} appuntament${day.total === 1 ? 'o' : 'i'} · ${day.remaining} ancora da fare`}
            </p>
          </div>
          <button type="button" className="home-oggi__link" onClick={onOpenAgenda}>Apri agenda <span aria-hidden="true">›</span></button>
        </header>

        {columns.length > 1 && (
          <div className="home-oggi__chairs" style={{ gridTemplateColumns: `44px repeat(${columns.length}, minmax(0, 1fr))` }} aria-hidden="true">
            <span />
            {columns.map((col) => <span key={col.id} className="home-oggi__chair">{col.label}</span>)}
          </div>
        )}

        <div className="home-oggi__scroll" ref={scrollRef}>
          <div className="home-oggi__grid" style={{ height, gridTemplateColumns: `44px repeat(${columns.length}, minmax(0, 1fr))` }}>
            <div className="home-oggi__hours" aria-hidden="true">
              {hours.map((m) => (
                <span key={m} style={{ top: ((m - range.start) / 60) * HOUR_PX }}>{fromMinutes(m)}</span>
              ))}
            </div>
            {columns.map((col) => (
              <div key={col.id} className="home-oggi__col">
                {hours.map((m) => <span key={m} className="home-oggi__line" style={{ top: ((m - range.start) / 60) * HOUR_PX }} />)}
                {col.items.map((it) => {
                  const co = labelColor(getColore(it.a));
                  const top = ((it.start - range.start) / 60) * HOUR_PX + 1;
                  const h = Math.max(((it.end - it.start) / 60) * HOUR_PX - 2, 20);
                  const width = 100 / it.totalCols;
                  // Tre livelli di dettaglio in base all'altezza disponibile,
                  // così il testo non si sovrappone mai nei blocchi brevi.
                  const density = h < 34 ? 'line' : h < 58 ? 'two' : 'full';
                  return (
                    <button type="button" key={it.a.id}
                      className={`home-oggi__ev home-oggi__ev--${it.when} home-oggi__ev--${density}`}
                      style={{ top, height: h, left: `calc(${it.col * width}% + 4px)`, width: `calc(${width}% - 8px)`, '--ev': co }}
                      onClick={() => onOpenAppointment(it.a)}
                      aria-label={`${it.a.ora} ${it.name}${it.a.tipo ? ` · ${it.a.tipo}` : ''}`}>
                      {density === 'line' && (
                        <span className="home-oggi__ev-line"><strong>{it.name}</strong> <span className="home-oggi__ev-time">{it.a.ora}</span></span>
                      )}
                      {density === 'two' && (
                        <>
                          <strong>{it.name}</strong>
                          <span className="home-oggi__ev-type"><span className="home-oggi__ev-time">{it.a.ora}</span>{it.a.tipo ? ` · ${it.a.tipo}` : ''}</span>
                        </>
                      )}
                      {density === 'full' && (
                        <>
                          <span className="home-oggi__ev-time">{it.a.ora}–{fromMinutes(it.end)}</span>
                          <strong>{it.name}</strong>
                          {it.a.tipo && <span className="home-oggi__ev-type">{it.a.tipo}</span>}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            {nowTop != null && (
              <div className="home-oggi__now" style={{ top: nowTop }} aria-hidden="true"><span>{fromMinutes(nowMinutes)}</span></div>
            )}
          </div>
          {day.total === 0 && (
            <div className="home-oggi__empty">
              <p>La giornata è libera.</p>
              <button type="button" className="home-oggi__btn home-oggi__btn--pri" onClick={onNewAppointment}><Ic n="plus" s={15} />Nuovo appuntamento</button>
            </div>
          )}
        </div>
      </section>

      <aside className="home-oggi__side">
        {focus && (
          <section className={`home-oggi__now-card${current ? ' is-live' : ''}`} aria-label={current ? 'In poltrona ora' : 'Prossimo appuntamento'} data-testid="home-today-now">
            <div className="home-oggi__eyebrow">{current ? <><i aria-hidden="true" />In poltrona ora</> : `Prossimo · ${focus.a.ora}`}</div>
            <button type="button" className="home-oggi__patient" onClick={() => focus.patient && onOpenPatient(focus.patient)} disabled={!focus.patient}>
              <span className="home-oggi__avatar" aria-hidden="true">{(focus.patient?.nome?.[0] || '') + (focus.patient?.cognome?.[0] || '') || '·'}</span>
              <span className="home-oggi__patient-text">
                <strong>{focus.name}</strong>
                <span>{[focus.a.tipo, `${focus.a.ora}–${fromMinutes(focus.end)}`].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
            {focus.patient && (
              <div className="home-oggi__actions">
                {APPOINTMENT_PATIENT_ACTIONS.map((action) => (
                  <button type="button" key={action.id} onClick={() => onPatientAction(focus.patient, focus.a, action.id)}>
                    <Ic n={ACTION_ICON[action.id] || action.icon} s={19} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            )}
            {current && next && (
              <p className="home-oggi__after">Dopo: <strong>{next.a.ora} {next.name}</strong>{next.a.tipo ? ` · ${next.a.tipo}` : ''}</p>
            )}
          </section>
        )}
        {children}
      </aside>
    </div>
  );
}
