// ANDROID-PERSONAL-WIDGET-ACTIONS — azioni chieste dai widget Android di Poliedron Personal.
// Il widget non ha credenziali e non scrive nulla: apre l'app con un'azione nell'indirizzo, l'app
// legge con la sessione e la RLS esistenti e mostra l'editor abituale. Il salvataggio resta un
// gesto esplicito dell'utente nell'app.
import { piuGiorni } from './agenda.js';
import { agendaVisible } from '../../../shared/agenda/visibility.js';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
// Riferimento opaco a una riga (id numerico o uuid): niente nomi, niente note.
export const RIF_WIDGET = /^[A-Za-z0-9-]{1,64}$/;
const PARAMETRI = ['widgetNew', 'widgetOpen', 'widgetAction'];

export function leggiAzioneWidget(search) {
  const q = new URLSearchParams(search || '');
  const giorno = DATA.test(q.get('agendaDate') || '') ? q.get('agendaDate') : null;
  const nuovo = q.get('widgetNew');
  if (nuovo) return { tipo: 'nuovo', cosa: nuovo === 'appuntamento' ? 'appuntamento' : 'evento', giorno };
  const m = /^(studio|personal):(.+)$/.exec(q.get('widgetOpen') || '');
  if (!m || !RIF_WIDGET.test(m[2])) return null;
  const rimanda = q.get('widgetAction') === 'rimanda' && m[1] === 'personal';
  return { tipo: 'apri', fonte: m[1], id: m[2], rimanda, giorno };
}

export function urlSenzaAzioneWidget(href) {
  const url = new URL(href);
  for (const p of PARAMETRI) url.searchParams.delete(p);
  return url;
}

// Stesso evento un giorno dopo, stessa durata in giorni e stessi orari.
export function rimandaDiUnGiorno(evento) {
  const inizio = evento.data_inizio, fine = evento.data_fine && evento.data_fine >= inizio ? evento.data_fine : inizio;
  return { data_inizio: piuGiorni(inizio, 1), data_fine: piuGiorni(fine, 1) };
}

// Pagina da aprire per l'azione. Una riga non più leggibile (eliminata, permessi cambiati) apre
// soltanto il giorno con un avviso: mai un editor vuoto scambiato per quello della riga.
export async function paginaDaAzioneWidget(azione, { appuntamento, impegno, sessione }) {
  if (!azione) return null;
  if (azione.tipo === 'nuovo') {
    const evento = azione.giorno ? { data_inizio: azione.giorno, data_fine: azione.giorno } : undefined;
    return { tipo: 'evento', ...(evento ? { evento } : {}), ...(azione.cosa === 'appuntamento' ? { cosa: 'appuntamento' } : {}) };
  }
  // Senza sessione dello studio la RLS non restituisce righe: non è un impegno sparito.
  if (!(await sessione())) return { avviso: 'Collega l’agenda dello studio per aprire questo impegno' };
  if (azione.fonte === 'studio') {
    const a = await appuntamento(azione.id);
    return a && a.stato !== 'annullato' && agendaVisible(a, 'personal') ? { tipo: 'appuntamento', a } : { avviso: 'Appuntamento non più disponibile' };
  }
  const e = await impegno(azione.id);
  if (!e || !agendaVisible(e, 'personal')) return { avviso: 'Impegno non più disponibile' };
  return azione.rimanda ? { tipo: 'evento', evento: e, proposta: rimandaDiUnGiorno(e) } : { tipo: 'evento', evento: e };
}

// Una volta all'avvio: toglie l'azione dall'indirizzo (un ricaricamento non la ripete) e apre la pagina.
export function avviaAzioneWidget({ host = globalThis.window, apri, mostra, errore, ...letture }) {
  const azione = leggiAzioneWidget(host.location.search);
  if (!azione) return () => {};
  host.history.replaceState(host.history.state, '', urlSenzaAzioneWidget(host.location.href));
  let vivo = true;
  paginaDaAzioneWidget(azione, letture)
    .then((p) => { if (!vivo || !p) return; if (p.avviso) mostra(p.avviso); else apri(p); })
    .catch((e) => { if (vivo) errore(`Agenda non disponibile: ${e.message || e}`); });
  return () => { vivo = false; };
}
