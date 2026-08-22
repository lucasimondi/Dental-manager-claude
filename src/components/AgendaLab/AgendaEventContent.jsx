import React from 'react';
import { agendaStatusLabel } from './demoAgendaData';

const timeText = (date) => new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
}).format(date);

export default function AgendaEventContent({ event }) {
  const duration = event.end ? (event.end.getTime() - event.start.getTime()) / 60000 : 30;
  const props = event.extendedProps;
  const compact = duration <= 20;

  if (compact) {
    return (
      <div className="agenda-event agenda-event--compact">
        <span className="agenda-event__dot" aria-hidden="true" />
        <strong>{props.patientName}</strong>
        <span>· {timeText(event.start)}</span>
      </div>
    );
  }

  return (
    <div className="agenda-event">
      <div className="agenda-event__topline">
        <strong>{props.patientName}</strong>
        <span className="agenda-event__badge">{agendaStatusLabel(props.status)}</span>
      </div>
      <span className="agenda-event__treatment">{props.treatment}</span>
      <span className="agenda-event__time">{timeText(event.start)} – {timeText(event.end)}</span>
    </div>
  );
}

