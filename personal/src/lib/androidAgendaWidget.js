import { agendaVisible } from '../../../shared/agenda/visibility.js';
import { labelColor } from '../../../shared/agenda/labelPalette.js';
import { oggi, piuGiorni, coloreEvento, ETICHETTE_PREDEFINITE } from './agenda.js';
import { RIF_WIDGET } from './widgetAzioni.js';

// Riferimento opaco della riga per le azioni del widget (apri, rimanda); vuoto se non valido.
const rif = id => (id == null || !RIF_WIDGET.test(String(id)) ? '' : String(id));

// Colore dell'etichetta come nell'agenda: colore palette più vicino (solo #rrggbb); vuoto → il widget usa il colore della fonte.
const esadecimale = c => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? labelColor(String(c)).toLowerCase() : '');

export const WIDGET_ORIGIN = 'https://personal.poliedrasoft.it';
export function widgetSnapshot({ appuntamenti = [], impegni = [], etichette = ETICHETTE_PREDEFINITE, coloriTipi = {}, from, to, now = Date.now() }) {
  const entries = [
    ...appuntamenti.filter(a => a.stato !== 'annullato' && agendaVisible(a, 'personal')).map(a => ({
      source: 'studio', ref: rif(a.id), start: a.data, end: a.data, time: String(a.ora || '').slice(0, 5),
      title: String(a.tipo || 'Appuntamento studio').slice(0, 120), color: esadecimale(a.colore || coloriTipi[a.tipo]),
    })),
    ...impegni.filter(e => agendaVisible(e, 'personal')).map(e => ({
      source: 'personal', ref: rif(e.id), start: e.data_inizio, end: e.data_fine || e.data_inizio,
      time: e.tutto_il_giorno ? '' : String(e.ora_inizio || '').slice(0, 5),
      title: String(e.titolo || 'Impegno personale').slice(0, 120), color: esadecimale(coloreEvento(e, Array.isArray(etichette) ? etichette : ETICHETTE_PREDEFINITE)),
    })),
  ].filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.start || '') && /^\d{4}-\d{2}-\d{2}$/.test(e.end || '') && e.end >= e.start && e.start <= to && e.end >= from)
    .sort((a, b) => a.start.localeCompare(b.start) || a.time.localeCompare(b.time) || a.source.localeCompare(b.source));
  if (entries.length > 5000) throw new Error('Troppi impegni per il widget');
  return { version: 1, updatedAt: now, from, to, entries };
}

// A native-origin-scoped WebMessage listener supplies this object. No-op in ordinary browsers.
export function startAndroidAgendaWidget({ db, session, studioId, etichette = () => ETICHETTE_PREDEFINITE, host = globalThis.window, interval = 60000 }) {
  if (host?.location?.origin !== WIDGET_ORIGIN || typeof host.PoliedraWidget?.postMessage !== 'function') return () => {};
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
  const sync = async () => {
    const mine = ++generation;
    try {
      const s = await session();
      if (!alive || mine !== generation) return;
      if (!s) { clear(); return; }
      studioId(s); // Existing fail-closed tenant check; existing RLS remains authoritative.
      const from = piuGiorni(oggi(), -7), to = piuGiorni(oggi(), 28);
      const [appointments, events] = await Promise.all([
        pageAll(() => db.from('appointments').select('id,data,ora,tipo,colore,stato,visibile_personal').gte('data', from).lte('data', to)),
        pageAll(() => db.from('impegni_personali').select('id,titolo,tipo,etichetta,colore,data_inizio,data_fine,tutto_il_giorno,ora_inizio,visibile_personal').lte('data_inizio', to).gte('data_fine', from)),
      ]);
      // Colori dei tipi Studio: facoltativi, un errore lascia il colore della fonte.
      let coloriTipi = {};
      try { const t = await db.from('app_types').select('nome,colore'); if (Array.isArray(t?.data)) coloriTipi = Object.fromEntries(t.data.map(x => [x.nome, x.colore])); } catch { /* colore della fonte */ }
      if (!alive || mine !== generation) return;
      send(widgetSnapshot({ appuntamenti: appointments, impegni: events, etichette: etichette(), coloriTipi, from, to }));
    } catch { if (alive && mine === generation) clear(); }
  };
  clear(); void sync();
  // Auth callbacks must not await other auth methods while the Supabase lock is held.
  const { data } = db.auth.onAuthStateChange(() => { clear(); host.setTimeout(() => { if (alive) void sync(); }, 0); });
  const visible = () => { if (host.document.visibilityState === 'visible') void sync(); };
  host.addEventListener('focus', sync); host.document.addEventListener('visibilitychange', visible);
  const timer = host.setInterval(() => { if (host.document.visibilityState === 'visible') void sync(); }, interval);
  return () => {
    alive = false; generation++; data.subscription.unsubscribe(); host.clearInterval(timer);
    host.removeEventListener('focus', sync); host.document.removeEventListener('visibilitychange', visible);
    send({ clear: true });
  };
}
