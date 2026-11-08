// Only UI state crosses applications; sessions and clinical data stay separate.
export function readAgendaLocation(search = globalThis.location?.search || '') {
  const q = new URLSearchParams(search);
  const raw = q.get('agendaDate');
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(raw || '') && !Number.isNaN(Date.parse(raw)) && new Date(raw).toISOString().slice(0, 10) === raw;
  const month = q.get('agendaMonth');
  const validMonth = /^\d{4}-\d{2}-\d{2}$/.test(month || '') && !Number.isNaN(Date.parse(month)) && new Date(month).toISOString().slice(0, 10) === month;
  return { ...(validMonth ? { month } : {}), requested: q.get('agenda') === '1', day: validDate ? raw : null, view: ['giorno', 'settimana', 'settimana_lavoro', 'mese'].includes(q.get('agendaView')) ? q.get('agendaView') : null };
}
// APP-UNICA passo 2 (PO 2026-11-08, "un solo luogo"): dentro l'app installata sul telefono
// (Poliedron in /poliedron…, oppure qualsiasi pagina aperta come app) Studio e Personal restano
// nello STESSO indirizzo: stessa app, stesse sessioni, niente salto in un altro sito.
// Nel browser (computer) il comportamento resta quello di prima: dallo studio di produzione
// Personal si apre sul suo dominio personal.poliedrasoft.it.
const comeApp = () => {
  try { return Boolean(globalThis.matchMedia?.('(display-mode: standalone)')?.matches || globalThis.navigator?.standalone); } catch { return false; }
};
export function appBase(target, location = globalThis.location, { app = comeApp() } = {}) {
  const customPersonal = location.hostname === 'personal.poliedrasoft.it';
  const productionStudio = location.hostname === 'dental-manager-acmeproduction.vercel.app';
  const poliedron = /^\/poliedron(\/|$)/.test(location.pathname || '');
  if (target === 'studio') return customPersonal ? '/studio' : poliedron ? '/poliedron/' : '/';
  if (poliedron && !customPersonal) return '/poliedron/personal/';
  return productionStudio && !app ? 'https://personal.poliedrasoft.it/' : '/personal/';
}
export function agendaDestination(target, day, view, location = globalThis.location, month) {
  const url = new URL(appBase(target, location), location.origin);
  url.search = new URLSearchParams({ agenda: '1', agendaDate: day, agendaView: view, ...(view === 'mese' && month ? { agendaMonth: month } : {}) }).toString();
  return url.href;
}

// APP-UNICA (PO 2026-11-08): da «Altro» si apre direttamente una sezione dell'altra parte
// (Studio ↔ Personal), finché le due non sono la stessa app. Solo il nome della sezione passa.
export function readSectionLocation(search = globalThis.location?.search || '') {
  const s = new URLSearchParams(search).get('sezione');
  return /^[a-z]{2,20}$/.test(s || '') ? s : null;
}
export function sectionDestination(target, sezione, location = globalThis.location, { nuovo = false } = {}) {
  const url = new URL(appBase(target, location), location.origin);
  url.search = new URLSearchParams({ sezione, ...(nuovo ? { nuovo: '1' } : {}) }).toString();
  return url.href;
}
export const readSectionNew = (search = globalThis.location?.search || '') => new URLSearchParams(search).get('nuovo') === '1';

// AGENDA-UNICA (PO 2026-11-08: "una sola agenda e da lì fare tutto"; base = l'agenda di Studio).
// Sul telefono l'agenda di Personal porta all'agenda unica. Restano com'erano il computer (schermo
// largo) e l'app Android «Poliedra Agenda» (WebView con i widget, che espone PoliedraWidget).
export function agendaUnica(host = globalThis) {
  try {
    if (host.PoliedraWidget) return false;
    return Boolean(host.matchMedia?.('(max-width: 719px)')?.matches);
  } catch { return false; }
}
