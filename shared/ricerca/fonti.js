// RICERCA-AGENDA — fonti comuni a Studio e Personal: note e registro password stanno nello stesso
// database dello studio. Della password si mostrano solo servizio e utente, mai la password.
import { leggiNote, aggiungiNota, dividiNota } from '../note/note.js';
import { leggiPassword, corrispondePassword } from '../password/password.js';
import { norm } from './comandi.js';

const contiene = (testo, q) => { const ps = norm(q).split(' ').filter(Boolean); const t = norm(testo); return ps.length > 0 && ps.every((p) => t.includes(p)); };

export function creaFontiStudio({ db, studioId, apriNota, apriPassword, cercaDocumenti = null }) {
  let cache = null, quando = 0;
  const carica = () => {
    if (!cache || Date.now() - quando > 30000) { quando = Date.now(); cache = Promise.all([leggiNote(db).catch(() => []), leggiPassword(db).catch(() => [])]); }
    return cache;
  };
  const cercaAltro = async (q, { solo = null } = {}) => {
    const [note, voci] = await carica();
    const out = [];
    if (!solo || solo === 'Note') for (const n of note.filter((x) => contiene(x.testo, q)).slice(0, 4)) {
      const { titolo, corpo } = dividiNota(n.testo);
      out.push({ gruppo: 'Note', id: n.id, titolo, sottotitolo: corpo.slice(0, 80), icona: 'nota', apri: () => apriNota(n) });
    }
    if (!solo || solo === 'Password') for (const v of voci.filter((x) => (q ? corrispondePassword(x, q) : true)).slice(0, solo ? 8 : 4)) {
      out.push({ gruppo: 'Password', id: v.id, titolo: v.titolo, sottotitolo: v.utente || v.sito || '', icona: 'password', apri: () => apriPassword(v.titolo) });
    }
    if (cercaDocumenti && !solo && q.length > 2) {
      const docs = await cercaDocumenti(q).catch(() => []);
      for (const d of docs.slice(0, 4)) out.push({ gruppo: 'Documenti', id: d.id, titolo: d.titolo, sottotitolo: d.sottotitolo || '', icona: 'documento', apri: d.apri });
    }
    return out;
  };
  const nuovaNota = async (testo) => { await aggiungiNota(db, { studioId, testo }); cache = null; };
  return { cercaAltro, nuovaNota };
}

// Da elementi dell'agenda alla forma comune della ricerca.
const minuti = (h) => { const [a, b] = String(h || '0:0').split(':').map(Number); return a * 60 + (b || 0); };
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const giorni = (da, a) => Math.round((new Date(`${a}T12:00`) - new Date(`${da}T12:00`)) / 86400000);
const piu = (s, n) => { const d = new Date(`${s}T12:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Impegno spostato: stessa durata, giorni interi spostati insieme. Campi camelCase o snake_case. */
export function impegnoSpostato(i, { data, ora }) {
  const camel = 'dataInizio' in i;
  const k = camel ? { di: 'dataInizio', df: 'dataFine', oi: 'oraInizio', of: 'oraFine' } : { di: 'data_inizio', df: 'data_fine', oi: 'ora_inizio', of: 'ora_fine' };
  const delta = giorni(i[k.di], data);
  const out = { ...i, [k.di]: data, [k.df]: piu(i[k.df] || i[k.di], delta) };
  if (ora && i[k.oi]) { const durata = Math.max(15, minuti(i[k.of] || i[k.oi]) - minuti(i[k.oi])); out[k.oi] = ora; out[k.of] = hhmm(Math.min(minuti(ora) + durata, 23 * 60 + 59)); }
  return out;
}
