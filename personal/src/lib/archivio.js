// POL-VITA-001 — accesso ai dati dell'archivio personale (progetto Supabase separato).
// Ogni funzione riceve il client: la RLS del progetto lascia leggere e scrivere solo il PO.
import { capisciRichiesta, riepilogoDebito } from './coreArchivio.js';
import { filtroSezione } from './impostazioni.js';

const CAMPI_DOC = 'id, titolo, riassunto, fascicolo, tipo_documento, data_documento, email_data, email_oggetto, email_mittente, importo, azione_richiesta, azione_descrizione, urgenza, drive_url, drive_file_id, nome_file_originale, mime_type, pratica_id, tag, gmail_message_id, creato_il, persona, categoria';
const CAMPI_SCADENZA = `id, data, descrizione, importo, completata, documento_id, pratica_id,
  documento:documenti(id, titolo, drive_url, fascicolo), pratica:pratiche(id, titolo)`;

const esito = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Errore archivio');
  return data;
};

const oggiIso = () => new Date().toISOString().slice(0, 10);
const traGiorni = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export async function cercaDocumenti(db, testo, fascicolo = null, limite = 50) {
  return esito(await db.rpc('cerca_documenti', { q: testo || '', fasc: fascicolo, lim: limite }));
}

export async function scadenzeAperte(db, entroGiorni = null) {
  let q = db.from('scadenze').select(CAMPI_SCADENZA).eq('completata', false).order('data', { ascending: true });
  if (entroGiorni != null) q = q.lte('data', traGiorni(entroGiorni));
  return esito(await q);
}

export async function scadenzeDeiDocumenti(db, idDocumenti) {
  if (!idDocumenti.length) return [];
  return esito(await db.from('scadenze').select(CAMPI_SCADENZA).in('documento_id', idDocumenti).order('data', { ascending: true }));
}

export async function documentiDaGestire(db) {
  const rango = { alta: 0, media: 1, bassa: 2 };
  const documenti = esito(await db.from('documenti').select(CAMPI_DOC).eq('azione_richiesta', true)
    .order('email_data', { ascending: false }).limit(50));
  return [...documenti].sort((a, b) => (rango[a.urgenza] ?? 3) - (rango[b.urgenza] ?? 3));
}

export async function pratiche(db, testo = '') {
  let q = db.from('v_pratiche').select('*').order('aggiornata_il', { ascending: false }).limit(100);
  if (testo) q = q.ilike('titolo', `%${testo}%`);
  return esito(await q);
}

export async function documentiDellaPratica(db, praticaId) {
  return esito(await db.from('documenti').select(CAMPI_DOC).eq('pratica_id', praticaId).order('email_data', { ascending: false }));
}

export async function conteggiFascicoli(db) {
  return esito(await db.from('v_conteggi_fascicoli').select('*').order('ordine', { ascending: true }));
}

export async function segnaScadenza(db, id, completata = true) {
  return esito(await db.from('scadenze').update({ completata }).eq('id', id).select('id, completata').single());
}

export async function cambiaStatoPratica(db, id, stato) {
  return esito(await db.from('pratiche').update({ stato, aggiornata_il: new Date().toISOString() }).eq('id', id).select('id, stato').single());
}

// Cancellazione definitiva; restituisce gli id dei file Drive ancora da togliere.
// Usa la funzione del database (una sola transazione). Se non è ancora installata, fa gli
// stessi passi dall'app con i permessi del proprietario (RLS): log, documento (scadenze e
// collegamenti in cascata), soggetti rimasti senza documenti.
export async function eliminaDocumento(db, id) {
  const r = await db.rpc('elimina_documento', { p_id: id });
  if (!r.error) return r.data;
  if (!/elimina_documento|PGRST202|schema cache|does not exist/i.test(`${r.error.code} ${r.error.message}`)) esito(r);

  const doc = esito(await db.from('documenti').select('id, hash_sha256, gmail_message_id, drive_file_id').eq('id', id).maybeSingle());
  if (!doc) return { eliminato: false };
  const legami = esito(await db.from('documenti_soggetti').select('soggetto_id').eq('documento_id', id));
  esito(await db.from('log_elaborazione').delete().in('riferimento', [doc.id, doc.hash_sha256, doc.gmail_message_id].filter(Boolean)));
  esito(await db.from('documenti').delete().eq('id', id));
  for (const { soggetto_id: sid } of legami) {
    const ancora = esito(await db.from('documenti_soggetti').select('documento_id').eq('soggetto_id', sid).limit(1));
    if (!ancora.length) esito(await db.from('soggetti').delete().eq('id', sid));
  }
  return { eliminato: true, drive_file_ids: doc.drive_file_id ? [doc.drive_file_id] : [] };
}

