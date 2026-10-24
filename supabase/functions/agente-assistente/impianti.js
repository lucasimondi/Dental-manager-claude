// Photo extraction is a proposal, never an authority for placement date/tooth.
// Same authenticated client, canonical capabilities and implants table as the app.
import { studioToday } from './confirmation.js';

export const STRUMENTO_IMPIANTI = {
  name: 'registra_impianti_paziente',
  description: 'Registra impianti da etichette/foto o dati dettati. Prima cerca il paziente. Chiedi solo dati mancanti/illeggibili: denti e data di inserimento devono essere indicati o confermati dall’utente, MAI ricavati dalla data di produzione/scadenza dell’etichetta. Puoi leggere l’agenda e proporre la data, ma l’utente deve confermarla. Una voce per dente: non estendere un’etichetta ad altri impianti senza indicazione dell’utente. Il sistema mostra un unico riepilogo da confermare. REF nel modello. Nessuna prescrizione o preventivo implicito.',
  input_schema: {
    type: 'object', additionalProperties: false,
    properties: {
      paziente_id: { type: 'integer' },
      impianti: { type: 'array', minItems: 1, maxItems: 32, items: {
        type: 'object', additionalProperties: false,
        properties: Object.fromEntries(['dente', 'data_inserimento', 'marca', 'modello', 'lotto', 'diametro', 'lunghezza'].map(k => [k, { type: 'string', ...(k === 'data_inserimento' ? { description: 'YYYY-MM-DD della chirurgia, confermata dall’utente.' } : {}) }])),
        required: ['dente', 'data_inserimento', 'marca', 'modello', 'lotto', 'diametro', 'lunghezza'],
      } },
    }, required: ['paziente_id', 'impianti'],
  },
};
const FIELDS = ['dente', 'data_inserimento', 'marca', 'modello', 'lotto', 'diametro', 'lunghezza'];
const SELECT = 'id, paziente_id, studio_id, dente, data_inserimento, marca, modello, lotto, diametro, lunghezza';
const siteKey = r => `${r.dente}:${r.data_inserimento}`;
const same = (a, b) => FIELDS.every(k => a[k] === b[k]);
const text = (v, field) => {
  if (typeof v !== 'string' || !v.trim() || v.length > 200 || /[\u0000-\u001f]/.test(v)) throw new Error(`Dato mancante o non valido: ${field}.`);
  return v.trim();
};
export function normalizzaImpianti(input, today = studioToday()) {
  if (!Number.isSafeInteger(input?.paziente_id) || input.paziente_id <= 0) throw new Error('Scegli il paziente.');
  if (!Array.isArray(input.impianti) || input.impianti.length < 1 || input.impianti.length > 32) throw new Error('Indica da 1 a 32 impianti.');
  const seen = new Set();
  return input.impianti.map(item => {
    const row = Object.fromEntries(FIELDS.map(k => [k, text(item?.[k], k)]));
    if (!/^[1-4][1-8]$/.test(row.dente)) throw new Error('Indica un singolo dente permanente FDI per ogni impianto.');
    const date = new Date(`${row.data_inserimento}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.data_inserimento) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.data_inserimento || row.data_inserimento > today) throw new Error('Indica la data reale di inserimento, non futura; produzione e scadenza non sono la data della chirurgia.');
    for (const k of ['diametro', 'lunghezza']) {
      if (!/^\d+(?:[.,]\d+)?\s*(?:mm)?$/i.test(row[k]) || Number(row[k].replace(/\s*mm$/i, '').replace(',', '.')) <= 0) throw new Error(`Misura non valida: ${k}, indica millimetri.`);
      row[k] = `${Number(row[k].replace(/\s*mm$/i, '').replace(',', '.')).toString().replace('.', ',')} mm`;
    }
    if (seen.has(siteKey(row))) throw new Error('Il medesimo dente compare due volte nella stessa data.');
    seen.add(siteKey(row));
    return row;
  });
}
async function authorize(client, studioId) {
  if (!studioId) throw new Error('Studio non verificato.');
  const { data, error } = await client.rpc('has_studio_capability_v1', { p_studio_id: studioId, p_capability: 'clinical.general' });
  if (error || data !== true) throw new Error('Accesso clinico non consentito.');
}
async function load(client, studioId, patientId) {
  const [{ data: patient, error: pe }, { data: rows, error: re }] = await Promise.all([
    client.from('patients').select('id, nome, cognome').eq('studio_id', studioId).eq('id', patientId).single(),
    client.from('implants').select(SELECT).eq('studio_id', studioId).eq('paziente_id', patientId),
  ]);
  if (pe || !patient || re || !Array.isArray(rows)) throw new Error('Impossibile verificare paziente e impianti. Nessuna nuova scrittura avviata.');
  return { patient, rows };
}
function pending(entries, existing) {
  return entries.filter(entry => {
    const matches = existing.filter(row => siteKey(row) === siteKey(entry));
    if (matches.length > 1 || matches.some(row => !same(row, entry))) throw new Error(`Impianto già presente con dati differenti sul dente ${entry.dente}: verifica la scheda, nessuna sovrascrittura.`);
    return matches.length === 0;
  });
}
export async function prepareImpianti(client, input, studioId, observed) {
  const entries = normalizzaImpianti(input);
  if (!observed?.patients?.has(input.paziente_id)) throw new Error('Cerca prima il paziente e risolvi eventuali omonimie.');
  await authorize(client, studioId);
  const { patient, rows } = await load(client, studioId, input.paziente_id);
  const toCreate = pending(entries, rows);
  return {
    patientId: patient.id, entries,
    summary: `Registra impianti\nPaziente: ${patient.nome || ''} ${patient.cognome || ''}\n${entries.map(r => `Dente ${r.dente} · ${r.data_inserimento} · ${r.marca} ${r.modello} · Lotto ${r.lotto} · Ø ${r.diametro} × ${r.lunghezza}`).join('\n')}\nNuovi: ${toCreate.length}. Già presenti: ${entries.length - toCreate.length}.`,
  };
}
export async function executeImpianti(client, proposal) {
  if (!proposal.userId || !proposal.id) throw new Error('Operazione non verificata.');
  const { patientId } = proposal.impianti;
  const entries = normalizzaImpianti({ paziente_id: patientId, impianti: proposal.impianti.entries });
  await authorize(client, proposal.studioId);
  const { rows } = await load(client, proposal.studioId, patientId);
  const toCreate = pending(entries, rows);
  const { error: claimError } = await client.from('poliedron_action_claims').insert({ id: proposal.id, studio_id: proposal.studioId, user_id: proposal.userId });
  if (claimError) throw new Error(claimError.code === '23505' ? 'Operazione già utilizzata. Controlla gli impianti prima di riprovare.' : 'Impossibile acquisire l’operazione.');
  if (toCreate.length) {
    // One bulk INSERT, not a loop: no per-tooth partial write. IDs use DB identity.
    const { error } = await client.from('implants').insert(toCreate.map(row => ({ ...row, paziente_id: patientId, studio_id: proposal.studioId, user_id: proposal.userId })));
    if (error) throw new Error('Esito non confermato: controlla gli impianti prima di inviare un’altra richiesta.');
  }
  const { rows: verified } = await load(client, proposal.studioId, patientId);
  const saved = entries.map(entry => {
    const matches = verified.filter(row => siteKey(row) === siteKey(entry));
    if (matches.length !== 1 || !same(matches[0], entry) || matches[0].id == null) throw new Error('Verifica dopo il salvataggio non riuscita: controlla la scheda, non ripetere automaticamente.');
    return matches[0];
  });
  return { text: `Impianti verificati: ${saved.map(r => `dente ${r.dente}`).join(', ')}. Nuovi: ${toCreate.length}; già presenti: ${entries.length - toCreate.length}.`, changed: ['implants'], recordId: saved[0].id, records: { implants: saved } };
}
