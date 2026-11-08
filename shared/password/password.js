// PASSWORD-PERSONALI (PO 2026-11-08) — registro password privato del suo autore, uguale in
// Studio e in Personal. Tabella public.password_personali (migrazione 20261108120000): lo studio
// dal JWT, l'autore è sempre l'utente collegato. La password non va MAI a Poliedron o a modelli:
// la ricerca usa solo titolo, utente e sito (vedi corrispondePassword).
const CAMPI = 'id,titolo,utente,segreto,sito,note,created_at,updated_at';
export const LIMITI = Object.freeze({ titolo: 200, utente: 320, segreto: 1000, sito: 500, note: 2000 });

export function messaggioErrorePassword(error) {
  const t = `${error?.code || ''} ${error?.message || ''}`;
  if (/42P01|PGRST205|password_personali/.test(t) && /exist|schema cache|not find|relation/i.test(t)) return 'Il registro password sarà disponibile dopo l\'aggiornamento del database.';
  return error?.message || 'Registro password non disponibile in questo momento.';
}
const esito = ({ data, error }) => { if (error) throw new Error(messaggioErrorePassword(error)); return data; };

export function pulisciVoce(voce) {
  const v = {};
  for (const k of Object.keys(LIMITI)) {
    if (!(k in voce)) continue;
    const s = String(voce[k] ?? '').replace(/\r\n?/g, '\n');
    v[k] = k === 'segreto' ? s : s.trim();
    if (v[k].length > LIMITI[k]) throw new Error(`Campo troppo lungo (massimo ${LIMITI[k]} caratteri).`);
  }
  if ('titolo' in v && !v.titolo) throw new Error('Scrivi il nome del servizio (es. Banca, Email).');
  return v;
}

export async function leggiPassword(db) {
  return esito(await db.from('password_personali').select(CAMPI).order('titolo', { ascending: true }).limit(1000)) || [];
}
export async function aggiungiPassword(db, { studioId, ...voce }) {
  if (!studioId) throw new Error('Studio non disponibile: accedi di nuovo.');
  return esito(await db.from('password_personali').insert({ studio_id: studioId, ...pulisciVoce({ titolo: '', ...voce }) }).select(CAMPI).single());
}
export async function aggiornaPassword(db, id, voce) {
  return esito(await db.from('password_personali').update({ ...pulisciVoce(voce), updated_at: new Date().toISOString() }).eq('id', id).select(CAMPI).single());
}
export async function eliminaPassword(db, id) {
  esito(await db.from('password_personali').delete().eq('id', id));
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Solo titolo, utente e sito: la password stessa non viene mai confrontata né mostrata nei risultati.
export function corrispondePassword(voce, testo) {
  const parole = norm(testo).split(/\s+/).filter(Boolean);
  if (!parole.length) return true;
  const dove = norm(`${voce.titolo} ${voce.utente} ${voce.sito}`);
  return parole.every((p) => dove.includes(p));
}
export const linkSito = (sito) => {
  const s = String(sito || '').trim();
  if (!s) return '';
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
};
