// Una riga per acquisto nelle impostazioni private: dispositivi diversi non sovrascrivono l'intera lista.
const PREFISSO = 'personal_acquisto:';
export const TIPI_ACQUISTO = ['Spesa', 'Casa', 'Altro'];
const esito = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
export async function leggiAcquisti(db) {
  return esito(await db.from('impostazioni_app').select('chiave, valore').like('chiave', `${PREFISSO}%`).order('aggiornato_il', { ascending: false }))
    .map((r) => ({ ...r.valore, id: r.chiave.slice(PREFISSO.length) }));
}
export async function salvaAcquisto(db, voce) {
  const nome = String(voce.nome || '').trim();
  if (!nome) throw new Error('Scrivi cosa comprare');
  const id = voce.id || crypto.randomUUID();
  const valore = { nome, categoria: TIPI_ACQUISTO.includes(voce.categoria) ? voce.categoria : 'Spesa', comprato: !!voce.comprato };
  esito(await db.from('impostazioni_app').upsert({ chiave: PREFISSO + id, valore, aggiornato_il: new Date().toISOString() }, { onConflict: 'chiave' }).select('chiave').single());
  return { ...valore, id };
}
export async function eliminaAcquisto(db, id) {
  esito(await db.from('impostazioni_app').delete().eq('chiave', PREFISSO + id).select('chiave').single());
}
