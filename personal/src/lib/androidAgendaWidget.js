import { agendaVisible } from '../../../shared/agenda/visibility.js';
import { oggi, piuGiorni } from './agenda.js';
import { RIF_WIDGET } from './widgetAzioni.js';

export const WIDGET_ORIGIN = 'https://personal.poliedrasoft.it';
// Riferimento opaco della riga per le azioni del widget (apri, rimanda); vuoto se non valido.
const rif = id => (id == null || !RIF_WIDGET.test(String(id)) ? '' : String(id));

// Preferenze del widget su questo telefono (solo nell'app Android): sincronizzazione attiva e,
// solo se scelto esplicitamente, nome e cognome dei pazienti nei titoli. Predefinito: niente nomi.
export const PREFERENZE_WIDGET = 'poliedra-widget-preferenze';
export const EVENTO_PREFERENZE = 'poliedra-widget-preferenze';
export function leggiPreferenzeWidget(host = globalThis.window) {
  try {
    const p = JSON.parse(host.localStorage.getItem(PREFERENZE_WIDGET) || '{}');
    return { attivo: p.attivo !== false, nomi: p.nomi === true };
  } catch { return { attivo: true, nomi: false }; }
}
export function salvaPreferenzeWidget(preferenze, host = globalThis.window) {
  const p = { attivo: preferenze.attivo !== false, nomi: preferenze.nomi === true };
  try { host.localStorage.setItem(PREFERENZE_WIDGET, JSON.stringify(p)); } catch { /* resta per questa sessione */ }
  host.dispatchEvent(new CustomEvent(EVENTO_PREFERENZE, { detail: p }));
  return p;
}
export const widgetDisponibile = (host = globalThis.window) => host?.location?.origin === WIDGET_ORIGIN && typeof host.PoliedraWidget?.postMessage === 'function';

// `pazienti` (Map id → "Cognome Nome") solo con l'interruttore acceso; mai note né altri dati.
export function widgetSnapshot({ appuntamenti = [], impegni = [], pazienti = null, from, to, now = Date.now() }) {
  const entries = [
    ...appuntamenti.filter(a => a.stato !== 'annullato' && agendaVisible(a, 'personal')).map(a => ({
      source: 'studio', ref: rif(a.id), start: a.data, end: a.data, time: String(a.ora || '').slice(0, 5),
      title: [pazienti?.get(a.paziente_id), a.tipo || 'Appuntamento studio'].filter(Boolean).join(' · ').slice(0, 120),
    })),
    ...impegni.filter(e => agendaVisible(e, 'personal')).map(e => ({
      source: 'personal', ref: rif(e.id), start: e.data_inizio, end: e.data_fine || e.data_inizio,
      time: e.tutto_il_giorno ? '' : String(e.ora_inizio || '').slice(0, 5),
      title: String(e.titolo || 'Impegno personale').slice(0, 120),
    })),
  ].filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.start || '') && /^\d{4}-\d{2}-\d{2}$/.test(e.end || '') && e.end >= e.start && e.start <= to && e.end >= from)
    .sort((a, b) => a.start.localeCompare(b.start) || a.time.localeCompare(b.time) || a.source.localeCompare(b.source));
  if (entries.length > 5000) throw new Error('Troppi impegni per il widget');
  return { version: 1, updatedAt: now, from, to, entries };
}

// A native-origin-scoped WebMessage listener supplies this object. No-op in ordinary browsers.
export function startAndroidAgendaWidget({ db, session, studioId, host = globalThis.window, interval = 60000 }) {
  if (!widgetDisponibile(host)) return () => {};
  const send = payload => host.PoliedraWidget.postMessage(JSON.stringify(payload));
  let alive = true, generation = 0;
  const clear = () => { generation++; send({ clear: true }); };
  const pageAll = async makeQuery => {
    const all = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const result = await makeQuery().order('id').range(offset, offset + 499);
      if (result.error || !Array.isArray(result.data)) throw new Error('Agenda non disponibile');
      all.push(...result.data);
      if (result.data.length < 500) return all;
    }
    throw new Error('Agenda troppo grande per il widget');
  };
  // Solo id, nome e cognome, letti con la sessione e la RLS dello studio, a blocchi di 100.
  const nomiPazienti = async appointments => {
    const ids = [...new Set(appointments.filter(a => a.stato !== 'annullato' && agendaVisible(a, 'personal')).map(a => a.paziente_id).filter(Boolean))];
    const nomi = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const result = await db.from('patients').select('id,nome,cognome').in('id', ids.slice(i, i + 100));
      if (result.error || !Array.isArray(result.data)) throw new Error('Pazienti non disponibili');
      for (const p of result.data) nomi.set(p.id, [p.cognome, p.nome].filter(Boolean).join(' '));
    }
    return nomi;
  };
  const sync = async () => {
    const mine = ++generation;
    try {
      const s = await session();
      if (!alive || mine !== generation) return;
      if (!s || !leggiPreferenzeWidget(host).attivo) { clear(); return; }
      studioId(s); // Existing fail-closed tenant check; existing RLS remains authoritative.
      const from = piuGiorni(oggi(), -7), to = piuGiorni(oggi(), 28);
      const [appointments, events] = await Promise.all([
        pageAll(() => db.from('appointments').select('id,data,ora,tipo,stato,paziente_id,visibile_personal').gte('data', from).lte('data', to)),
        pageAll(() => db.from('impegni_personali').select('id,titolo,data_inizio,data_fine,tutto_il_giorno,ora_inizio,visibile_personal').lte('data_inizio', to).gte('data_fine', from)),
      ]);
      const pazienti = leggiPreferenzeWidget(host).nomi ? await nomiPazienti(appointments) : null;
      if (!alive || mine !== generation) return;
      send(widgetSnapshot({ appuntamenti: appointments, impegni: events, pazienti, from, to }));
    } catch { if (alive && mine === generation) clear(); }
  };
  clear(); void sync();
  // Auth callbacks must not await other auth methods while the Supabase lock is held.
  const { data } = db.auth.onAuthStateChange(() => { clear(); host.setTimeout(() => { if (alive) void sync(); }, 0); });
  const visible = () => { if (host.document.visibilityState === 'visible') void sync(); };
  const preferenze = () => { clear(); void sync(); };
  host.addEventListener(EVENTO_PREFERENZE, preferenze);
  host.addEventListener('focus', sync); host.document.addEventListener('visibilitychange', visible);
  const timer = host.setInterval(() => { if (host.document.visibilityState === 'visible') void sync(); }, interval);
  return () => {
    alive = false; generation++; data.subscription.unsubscribe(); host.clearInterval(timer);
    host.removeEventListener(EVENTO_PREFERENZE, preferenze); host.removeEventListener('focus', sync); host.document.removeEventListener('visibilitychange', visible);
    send({ clear: true });
  };
}
