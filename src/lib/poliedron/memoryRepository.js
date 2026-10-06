/* POL-AI-009 — memoria di Poliedron (tabella public.poliedron_memoria).

   Ogni voce appartiene all'utente che la crea, nello studio corrente: la RLS
   la rende visibile e modificabile solo a lui. Poliedron la scrive dalla
   chat (strumento `ricorda` della funzione agente-assistente); l'app la
   scrive quando il medico genera una ricetta, così Poliedron impara le
   posologie che usa davvero. Nessun dato del paziente entra in memoria. */

const MAX_TESTO = 500;
const MAX_CAMPO = { farmaco: 120, dosaggio: 80, posologia: 200, durata: 80, note: 200 };
const FIELDS = 'id, categoria, chiave, testo, origine, created_at, updated_at';

const testo = (valore, max) => (typeof valore === 'string' ? valore.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Identica a supabase/functions/agente-assistente/memoria.js. */
export function chiaveFarmaco(nome) {
  const pulito = testo(nome, 120).toLowerCase();
  return pulito ? `farmaco:${pulito}` : null;
}

/** Identica a supabase/functions/agente-assistente/memoria.js. */
export function testoPrescrizione(f) {
  const nome = testo(f?.farmaco, MAX_CAMPO.farmaco);
  if (!nome) return '';
  const dettagli = [
    testo(f.dosaggio, MAX_CAMPO.dosaggio) && `dosaggio ${testo(f.dosaggio, MAX_CAMPO.dosaggio)}`,
    testo(f.posologia, MAX_CAMPO.posologia),
    testo(f.durata, MAX_CAMPO.durata),
    testo(f.note, MAX_CAMPO.note) && `note: ${testo(f.note, MAX_CAMPO.note)}`,
  ].filter(Boolean);
  return `${nome}: ${dettagli.join(', ') || 'nessun dettaglio'}`.slice(0, MAX_TESTO);
}

/** Righe da salvare per una ricetta generata: una per farmaco con almeno posologia o durata. */
export function vociDaRicetta(farmaci, { studioId, userId }) {
  if (!studioId || !userId || !Array.isArray(farmaci)) return [];
  const viste = new Set();
  const righe = [];
  for (const f of farmaci) {
    const chiave = chiaveFarmaco(f?.farmaco);
    if (!chiave || viste.has(chiave)) continue;
    if (!testo(f.posologia, 1) && !testo(f.durata, 1)) continue;
    viste.add(chiave);
    righe.push({ studio_id: studioId, user_id: userId, categoria: 'prescrizione', chiave, testo: testoPrescrizione(f), origine: 'ricetta' });
  }
  return righe;
}

/** Dopo la generazione di una ricetta. Mai bloccante: ritorna il numero di voci salvate (0 in caso di errore). */
export async function imparaDaRicetta(client, { studioId, userId, farmaci }) {
  const righe = vociDaRicetta(farmaci, { studioId, userId });
  if (!client || !righe.length) return 0;
  try {
    const { error } = await client.from('poliedron_memoria').upsert(righe, { onConflict: 'studio_id,user_id,chiave' });
    return error ? 0 : righe.length;
  } catch {
    return 0;
  }
}

export async function listMemoria(client) {
  const { data, error } = await client
    .from('poliedron_memoria')
    .select(FIELDS)
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return data || [];
}

export async function deleteMemoria(client, id) {
  const { error } = await client.from('poliedron_memoria').delete().eq('id', id);
  if (error) throw error;
}

export const CATEGORIA_LABEL = Object.freeze({
  preferenza: 'Preferenza',
  prescrizione: 'Prescrizione abituale',
  studio: 'Studio',
  altro: 'Altro',
});
