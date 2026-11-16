// DOCK-UGUALE (PO 2026-11-16): le icone del dock sono le stesse di Studio (src/components/ui/Ic.jsx:
// cal, folder, brief, user), ricopiate qui perché Personal non importa codice dello studio.
import CalendarIcon from '../../shared/agenda/CalendarIcon.jsx';

const traccia = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const DISEGNI = {
  folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  brief: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
};

export function IconaDock({ n, s = 22 }) {
  if (n === 'cal') return <CalendarIcon size={s} color="currentColor" />;
  const d = DISEGNI[n];
  return d ? <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...traccia}>{d}</svg> : null;
}
