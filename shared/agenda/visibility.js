// Visibility is presentation only: the canonical record and existing RLS stay unchanged.
export function agendaVisible(row, target) {
  const camel = target === 'studio' ? 'visibileStudio' : 'visibilePersonal';
  const snake = target === 'studio' ? 'visibile_studio' : 'visibile_personal';
  return (row[camel] ?? row[snake]) !== false;
}

export function agendaVisibility(row) {
  return { visibile_studio: agendaVisible(row, 'studio'), visibile_personal: agendaVisible(row, 'personal') };
}

export function hasVisibleAgenda(row) {
  return agendaVisible(row, 'studio') || agendaVisible(row, 'personal');
}

// Reveal occupied weekend days within this week, including multi-day events.
// All comparisons use local calendar dates; DST never moves an event to another day.
export function keepOccupiedWeekends(weekStart, hidden, appointments = [], events = []) {
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const occupied = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart); d.setDate(d.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) continue;
    const day = iso(d);
    if (appointments.some(a => a.data === day && a.stato !== 'annullato') ||
      events.some(e => {
        const start = e.dataInizio ?? e.data_inizio;
        const end = e.dataFine ?? e.data_fine ?? start;
        return start && day >= start && day <= end;
      })) occupied.add(d.getDay());
  }
  return hidden.filter(day => !occupied.has(Number(day)));
}
