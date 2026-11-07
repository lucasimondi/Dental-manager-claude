// HOME-AGENDA-CENTRIC — riga di sintesi sotto il mese, su telefono: cosa c'è nel giorno o
// nella settimana mostrati. Pura e condivisa da Studio e Personal; nessun dato nuovo.
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const plur = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
const d12 = (iso) => new Date(`${iso}T12:00`);

/**
 * agendaSummary({ days, appointments, events }) -> string
 * days: date ISO mostrate (1 = vista giorno). appointments: [{ data }].
 * events: [{ start, end }] in ISO (impegni personali, anche di più giorni).
 */
export function agendaSummary({ days = [], appointments = [], events = [] } = {}) {
  if (!days.length) return '';
  const first = days[0], last = days[days.length - 1];
  const inRange = (iso) => iso >= first && iso <= last;
  const apps = appointments.filter((a) => a && inRange(a.data)).length;
  const evs = events.filter((e) => e && e.start && e.start <= last && (e.end || e.start) >= first).length;
  let head;
  if (days.length === 1) {
    const d = d12(first);
    head = `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
  } else {
    const a = d12(first), b = d12(last);
    head = a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MESI[b.getMonth()]}` : `${a.getDate()} ${MESI[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MESI[b.getMonth()].slice(0, 3)}`;
  }
  if (!apps && !evs) return `${head} · ${days.length === 1 ? 'giornata libera' : 'settimana libera'}`;
  return [head, apps ? plur(apps, 'appuntamento', 'appuntamenti') : null, evs ? plur(evs, 'impegno', 'impegni') : null].filter(Boolean).join(' · ');
}
