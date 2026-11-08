import React, { useState } from 'react';
import { labelColor } from './labelPalette.js';
// Impegni del giorno (senza orario): restano flottanti sopra la griglia, in Studio e in Personal.
// In settimana le colonne sono strette: una riga per impegno, troncata, al massimo due visibili
// e "+N" per vedere gli altri di quel giorno (HOME-AGENDA-CENTRIC).
const VISIBILI_SETTIMANA = 2;
export default function DayEvents({ days, gutter = 34 }) {
  const [aperti, setAperti] = useState(() => new Set());
  if (!days.some(d => d.items.length)) return null;
  const settimana = days.length > 1;
  return <div className={`agenda-day-events${settimana ? ' agenda-day-events--week' : ''}`} aria-label="Impegni e scadenze del giorno" style={{ gridTemplateColumns: `${gutter}px repeat(${days.length}, minmax(0, 1fr))` }}>
    <div aria-hidden="true" />
    {days.map(day => {
      const tutti = settimana && aperti.has(day.date);
      const visibili = settimana && !tutti ? day.items.slice(0, VISIBILI_SETTIMANA) : day.items;
      const nascosti = day.items.length - visibili.length;
      return <div key={day.date} className="agenda-day-events-column" aria-label={day.date}>
        {visibili.map(item => <button key={item.id} type="button" style={{ '--event-color': labelColor(item.color) }} title={item.title} onClick={item.onOpen}>{item.title}</button>)}
        {nascosti > 0 && <button type="button" className="agenda-day-events-more" aria-label={`Mostra altri ${nascosti} impegni`} onClick={() => setAperti(s => new Set(s).add(day.date))}>+{nascosti}</button>}
      </div>;
    })}
  </div>;
}
