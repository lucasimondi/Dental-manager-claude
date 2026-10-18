// POL-VITA-001 — accesso ai dati dell'archivio personale (progetto Supabase separato).
// Ogni funzione riceve il client: la RLS del progetto lascia leggere e scrivere solo il PO.
import { capisciRichiesta, riepilogoDebito } from './coreArchivio.js';
import { filtroSezione } from './impostazioni.js';

export const CAMPI_DOC = 'id, titolo, riassunto, fascicolo, tipo_documento, data_documento, email_data, email_oggetto, email_mittente, importo, azione_richiesta, azione_descrizione, urgenza, drive_url, drive_file_id, nome_file_originale, mime_type, pratica_id, tag, gmail_message_id, creato_il, persona, categoria, ente, rilevanza';
const CAMPI_SCADENZA = `id, data, descrizione, importo, completata, documento_id, pratica_id, categoria, ricorrenza, storica, cartella,
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
  let q = db.from('scadenze').select(CAMPI_SCADENZA).eq('completata', false).eq('storica', false).order('data', { ascending: true });
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

// Pagamenti: solo quelli attuali (POL-VITA-014). Le scadenze ricavate da email di anni fa sono
// "storiche": restano nel loro documento ma non compaiono tra i pagamenti da fare.
export async function pagamenti(db) {
  return esito(await db.from('scadenze').select(CAMPI_SCADENZA).eq('storica', false).order('data', { ascending: true }).limit(1000));
}

// Scadenze di un documento appena caricato (per collegarle a Da pagare).
export async function scadenzeDelDocumento(db, documentoId) {
  return esito(await db.from('scadenze').select(CAMPI_SCADENZA).eq('documento_id', documentoId).order('data', { ascending: true }));
}

export async function eliminaScadenza(db, id) {
  return esito(await db.from('scadenze').delete().eq('id', id).select('id'));
}

// Campi che Luca può cambiare dall'app, uno per uno o su più documenti insieme.
const CAMPI_MODIFICABILI = ['persona', 'categoria', 'fascicolo', 'ente', 'rilevanza', 'titolo'];
function pulisciCampo(k, v) {
  const t = String(v ?? '').trim();
  if (k === 'fascicolo') return t || 'altro';
  if (k === 'rilevanza') return ['alta', 'normale', 'bassa'].includes(t) ? t : null;
  if (k === 'titolo') return t.slice(0, 160) || 'Documento';
  return t.slice(0, 120) || null;
}

export async function aggiornaDocumento(db, id, campi) {
  const consentiti = {};
  for (const k of CAMPI_MODIFICABILI) if (k in campi) consentiti[k] = pulisciCampo(k, campi[k]);
  return esito(await db.from('documenti').update(consentiti).eq('id', id).select('id, persona, categoria, fascicolo, ente, rilevanza, titolo').single());
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

// Pagamenti fissi: impostati una volta, si ripropongono dopo ogni pagamento.
export const RICORRENZE = [['', 'Una volta'], ['mensile', 'Ogni mese'], ['bimestrale', 'Ogni 2 mesi'], ['trimestrale', 'Ogni 3 mesi'], ['semestrale', 'Ogni 6 mesi'], ['annuale', 'Ogni anno']];
const MESI_RICORRENZA = { mensile: 1, bimestrale: 2, trimestrale: 3, semestrale: 6, annuale: 12 };

// Prossima scadenza di un pagamento fisso: stesso giorno N mesi dopo (fine mese se il giorno manca).
export function prossimaData(data, ricorrenza) {
  const n = MESI_RICORRENZA[ricorrenza];
  if (!n || !/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return null;
  const [a, m, g] = data.split('-').map(Number);
  const totale = (m - 1) + n;
  const anno = a + Math.floor(totale / 12), mese = (totale % 12) + 1;
  const giorni = new Date(anno, mese, 0).getDate();
  return `${anno}-${String(mese).padStart(2, '0')}-${String(Math.min(g, giorni)).padStart(2, '0')}`;
}

// Segnato pagato un pagamento fisso: crea il successivo (una volta sola, anche se si tocca due volte).
export async function prossimoPagamentoFisso(db, s) {
  const data = prossimaData(s.data, s.ricorrenza);
  if (!data) return null;
  const gia = esito(await db.from('scadenze').select('id, data').eq('descrizione', s.descrizione).eq('data', data).eq('storica', false).limit(1));
  if (gia.length) return gia[0];
  // nuovo: creato adesso dal "Pagato" (si toglie con Annulla); se c'era già resta com'è.
  return { ...esito(await db.from('scadenze').insert({
    data, descrizione: s.descrizione, importo: s.importo ?? null, categoria: s.categoria || null, ricorrenza: s.ricorrenza, completata: false,
  }).select('id, data').single()), nuovo: true };
}

// Bolletta, polizza, bollo… caricati da Conti: la lettura del documento (OCR + AI nello script) ha già
// creato le sue scadenze; qui si segna la categoria. Se non ne ha trovate, si crea il pagamento con
// titolo, importo e data letti, da controllare. Collega anche un documento a un pagamento esistente.
export async function pagamentoDaDocumento(db, documentoId, { categoria = null, pagamentoId = null } = {}) {
  if (pagamentoId) {
    return [esito(await db.from('scadenze').update({ documento_id: documentoId }).eq('id', pagamentoId).select(CAMPI_SCADENZA).single())];
  }
  const trovate = esito(await db.from('scadenze').select(CAMPI_SCADENZA).eq('documento_id', documentoId).order('data', { ascending: true }));
  if (trovate.length) {
    if (!categoria) return trovate;
    return esito(await db.from('scadenze').update({ categoria, storica: false }).eq('documento_id', documentoId).select(CAMPI_SCADENZA));
  }
  const doc = esito(await db.from('documenti').select('id, titolo, importo, data_documento, email_data').eq('id', documentoId).single());
  const data = doc.data_documento || String(doc.email_data || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  return [esito(await db.from('scadenze').insert({
    documento_id: documentoId, data, descrizione: doc.titolo || 'Pagamento', importo: doc.importo ?? null, categoria, completata: false,
  }).select(CAMPI_SCADENZA).single())];
}

export async function aggiornaScadenza(db, id, campi) {
  const riga = {};
  if ('descrizione' in campi) riga.descrizione = String(campi.descrizione || '').trim() || 'Scadenza';
  if ('data' in campi && /^\d{4}-\d{2}-\d{2}$/.test(campi.data)) riga.data = campi.data;
  if ('importo' in campi) riga.importo = campi.importo === '' || campi.importo == null ? null : Number(String(campi.importo).replace(',', '.'));
  if ('categoria' in campi) riga.categoria = String(campi.categoria || '').trim() || null;
  if ('ricorrenza' in campi) riga.ricorrenza = RICORRENZE.some(([k]) => k === campi.ricorrenza) ? campi.ricorrenza : null;
  if ('documento_id' in campi) riga.documento_id = campi.documento_id || null;
  if ('storica' in campi) riga.storica = !!campi.storica;
  return esito(await db.from('scadenze').update(riga).eq('id', id).select('id, data, descrizione, importo, completata, categoria, ricorrenza, documento_id, storica').single());
}

// POL-VITA-005 — chat Poliedron: l'AI (Claude, nello script) risponde usando strumenti di sola
// lettura sull'archivio; i documenti clinici dei pazienti non le vengono mai passati.
export async function chiediPoliedron(richiesta, fetchImpl = fetch) {
  return (await chiediPoliedronCompleto(richiesta, fetchImpl)).risposta;
}

// Risposta e proposte di pulizia in massa (PO 2026-10-18): le proposte si eseguono solo dopo la conferma di Luca.
export async function chiediPoliedronCompleto({ token, domanda, documentoId, storia, agenda }, fetchImpl = fetch) {
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const res = await fetchImpl(URL_CARICAMENTO, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, azione: 'chiedi', domanda, documento_id: documentoId || null, storia: (storia || []).slice(-6), ...(agenda ? { agenda } : {}) }),
  });
  let r;
  try { r = await res.json(); } catch { throw new Error('Assistente non raggiungibile.'); }
  if (!r.ok) throw new Error(r.errore || 'Assistente non disponibile.');
  return { risposta: r.risposta, proposte: Array.isArray(r.proposte) ? r.proposte : [] };
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

// POL-VITA-006 — pratica con i suoi pagamenti (la pagina della pratica).
export async function praticaCompleta(db, id) {
  const [pratica, scadenze] = await Promise.all([
    db.from('v_pratiche').select('*').eq('id', id).maybeSingle().then(esito),
    db.from('scadenze').select(CAMPI_SCADENZA).eq('pratica_id', id).order('data', { ascending: true }).then(esito),
  ]);
  return { ...(pratica || {}), scadenze };
}

/* ---------- POL-VITA-007: ricerca con filtri, enti, azioni su più documenti ---------- */
const parolaSicura = (w) => String(w).replace(/[",()*\\.:]/g, ' ').trim();

// Ricerca immediata: ogni parola deve comparire in titolo, ente, riassunto, tipo, mittente o nome
// del file. Filtri facoltativi; le cose "poco utili" (rilevanza bassa) si vedono solo se chieste.
export async function cercaArchivio(db, { testo = '', fascicolo, ente, anno, tipo, persona, anchePocoUtili = false, ordine = 'recenti', limite = 120 } = {}) {
  let q = db.from('documenti').select(CAMPI_DOC);
  for (const w of parolaSicura(testo).split(/\s+/).filter((x) => x.length > 1).slice(0, 6)) {
    const p = `*${w}*`;
    q = q.or(`titolo.ilike.${p},ente.ilike.${p},riassunto.ilike.${p},tipo_documento.ilike.${p},email_mittente.ilike.${p},nome_file_originale.ilike.${p},persona.ilike.${p}`);
  }
  if (fascicolo) q = q.eq('fascicolo', fascicolo);
  if (ente) q = q.eq('ente', ente);
  if (tipo) q = q.eq('tipo_documento', tipo);
  if (persona) q = q.eq('persona', persona);
  if (anno) {
    const a = Number(anno);
    q = q.or(`and(data_documento.gte.${a}-01-01,data_documento.lte.${a}-12-31),and(data_documento.is.null,email_data.gte.${a}-01-01,email_data.lt.${a + 1}-01-01)`);
  }
  if (!anchePocoUtili && !fascicolo && !ente) q = q.or('rilevanza.is.null,rilevanza.neq.bassa');
  q = ordine === 'titolo' ? q.order('titolo', { ascending: true }) : q.order('email_data', { ascending: false, nullsFirst: false });
  return esito(await q.limit(limite));
}

export async function enti(db) {
  return esito(await db.from('v_enti').select('ente, n, ultimo, fascicolo').order('n', { ascending: false }).limit(500));
}

// Stessa modifica su più documenti in una sola richiesta.
export async function aggiornaDocumenti(db, ids, campi) {
  if (!ids.length) return [];
  const consentiti = {};
  for (const k of CAMPI_MODIFICABILI) if (k in campi && k !== 'titolo') consentiti[k] = pulisciCampo(k, campi[k]);
  if (!Object.keys(consentiti).length) return [];
  return esito(await db.from('documenti').update(consentiti).in('id', ids).select('id'));
}

// Personali: aggiunge o toglie il tag a più documenti, senza toccare gli altri tag.
export async function portafoglioDocumenti(db, docs, dentro) {
  for (const d of docs) await impostaPortafoglio(db, d, dentro);
}

// Eliminazione di più documenti, uno alla volta (stessa funzione del singolo); i file su Drive restano.
export async function eliminaDocumenti(db, ids, avanzamento = () => {}) {
  let fatti = 0;
  for (const id of ids) {
    await eliminaDocumento(db, id);
    fatti += 1;
    avanzamento(fatti, ids.length);
  }
  return fatti;
}

// Pulizia in massa (scelta di Luca, 2026-10-18): le email da cui arrivano i documenti eliminati vanno nel
// Cestino di Gmail (30 giorni), solo se tutti i loro allegati archiviati sono tra quelli eliminati.
export async function cestinaEmail({ token, ids }, fetchImpl = fetch) {
  const validi = [...new Set((ids || []).filter(Boolean))];
  if (!validi.length) return { cestinate: 0, tenute: 0 };
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const esito = { cestinate: 0, tenute: 0 };
  for (let i = 0; i < validi.length; i += 100) {
    const res = await fetchImpl(URL_CARICAMENTO, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, azione: 'cestina_email', ids: validi.slice(i, i + 100) }),
    });
    let r;
    try { r = await res.json(); } catch { throw new Error('Gmail non raggiungibile: nessun documento eliminato.'); }
    if (!r.ok) throw new Error(r.errore || 'Email non spostate nel Cestino: nessun documento eliminato.');
    esito.cestinate += r.cestinate || 0;
    esito.tenute += r.tenute || 0;
  }
  return esito;
}

// Su richiesta di Luca (scelta nella conferma): i file vanno nel Cestino di Google Drive, a blocchi.
export async function cestinaSuDrive({ token, ids }, fetchImpl = fetch) {
  const validi = [...new Set((ids || []).filter(Boolean))];
  if (!validi.length) return { cestinati: [], non_trovati: [] };
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const esito = { cestinati: [], non_trovati: [] };
  for (let i = 0; i < validi.length; i += 50) {
    const res = await fetchImpl(URL_CARICAMENTO, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, azione: 'cestina', ids: validi.slice(i, i + 50) }),
    });
    let r;
    try { r = await res.json(); } catch { throw new Error('Google Drive non raggiungibile: nessun documento eliminato.'); }
    if (!r.ok) throw new Error(r.errore || 'Eliminazione da Drive non riuscita: nessun documento eliminato.');
    esito.cestinati.push(...(r.cestinati || []));
    esito.non_trovati.push(...(r.non_trovati || []));
  }
  return esito;
}