// Risponde a una richiesta in linguaggio naturale con il solo Core (nessun modello AI).
export async function rispondi(db, testo) {
  const richiesta = capisciRichiesta(testo);
  switch (richiesta.intento) {
    case 'VUOTO':
      return { richiesta, tipo: 'vuoto' };
    case 'DEBITO': {
      const documenti = await cercaDocumenti(db, richiesta.controparte, null, 200);
      const scadenze = await scadenzeDeiDocumenti(db, documenti.map((d) => d.id));
      return { richiesta, tipo: 'debito', documenti, ...riepilogoDebito(richiesta.controparte, scadenze) };
    }
    case 'SCADENZE': {
      const scadenze = await scadenzeAperte(db, richiesta.entroGiorni);
      const scadute = scadenze.filter((s) => s.data < oggiIso()).length;
      return { richiesta, tipo: 'scadenze', scadenze, scadute };
    }
    case 'AZIONI':
      return { richiesta, tipo: 'documenti', titolo: 'Da gestire', documenti: await documentiDaGestire(db) };
    case 'PRATICHE':
      return { richiesta, tipo: 'pratiche', pratiche: await pratiche(db) };
    case 'PRATICA':
      return { richiesta, tipo: 'pratiche', pratiche: await pratiche(db, richiesta.testo) };
    case 'FASCICOLO':
      return { richiesta, tipo: 'documenti', titolo: null, fascicolo: richiesta.fascicolo, documenti: await cercaDocumenti(db, '', richiesta.fascicolo) };
    default:
      return { richiesta, tipo: 'documenti', titolo: null, documenti: await cercaDocumenti(db, richiesta.testo) };
  }
}

// POL-VITA-003 — documenti caricati dall'app e Portafoglio.
// Web app Apps Script del PO (indirizzo pubblico: l'accesso è verificato dal token di sessione).
export const URL_CARICAMENTO = 'https://script.google.com/macros/s/AKfycbzQf7Hb8R4zBC8xAa3N-BH6GnScWO__a_kQgZ6uMHhFGLr4rsVYupyLBfpxJHlmIwSUDw/exec';
export const TAG_PORTAFOGLIO = 'portafoglio';

export const eCaricato = (doc) => String(doc?.gmail_message_id || '').startsWith('caricato:');
export const nelPortafoglio = (doc) => (doc?.tag || []).includes(TAG_PORTAFOGLIO);

export async function documentiRecenti(db, limite = 10) {
  return esito(await db.from('documenti').select(CAMPI_DOC).order('creato_il', { ascending: false }).limit(limite));
}

// Portafoglio: i documenti che Luca ha messo a portata di mano, più tutti quelli d'identità.
export async function portafoglio(db) {
  return esito(await db.from('documenti').select(CAMPI_DOC)
    .or(`tag.cs.{${TAG_PORTAFOGLIO}},fascicolo.eq.identita`)
    .order('creato_il', { ascending: false }).limit(200));
}

export async function documentoCompleto(db, id) {
  return esito(await db.from('documenti')
    .select(`${CAMPI_DOC}, dati_estratti, analisi_contenuto, scadenze(id, data, descrizione, importo, completata), pratica:pratiche(id, titolo, stato)`)
    .eq('id', id).single());
}

export async function impostaPortafoglio(db, doc, dentro) {
  const altri = (doc.tag || []).filter((t) => t !== TAG_PORTAFOGLIO);
  const tag = dentro ? [...altri, TAG_PORTAFOGLIO] : altri;
  return esito(await db.from('documenti').update({ tag }).eq('id', doc.id).select('id, tag').single());
}

export async function spostaFascicolo(db, id, fascicolo) {
  return esito(await db.from('documenti').update({ fascicolo }).eq('id', id).select('id, fascicolo').single());
}

