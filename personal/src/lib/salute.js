// MIA-SALUTE (PO 2026-11-10) — «La mia salute ed esami»: referti, esami, ricette e visite di Luca
// (la prima persona delle Impostazioni), anche foto di referti, da inviare insieme selezionandoli.
// Dentro: tag `mia_salute`, oppure sanitario_famiglia assegnato a Luca. Il tag `non_mia_salute`
// toglie un documento anche quando la regola lo prenderebbe. Mai i documenti dei pazienti.
export const TAG_SALUTE = 'mia_salute';
export const TAG_NON_SALUTE = 'non_mia_salute';
const CAMPI = 'id, titolo, riassunto, fascicolo, tipo_documento, data_documento, email_data, email_oggetto, importo, drive_url, drive_file_id, nome_file_originale, mime_type, tag, gmail_message_id, creato_il, persona, categoria, ente, rilevanza';

const esito = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Errore archivio');
  return data;
};

export const io = (impostazioni) => impostazioni?.persone?.[0] || null;

export function eMiaSalute(doc, persona) {
  if (!doc || doc.fascicolo === 'clinico_pazienti') return false;
  const tag = doc.tag || [];
  if (tag.includes(TAG_NON_SALUTE)) return false;
  return tag.includes(TAG_SALUTE) || (!!persona && doc.fascicolo === 'sanitario_famiglia' && doc.persona === persona);
}

export const TIPI_SALUTE = [['tutti', 'Tutti'], ['referti', 'Referti ed esami'], ['ricette', 'Ricette'], ['spese', 'Fatture e spese'], ['altro', 'Altro']];

export function tipoSalute(doc) {
  const t = `${doc?.tipo_documento || ''} ${doc?.titolo || ''}`.toLowerCase();
  if (/fattura|ricevuta|scontrino|pagamento/.test(t)) return 'spese';
  if (/ricett|prescriz|\bnre\b/.test(t)) return 'ricette';
  if (/referto|esam|analisi|ecograf|radiograf|risonanz|\btac\b|endoscop|gastroscop|visita|relazione|lettera di dimissione|certificat/.test(t)) return 'referti';
  return 'altro';
}

const dataDoc = (d) => String(d.data_documento || d.email_data || d.creato_il || '');
export const ordinaSalute = (docs) => [...docs].sort((a, b) => dataDoc(b).localeCompare(dataDoc(a)));

export async function documentiSalute(db, persona) {
  const regola = persona ? `,and(fascicolo.eq.sanitario_famiglia,persona.eq."${String(persona).replace(/"/g, '')}")` : '';
  const righe = esito(await db.from('documenti').select(CAMPI)
    .or(`tag.cs.{${TAG_SALUTE}}${regola}`).limit(500));
  return ordinaSalute(righe.filter((d) => eMiaSalute(d, persona)));
}

// Nuovi tag di un documento quando lo metti in «Mia salute» o lo togli; gli altri tag restano.
export function tagSalute(tag, dentro) {
  const altri = (tag || []).filter((t) => t !== TAG_SALUTE && t !== TAG_NON_SALUTE);
  return [...altri, dentro ? TAG_SALUTE : TAG_NON_SALUTE];
}

export async function impostaSalute(db, docs, dentro) {
  for (const d of docs) {
    if (d.fascicolo === 'clinico_pazienti') continue;
    esito(await db.from('documenti').update({ tag: tagSalute(d.tag, dentro) }).eq('id', d.id).select('id'));
  }
}

// Dopo un caricamento da «La mia salute»: aggiunge il tag senza toccare quelli messi dallo script.
export async function mettiInSalute(db, id) {
  const riga = esito(await db.from('documenti').select('id, tag, fascicolo').eq('id', id).single());
  if (riga.fascicolo === 'clinico_pazienti' || (riga.tag || []).includes(TAG_SALUTE)) return;
  esito(await db.from('documenti').update({ tag: tagSalute(riga.tag, true) }).eq('id', id).select('id'));
}
