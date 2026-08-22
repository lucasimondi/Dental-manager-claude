import React from 'react';
import { Ic } from '../ui';

const formatDay = (date) => new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
}).format(date).replace('.', '').toUpperCase();

export default function MobileAgendaHeader({
  date, isToday, onPrevious, onNext, onToday, theme, onToggleTheme,
}) {
  return (
    <header className="agenda-lab__header">
      <div className="agenda-lab__header-row">
        <button type="button" className="agenda-lab__icon-button" onClick={onPrevious} aria-label="Giorno precedente">
          <Ic n="back" s={22} c="currentColor" />
        </button>
        <div className="agenda-lab__date-block" aria-live="polite">
          <strong>{formatDay(date)}</strong>
          <button
            type="button"
            className={`agenda-lab__today${isToday ? ' is-current' : ''}`}
            onClick={onToday}
          >
            Oggi
          </button>
        </div>
        <button type="button" className="agenda-lab__icon-button" onClick={onNext} aria-label="Giorno successivo">
          <span className="agenda-lab__next-icon"><Ic n="back" s={22} c="currentColor" /></span>
        </button>
      </div>
      <div className="agenda-lab__meta">
        <span>Agenda Lab · dati demo</span>
        <button type="button" className="agenda-lab__theme-button" onClick={onToggleTheme} aria-label={`Attiva tema ${theme === 'dark' ? 'chiaro' : 'scuro'}`}>
          <Ic n={theme === 'dark' ? 'sun' : 'moon'} s={16} c="currentColor" />
        </button>
      </div>
    </header>
  );
}

