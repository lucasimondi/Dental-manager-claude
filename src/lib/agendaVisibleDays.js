export { getVisibleWeekDays } from '../../shared/agenda/visibleDays.js';

/**
 * Days the Studio agenda hides (0 = Sunday, 6 = Saturday). Until the user uses the
 * quick "sabato e domenica" toggle (override null) the studio's closing days stay as
 * configured: a studio closed only on Sunday keeps seeing Saturday. "Settimana
 * lavoro" always hides both. Never changes the shared studio settings.
 */
export function agendaHiddenWeekdays({ configured = [], view, override = null }) {
  if (view === 'settimana_lavoro' || override === true) return [...new Set([...configured, 0, 6])];
  if (override === false) return configured.filter((day) => day !== 0 && day !== 6);
  return configured;
}

/** What the quick toggle shows as current state. */
export const weekendsHiddenState = ({ configured = [], override = null }) => override ?? (configured.includes(0) && configured.includes(6));
