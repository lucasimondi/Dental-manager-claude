import React from 'react';
export default function DayEvents({ days, gutter = 34 }) {
  if (!days.some(d => d.items.length)) return null;
  return <div className="agenda-day-events" aria-label="Impegni e scadenze del giorno" style={{ gridTemplateColumns: `${gutter}px repeat(${days.length}, minmax(0, 1fr))` }}>
    <div aria-hidden="true" />
    {days.map(day => <div key={day.date} className="agenda-day-events-column" aria-label={day.date}>
      {day.items.map(item => <button key={item.id} type="button" style={{ '--event-color': item.color || '#64748b' }} title={item.title} onClick={item.onOpen}>{item.title}</button>)}
    </div>)}
  </div>;
}
