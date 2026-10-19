// Area Legal usa le pratiche canoniche: le note manuali non passano dalla scansione.
export const STATI_LEGAL = ['aperta', 'in_corso', 'risolta', 'archiviata'];
const esito = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
export function campiLegal(campi) {
  const titolo = String(campi.titolo || '').trim();
  if (!titolo) throw new Error('Inserisci il titolo della pratica');
  if (!STATI_LEGAL.includes(campi.stato)) throw new Error('Stato non valido');
  if (!['bassa', 'media', 'alta'].includes(campi.urgenza)) throw new Error('Urgenza non valida');
  return { titolo: titolo.slice(0, 200), note: String(campi.note || '').trim(), stato: campi.stato, urgenza: campi.urgenza };
}
export async function salvaPraticaLegal(db, id, campi) {
  const riga = { ...campiLegal(campi), aggiornata_il: new Date().toISOString() };
  const q = id ? db.from('pratiche').update(riga).eq('id', id) : db.from('pratiche').insert({ ...riga, fascicolo: 'legale' });
  return esito(await q.select('*').single());
}
export async function caricaLegal(db) {
  return esito(await db.from('v_pratiche').select('*').eq('fascicolo', 'legale').order('aggiornata_il', { ascending: false }));
}
export async function collegaLegal(db, documentoId, praticaId) {
  // Non sovrascrive collegamenti già presenti: se qualcuno lo ha collegato nel frattempo fallisce.
  return esito(await db.from('documenti').update({ pratica_id: praticaId }).eq('id', documentoId).is('pratica_id', null).neq('fascicolo', 'clinico_pazienti').select('id').single());
}
export async function scadenzaLegal(db, praticaId, data, descrizione) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !descrizione.trim()) throw new Error('Inserisci data e descrizione');
  return esito(await db.from('scadenze').insert({ pratica_id: praticaId, data, descrizione: descrizione.trim(), completata: false, storica: false }).select('id').single());
}
