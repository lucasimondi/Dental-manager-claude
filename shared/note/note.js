// NOTE-PERSONALI — note veloci private del loro autore, stesse in Studio e in Personal.
// Tabella public.note_personali (vedi migrazione 20261107120000): lo studio viene dal JWT,
// l'autore è sempre l'utente collegato. Qui solo letture e scritture sulle proprie note.
export const AREE_NOTE = Object.freeze([
  { id: 'studio', nome: 'Studio', colore: '#2F6FEB' },
  { id: 'famiglia', nome: 'Famiglia', colore: '#E5484D' },
  { id: 'casa', nome: 'Casa', colore: '#D9822B' },
  { id: 'idee', nome: 'Idee', colore: '#7C5CFF' },
  { id: 'personale', nome: 'Per te', colore: '#12A594' },
]);
export const areaNota = (id) => AREE_NOTE.find((a) => a.id === id) || AREE_NOTE[AREE_NOTE.length - 1];
const CAMPI = 'id,testo,area,fissata,paziente_id,created_at,updated_at';
export const TESTO_MAX = 4000;

// Tabella non ancora creata nel database: messaggio chiaro invece di un errore tecnico.
export function messaggioErroreNote(error) {
  const t = `${error?.code || ''} ${error?.message || ''}`;
  if (/42P01|PGRST205|note_personali/.test(t) && /exist|schema cache|not find|relation/i.test(t)) return 'Le note saranno disponibili dopo l\'aggiornamento del database.';
  return error?.message || 'Note non disponibili in questo momento.';
}
const esito = ({ data, error }) => { if (error) throw new Error(messaggioErroreNote(error)); return data; };

export function pulisciTesto(testo) {
  const t = String(testo ?? '').replace(/\r\n?/g, '\n').trim();
  if (!t) throw new Error('Scrivi qualcosa nella nota.');
  if (t.length > TESTO_MAX) throw new Error(`La nota è troppo lunga (massimo ${TESTO_MAX} caratteri).`);
  return t;
}

export async function leggiNote(db) {
  return esito(await db.from('note_personali').select(CAMPI).order('fissata', { ascending: false }).order('updated_at', { ascending: false }).limit(300)) || [];
}
export async function aggiungiNota(db, { studioId, testo, area = 'personale', pazienteId = null }) {
  if (!studioId) throw new Error('Studio non disponibile: accedi di nuovo.');
  const riga = { studio_id: studioId, testo: pulisciTesto(testo), area: areaNota(area).id, ...(pazienteId != null ? { paziente_id: pazienteId } : {}) };
  return esito(await db.from('note_personali').insert(riga).select(CAMPI).single());
}
export async function aggiornaNota(db, id, modifiche) {
  const riga = { updated_at: new Date().toISOString() };
  if ('testo' in modifiche) riga.testo = pulisciTesto(modifiche.testo);
  if ('area' in modifiche) riga.area = areaNota(modifiche.area).id;
  if ('fissata' in modifiche) riga.fissata = Boolean(modifiche.fissata);
  return esito(await db.from('note_personali').update(riga).eq('id', id).select(CAMPI).single());
}
export async function eliminaNota(db, id) {
  esito(await db.from('note_personali').delete().eq('id', id));
}
// Prima riga = titolo, il resto = corpo.
export function dividiNota(testo) {
  const [titolo, ...resto] = String(testo || '').split('\n');
  return { titolo: titolo.trim(), corpo: resto.join('\n').trim() };
}
