// Only UI state crosses applications; sessions and clinical data stay separate.
export function readAgendaLocation(search = globalThis.location?.search || '') {
  const q = new URLSearchParams(search);
  const raw = q.get('agendaDate');
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(raw || '') && !Number.isNaN(Date.parse(raw)) && new Date(raw).toISOString().slice(0, 10) === raw;
  const month = q.get('agendaMonth');
  const validMonth = /^\d{4}-\d{2}-\d{2}$/.test(month || '') && !Number.isNaN(Date.parse(month)) && new Date(month).toISOString().slice(0, 10) === month;
  return { ...(validMonth ? { month } : {}), requested: q.get('agenda') === '1', day: validDate ? raw : null, view: ['giorno', 'settimana', 'mese'].includes(q.get('agendaView')) ? q.get('agendaView') : null };
}
export function agendaDestination(target, day, view, location = globalThis.location, month) {
  const customPersonal = location.hostname === 'personal.poliedrasoft.it';
  // /studio is already served by the SPA rewrite; unlike / it is not redirected to Personal.
  const origin = location.origin;
  const productionStudio = location.hostname === 'dental-manager-acmeproduction.vercel.app';
  const url = new URL(target === 'studio' ? (customPersonal ? '/studio' : '/') : productionStudio ? 'https://personal.poliedrasoft.it/' : '/personal/', origin);
  url.search = new URLSearchParams({ agenda: '1', agendaDate: day, agendaView: view, ...(view === 'mese' && month ? { agendaMonth: month } : {}) }).toString();
  return url.href;
}