// Invia il file allo script, che lo salva su Drive e lo cataloga. Content-Type text/plain:
// richiesta "semplice", senza preflight CORS (Apps Script non risponde alle OPTIONS).
export async function caricaDocumento({ token, dati, nome, mime, descrizione, fascicolo, portafoglio: tieni, nonAnalizzare, persona, categoria }, fetchImpl = fetch) {
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const res = await fetchImpl(URL_CARICAMENTO, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, dati, nome, mime, descrizione: descrizione || '', fascicolo: fascicolo || null, portafoglio: !!tieni, nonAnalizzare: !!nonAnalizzare, persona: persona || null, categoria: categoria || null }),
  });
  let r;
  try { r = await res.json(); } catch { throw new Error('Risposta non valida dallo script di archiviazione.'); }
  if (!r.ok) throw new Error(r.errore || 'Caricamento non riuscito');
  return r;
}

// Anteprima: lo script restituisce il file solo se appartiene a un documento dell'archivio.
export async function anteprimaFile({ token, driveFileId }, fetchImpl = fetch) {
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const res = await fetchImpl(URL_CARICAMENTO, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, azione: 'file', drive_file_id: driveFileId }),
  });
  let r;
  try { r = await res.json(); } catch { throw new Error('Anteprima non disponibile.'); }
  if (!r.ok) throw new Error(r.errore || 'Anteprima non disponibile.');
  return r;
}

// Pagamenti: tutte le scadenze, con il documento e la pratica da cui derivano.
export async function pagamenti(db) {
  return esito(await db.from('scadenze').select(CAMPI_SCADENZA).order('data', { ascending: true }).limit(1000));
}

export async function eliminaScadenza(db, id) {
  return esito(await db.from('scadenze').delete().eq('id', id).select('id'));
}

export async function aggiornaDocumento(db, id, campi) {
  const consentiti = {};
  for (const k of ['persona', 'categoria', 'fascicolo']) if (k in campi) consentiti[k] = campi[k] || (k === 'fascicolo' ? 'altro' : null);
  return esito(await db.from('documenti').update(consentiti).eq('id', id).select('id, persona, categoria, fascicolo').single());
}

export async function documentiSezione(db, sezione) {
  const filtro = filtroSezione(sezione);
  if (!filtro) return [];
  return esito(await db.from('documenti').select(CAMPI_DOC).or(filtro).order('email_data', { ascending: false }).limit(300));
}

// Documenti personali: con categoria o persona, d'identità, o tenuti a portata di mano.
export async function documentiPersonali(db) {
  return esito(await db.from('documenti').select(CAMPI_DOC)
    .or(`categoria.not.is.null,persona.not.is.null,fascicolo.eq.identita,tag.cs.{${TAG_PORTAFOGLIO}}`)
    .order('creato_il', { ascending: false }).limit(300));
}

export async function aggiornaScadenza(db, id, campi) {
  const riga = {};
  if ('descrizione' in campi) riga.descrizione = String(campi.descrizione || '').trim() || 'Scadenza';
  if ('data' in campi && /^\d{4}-\d{2}-\d{2}$/.test(campi.data)) riga.data = campi.data;
  if ('importo' in campi) riga.importo = campi.importo === '' || campi.importo == null ? null : Number(String(campi.importo).replace(',', '.'));
  return esito(await db.from('scadenze').update(riga).eq('id', id).select('id, data, descrizione, importo, completata').single());
}

// POL-VITA-005 — chat Poliedron: l'AI (Claude, nello script) risponde usando strumenti di sola
// lettura sull'archivio; i documenti clinici dei pazienti non le vengono mai passati.
export async function chiediPoliedron({ token, domanda, documentoId, storia }, fetchImpl = fetch) {
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const res = await fetchImpl(URL_CARICAMENTO, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, azione: 'chiedi', domanda, documento_id: documentoId || null, storia: (storia || []).slice(-6) }),
  });
  let r;
  try { r = await res.json(); } catch { throw new Error('Assistente non raggiungibile.'); }
  if (!r.ok) throw new Error(r.errore || 'Assistente non disponibile.');
  return r.risposta;
}

// Testo della risposta → parti: testo semplice e link ai documenti [[doc:ID|titolo]].
export function partiRisposta(testo) {
  const parti = [];
  const re = /\[\[doc:([0-9a-f-]{36})(?:\|([^\]]*))?\]\]/gi;
  let ultimo = 0;
  let m;
  while ((m = re.exec(testo))) {
    if (m.index > ultimo) parti.push({ testo: testo.slice(ultimo, m.index) });
    parti.push({ doc: m[1], titolo: (m[2] || 'documento').trim() });
    ultimo = re.lastIndex;
  }
  if (ultimo < testo.length) parti.push({ testo: testo.slice(ultimo) });
  return parti;
}
