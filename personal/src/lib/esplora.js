// PERSONAL-ESPLORA-WIN11 fase 1 — Esplora file (stile Windows 11) sui dati che ci sono già.
// Albero: «Personale» (= Archivio personale/ su Drive; dentro: le cartelle in cima e i file della
// scrivania) con le cartelle mie, più due cartelle virtuali in sola lettura da cui si trascina via:
// «Da catalogare» (documenti in nessuna cartella mia) e «Per categoria» (un nodo per fascicolo).
// In Esplora un documento ha UNA posizione: Sposta = tolto dalla cartella di partenza (se è una
// cartella mia) e aggiunto a quella di arrivo, con la RPC atomica `sposta_documenti_mie` (POL-VITA-033).
// Fase 2: subito dopo, il file si sposta anche su Drive nella cartella gemella (azioni dello script
// `sposta_documenti` e `cartella_drive`); se Drive non risponde resta la nota '>cartella:<id>' e lo
// script lo rifà al giro successivo.
// Qui la logica è pura (testabile senza DOM); in fondo le letture/scritture sul database.
import { CAMPI_DOC, URL_CARICAMENTO } from './archivio.js';
import { discendenti, percorso } from './cartelleMie.js';
import { scadenzaDaGestire, oggiRoma, limiteAvviso } from './revisioneArchivio.js';

export const RADICE = 'radice';
export const DA_CATALOGARE = 'da-catalogare';
export const CATEGORIE = 'categorie';
export const FUORI = 'fuori'; // un documento che non sta in nessuna cartella mia (né sulla scrivania)
export const CLINICO = 'clinico_pazienti';
export const nodoCategoria = (codice) => `categoria:${codice}`;
export const codiceCategoria = (nodo) => (String(nodo).startsWith('categoria:') ? String(nodo).slice(10) : null);
export const eVirtuale = (nodo) => nodo === DA_CATALOGARE || nodo === CATEGORIE || !!codiceCategoria(nodo);
export const NOME_RADICE = 'Personale';

/* ---------- disposizione ---------- */

// Decisa dall'orientamento, non dal dispositivo.
export const disposizione = (larghezza, altezza) => (larghezza > altezza ? 'orizzontale' : 'verticale');
export const colonneGriglia = (disp) => (disp === 'orizzontale' ? 6 : 4);
// Altezza dell'albero in verticale: 300 px di partenza, tra 120 px e metà schermo.
export const altezzaAlbero = (voluta, altezzaSchermo) => Math.round(Math.max(120, Math.min(voluta, altezzaSchermo * 0.55)));

/* ---------- albero e posizioni ---------- */

const vive = (cartelle) => cartelle.filter((c) => !c.archiviata_il);
const ordina = (a, b) => ((a.posizione ?? 0) - (b.posizione ?? 0)) || String(a.nome).localeCompare(String(b.nome), 'it');

export function cartellaDi(cartelle, nodo) { return cartelle.find((c) => c.id === nodo && !c.archiviata_il) || null; }

// Esiste ed è una cartella vera (Personale o una cartella mia non archiviata)?
export const eCartellaVera = (cartelle, nodo) => nodo === RADICE || !!cartellaDi(cartelle, nodo);

// Sottocartelle mie (non archiviate) di un nodo vero.
export function sottocartelle(cartelle, nodo) {
  if (nodo !== RADICE && !cartellaDi(cartelle, nodo)) return [];
  const padre = nodo === RADICE ? null : nodo;
  return vive(cartelle).filter((c) => (c.padre_id || null) === padre).sort(ordina);
}

export function padreDi(cartelle, nodo) {
  if (nodo === RADICE || nodo === DA_CATALOGARE || nodo === CATEGORIE) return null;
  if (codiceCategoria(nodo)) return CATEGORIE;
  const c = cartellaDi(cartelle, nodo);
  return c ? (c.padre_id || RADICE) : null;
}

const nomeCategoria = (fascicoli, codice) => fascicoli.find((f) => f.codice === codice)?.nome || codice;

export function nomeNodo(nodo, { cartelle = [], fascicoli = [] } = {}) {
  if (nodo === RADICE) return NOME_RADICE;
  if (nodo === DA_CATALOGARE) return 'Da catalogare';
  if (nodo === CATEGORIE) return 'Per categoria';
  const f = codiceCategoria(nodo);
  if (f) return nomeCategoria(fascicoli, f);
  return cartellaDi(cartelle, nodo)?.nome || 'Cartella';
}

// Dalla cima al nodo: [{id, nome}], per il percorso cliccabile.
export function percorsoNodo(nodo, { cartelle = [], fascicoli = [] } = {}) {
  if (nodo === RADICE) return [{ id: RADICE, nome: NOME_RADICE }];
  if (nodo === DA_CATALOGARE || nodo === CATEGORIE) return [{ id: nodo, nome: nomeNodo(nodo) }];
  const f = codiceCategoria(nodo);
  if (f) return [{ id: CATEGORIE, nome: 'Per categoria' }, { id: nodo, nome: nomeCategoria(fascicoli, f) }];
  return [{ id: RADICE, nome: NOME_RADICE }, ...percorso(vive(cartelle), nodo)];
}

// I nodi aperti per mostrare `nodo` nell'albero (tutti i suoi antenati).
export const antenati = (nodo, opz) => percorsoNodo(nodo, opz).slice(0, -1).map((p) => p.id);

// Categorie mostrate: i fascicoli esistenti, mai i documenti clinici dei pazienti.
export const categorieVisibili = (fascicoli) => fascicoli.filter((f) => f.codice !== CLINICO).sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));

// posizioni: [{ doc, nodo }] con nodo = id cartella oppure RADICE (scrivania).
export const documentiNelNodo = (posizioni, nodo) => posizioni.filter((p) => p.nodo === nodo).map((p) => p.doc);
export const nodiDelDocumento = (posizioni, doc) => posizioni.filter((p) => p.doc === doc).map((p) => p.nodo);
export const catalogati = (posizioni) => new Set(posizioni.map((p) => p.doc));

/* ---------- pallini rossi ---------- */

// Documenti «da gestire»: scadenza aperta già passata o entro 14 giorni (regola condivisa con
// Documenti), oppure `azione_richiesta` non fatta. Mai i clinici. → Map id documento → fascicolo.
export function documentiDaGestire({ scadenze = [], azioni = [], oggi = oggiRoma() } = {}) {
  const fuori = new Map();
  const entro = limiteAvviso(oggi);
  for (const s of scadenze) {
    if (!s.documento_id || s.documento?.fascicolo === CLINICO) continue;
    if (scadenzaDaGestire(s, oggi, entro)) fuori.set(s.documento_id, s.documento?.fascicolo || null);
  }
  for (const d of azioni) if (d.azione_richiesta && d.fascicolo !== CLINICO) fuori.set(d.id, d.fascicolo || null);
  return fuori;
}

/**
 * Numero sul pallino di ogni nodo, contando anche le sottocartelle (ogni documento una volta sola).
 * @returns {Map<string, number>}
 */
export function calcolaPallini({ cartelle = [], posizioni = [], daGestire = new Map(), nDaCatalogare = 0, fascicoli = [] }) {
  const n = new Map();
  const perNodo = new Map();
  for (const p of posizioni) {
    if (!daGestire.has(p.doc)) continue;
    if (!perNodo.has(p.nodo)) perNodo.set(p.nodo, new Set());
    perNodo.get(p.nodo).add(p.doc);
  }
  const unione = (nodi) => { const s = new Set(); for (const x of nodi) for (const d of perNodo.get(x) || []) s.add(d); return s.size; };
  const viveC = vive(cartelle);
  for (const c of viveC) n.set(c.id, unione(discendenti(viveC, c.id)));
  n.set(RADICE, unione([RADICE, ...viveC.map((c) => c.id)]));
  n.set(DA_CATALOGARE, nDaCatalogare);
  let tot = 0;
  for (const f of categorieVisibili(fascicoli)) {
    let k = 0;
    for (const fasc of daGestire.values()) if (fasc === f.codice) k += 1;
    n.set(nodoCategoria(f.codice), k); tot += k;
  }
  n.set(CATEGORIE, tot);
  return n;
}

// Totale «da gestire» per l'icona di Esplora (barra in basso): ogni documento una volta.
export const totaleDaGestire = (daGestire) => daGestire.size;

export const etichettaPallino = (n) => (!n || n < 1 ? null : n > 999 ? '999+' : String(n));
export const testoStato = (elementi, daGestire) => `${elementi} ${elementi === 1 ? 'elemento' : 'elementi'} · ${daGestire} da gestire`;

/* ---------- spostamenti ---------- */

// sorgente: { tipo: 'cartella'|'doc', id, da } — `da` è il nodo in cui l'elemento è mostrato.
const daEffettivo = (s, cartelle) => (s.tipo === 'cartella' ? (cartellaDi(cartelle, s.id)?.padre_id || RADICE) : (eVirtuale(s.da) || !s.da ? FUORI : s.da));

// Perché non si può lasciare lì (null = si può).
export function motivoNonValido(sorgenti, dest, { cartelle = [], posizioni = [] } = {}) {
  if (!sorgenti?.length) return 'niente da spostare';
  if (!dest || eVirtuale(dest)) return 'le cartelle virtuali sono solo di partenza';
  if (!eCartellaVera(cartelle, dest)) return 'cartella non trovata';
  for (const s of sorgenti) {
    if (s.tipo === 'cartella') {
      if (!cartellaDi(cartelle, s.id)) return 'cartella non trovata';
      if (discendenti(vive(cartelle), s.id).has(dest)) return 'non dentro sé stessa';
      if (daEffettivo(s, cartelle) === dest) return 'è già qui';
    } else {
      const da = daEffettivo(s, cartelle);
      if (da === dest) return 'è già qui';
      if (posizioni.some((p) => p.doc === s.id && p.nodo === dest)) return 'è già qui';
    }
  }
  return null;
}
export const destinazioneValida = (sorgenti, dest, opz) => motivoNonValido(sorgenti, dest, opz) === null;

// Le destinazioni del foglio «Sposta in…»: [{id, nome, livello, vietata, attuale}].
export function vociSpostaIn(sorgenti, { cartelle = [], posizioni = [] } = {}) {
  const fuori = [];
  const attuali = new Set(sorgenti.map((s) => daEffettivo(s, cartelle)));
  const aggiungi = (nodo, nome, livello) => fuori.push({ id: nodo, nome, livello, attuale: attuali.has(nodo), vietata: !destinazioneValida(sorgenti, nodo, { cartelle, posizioni }) });
  const giu = (nodo, livello) => { for (const c of sottocartelle(cartelle, nodo)) { aggiungi(c.id, c.nome, livello); giu(c.id, livello + 1); } };
  aggiungi(RADICE, NOME_RADICE, 0);
  giu(RADICE, 1);
  return fuori;
}

/**
 * L'operazione «sposta» (null se non valida): un elenco di mosse { tipo, id, da, a }.
 * Per i documenti `da` è FUORI quando arrivano da una cartella virtuale.
 */
export function operazioneSposta(sorgenti, dest, opz = {}) {
  if (!destinazioneValida(sorgenti, dest, opz)) return null;
  const { cartelle = [] } = opz;
  return { tipo: 'sposta', mosse: sorgenti.map((s) => ({ tipo: s.tipo, id: s.id, da: daEffettivo(s, cartelle), a: dest })) };
}

export function inversa(op) {
  if (!op) return null;
  if (op.tipo === 'sposta') return { tipo: 'sposta', mosse: op.mosse.map((m) => ({ ...m, da: m.a, a: m.da })) };
  if (op.tipo === 'archivia') return { ...op, tipo: 'ripristina' };
  if (op.tipo === 'ripristina') return { ...op, tipo: 'archivia' };
  if (op.tipo === 'rinomina') return { ...op, da: op.a, a: op.da };
  if (op.tipo === 'crea') return { tipo: 'archivia', ids: [op.id] };
  return null;
}

// Aggiornamento ottimistico (puro): { cartelle, posizioni, titoli } → nuovo stato.
export function applica(stato, op, adesso = new Date().toISOString()) {
  if (!op) return stato;
  let { cartelle, posizioni } = stato;
  const titoli = { ...(stato.titoli || {}) };
  if (op.tipo === 'sposta') {
    for (const m of op.mosse) {
      if (m.tipo === 'cartella') {
        cartelle = cartelle.map((c) => (c.id === m.id ? { ...c, padre_id: m.a === RADICE ? null : m.a } : c));
      } else {
        if (m.da !== FUORI) posizioni = posizioni.filter((p) => !(p.doc === m.id && p.nodo === m.da));
        if (m.a !== FUORI && !posizioni.some((p) => p.doc === m.id && p.nodo === m.a)) posizioni = [...posizioni, { doc: m.id, nodo: m.a }];
      }
    }
  } else if (op.tipo === 'archivia' || op.tipo === 'ripristina') {
    const ids = new Set(op.ids);
    cartelle = cartelle.map((c) => (ids.has(c.id) ? { ...c, archiviata_il: op.tipo === 'archivia' ? adesso : null } : c));
  } else if (op.tipo === 'rinomina') {
    if (op.cosa === 'cartella') cartelle = cartelle.map((c) => (c.id === op.id ? { ...c, nome: op.a } : c));
    else titoli[op.id] = op.a;
  } else if (op.tipo === 'crea') {
    cartelle = [...cartelle, { id: op.id, nome: op.nome, padre_id: op.padre === RADICE ? null : op.padre, posizione: 0, archiviata_il: null, n_documenti: 0, n_sottocartelle: 0 }];
  }
  return { ...stato, cartelle, posizioni, titoli };
}

// Le chiamate al database di un'operazione, raggruppate (puro).
export function chiamate(op) {
  if (!op) return [];
  if (op.tipo === 'archivia' || op.tipo === 'ripristina') return [{ fn: op.tipo, ids: op.ids }];
  if (op.tipo === 'rinomina') return [{ fn: op.cosa === 'cartella' ? 'rinominaCartella' : 'rinominaDocumento', id: op.id, nome: op.a }];
  if (op.tipo !== 'sposta') return [];
  const fuori = [];
  const perPadre = new Map();
  const perCoppia = new Map();
  for (const m of op.mosse) {
    if (m.tipo === 'cartella') {
      const k = m.a;
      if (!perPadre.has(k)) perPadre.set(k, []);
      perPadre.get(k).push(m.id);
    } else {
      const k = `${m.da}|${m.a}`;
      if (!perCoppia.has(k)) perCoppia.set(k, { da: m.da, a: m.a, ids: [] });
      perCoppia.get(k).ids.push(m.id);
    }
  }
  for (const [a, ids] of perPadre) fuori.push({ fn: 'spostaCartelle', ids, padre: a === RADICE ? null : a });
  for (const { da, a, ids } of perCoppia.values()) {
    if (da === a) continue;
    if (da === FUORI) fuori.push(a === RADICE ? { fn: 'aggiungiAScrivania', ids } : { fn: 'aggiungiDocumenti', cartella: a, ids });
    else if (a === FUORI) fuori.push(da === RADICE ? { fn: 'togliDaScrivania', ids } : { fn: 'togliDocumenti', cartella: da, ids });
    else fuori.push({ fn: 'spostaDocumenti', ids, da: da === RADICE ? null : da, a: a === RADICE ? null : a });
  }
  return fuori;
}

/* ---------- Taglia / Incolla ---------- */

export const taglia = (sorgenti, nome) => (sorgenti?.length ? { sorgenti, nome: nome || (sorgenti.length === 1 ? 'elemento' : `${sorgenti.length} elementi`) } : null);
export const incolla = (appunti, dest, opz) => (appunti ? operazioneSposta(appunti.sorgenti, dest, opz) : null);

/* ---------- nuova cartella e menu ---------- */

export function nomeNuovaCartella(esistenti, base = 'Nuova cartella') {
  const usati = new Set(esistenti.map((n) => String(n).toLowerCase()));
  if (!usati.has(base.toLowerCase())) return base;
  let i = 2;
  while (usati.has(`${base} (${i})`.toLowerCase())) i += 1;
  return `${base} (${i})`;
}

// Voci del menu contestuale con `attiva` (le non applicabili restano visibili, disattivate).
export function vociMenu(cosa, { nodo, appunti = null, opz = {}, clinico = false } = {}) {
  if (cosa === 'vuoto') {
    const vero = !eVirtuale(nodo);
    return [
      { id: 'nuova', nome: 'Nuova cartella', attiva: vero },
      { id: 'incolla', nome: appunti ? `Incolla «${appunti.nome}»` : 'Incolla', attiva: vero && !!incolla(appunti, nodo, opz) },
      { id: 'aggiorna', nome: 'Aggiorna', attiva: true },
    ];
  }
  if (cosa === 'file') {
    return [
      { id: 'apri', nome: 'Apri', attiva: true },
      { id: 'taglia', nome: 'Taglia', attiva: true },
      { id: 'sposta', nome: 'Sposta in…', attiva: true },
      { id: 'rinomina', nome: 'Rinomina', attiva: true },
      { id: 'elimina', nome: 'Elimina', attiva: !clinico },
    ];
  }
  // cartella (mia, Personale o virtuale)
  const mia = nodo !== RADICE && !eVirtuale(nodo);
  return [
    { id: 'apri', nome: 'Apri', attiva: true },
    { id: 'nuova', nome: 'Nuova cartella qui', attiva: !eVirtuale(nodo) },
    { id: 'taglia', nome: 'Taglia', attiva: mia },
    { id: 'sposta', nome: 'Sposta in…', attiva: mia },
    { id: 'rinomina', nome: 'Rinomina', attiva: mia },
    { id: 'elimina', nome: 'Elimina', attiva: mia },
  ];
}

// Il menu resta dentro lo schermo (8 px di margine).
export function posizioneMenu(x, y, larghezza, altezza, schermoL, schermoA, margine = 8) {
  return {
    left: Math.round(Math.max(margine, Math.min(x, schermoL - larghezza - margine))),
    top: Math.round(Math.max(margine, Math.min(y, schermoA - altezza - margine))),
  };
}

/* ---------- icone dei file ---------- */
export function tipoFile(d = {}) {
  const nome = String(d.nome_file_originale || '').toLowerCase();
  const mime = String(d.mime_type || '').toLowerCase();
  if (mime === 'application/pdf' || nome.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic)$/.test(nome)) return 'immagine';
  if (/word|excel|spreadsheet|presentation|officedocument|msword/.test(mime) || /\.(docx?|xlsx?|pptx?|odt|ods)$/.test(nome)) return 'office';
  if (mime === 'message/rfc822') return 'email';
  return 'altro';
}

/* ---------- database ---------- */

const esito = ({ data, error, count }) => { if (error) throw new Error(error.message); return count ?? data; };

// Tutte le posizioni dei documenti nelle cartelle mie e sulla scrivania, con il fascicolo.
export async function caricaPosizioni(db) {
  const [inCartelle, scrivania] = await Promise.all([
    db.from('cartelle_mie_documenti').select('cartella_id, documento_id, documenti(fascicolo)').limit(20000).then(esito),
    db.from('cartelle_mie_scrivania').select('documento_id, documenti(fascicolo)').limit(20000).then(esito),
  ]);
  const fascicoloDi = new Map();
  const posizioni = [];
  for (const r of inCartelle) { posizioni.push({ doc: r.documento_id, nodo: r.cartella_id }); fascicoloDi.set(r.documento_id, r.documenti?.fascicolo || null); }
  for (const r of scrivania) { posizioni.push({ doc: r.documento_id, nodo: RADICE }); fascicoloDi.set(r.documento_id, r.documenti?.fascicolo || null); }
  return { posizioni, fascicoloDi };
}

// Scadenze aperte e documenti con un'azione richiesta (per i pallini).
export async function caricaDaGestire(db) {
  const [scadenze, azioni] = await Promise.all([
    db.from('scadenze').select('id, data, importo, completata, storica, documento_id, documento:documenti(id, titolo, fascicolo, tipo_documento, riassunto, email_oggetto, tag, analisi_contenuto)')
      .eq('completata', false).eq('storica', false).not('documento_id', 'is', null).limit(5000).then(esito),
    db.from('documenti').select('id, fascicolo, azione_richiesta').eq('azione_richiesta', true).neq('fascicolo', CLINICO).limit(5000).then(esito),
  ]);
  return documentiDaGestire({ scadenze, azioni });
}

// Documenti da smistare: tutti (non clinici) meno quelli già in una cartella mia o sulla scrivania.
export async function contaDaCatalogare(db, fascicoloDi) {
  const tot = await db.from('documenti').select('id', { count: 'exact', head: true }).neq('fascicolo', CLINICO).then(esito);
  let dentro = 0;
  for (const f of fascicoloDi.values()) if (f !== CLINICO) dentro += 1;
  return Math.max(0, (tot || 0) - dentro);
}

// Una pagina di «Da catalogare», più recenti prima; `da` è lo scostamento nella lista completa.
export async function paginaDaCatalogare(db, { esclusi, da = 0, quanti = 60, blocco = 200 }) {
  const fuori = [];
  let pos = da;
  for (let giri = 0; giri < 10 && fuori.length < quanti; giri += 1) {
    const righe = await db.from('documenti').select(CAMPI_DOC).neq('fascicolo', CLINICO)
      .order('creato_il', { ascending: false }).order('id', { ascending: true }).range(pos, pos + blocco - 1).then(esito);
    let letti = 0;
    for (const d of righe) {
      letti += 1; pos += 1;
      if (!esclusi.has(d.id)) fuori.push(d);
      if (fuori.length >= quanti) break;
    }
    if (righe.length < blocco) return { documenti: fuori, prossimo: pos, finito: letti >= righe.length };
  }
  return { documenti: fuori, prossimo: pos, finito: false };
}

export async function paginaCategoria(db, codice, { da = 0, quanti = 60 } = {}) {
  if (codice === CLINICO) return { documenti: [], prossimo: da, finito: true };
  const righe = await db.from('documenti').select(CAMPI_DOC).eq('fascicolo', codice)
    .order('creato_il', { ascending: false }).order('id', { ascending: true }).range(da, da + quanti - 1).then(esito);
  return { documenti: righe, prossimo: da + righe.length, finito: righe.length < quanti };
}

// Esegue le chiamate di un'operazione con le funzioni date (quelle di cartelleMie.js e archivio.js).
export async function eseguiOperazione(db, op, api) {
  for (const c of chiamate(op)) {
    if (c.fn === 'spostaCartelle') await api.spostaCartelle(db, c.ids, c.padre);
    else if (c.fn === 'spostaDocumenti') await api.spostaDocumenti(db, c.ids, c.da, c.a);
    else if (c.fn === 'aggiungiDocumenti') await api.aggiungiDocumenti(db, c.cartella, c.ids);
    else if (c.fn === 'aggiungiAScrivania') await api.aggiungiAScrivania(db, c.ids);
    else if (c.fn === 'togliDocumenti') await api.togliDocumenti(db, c.cartella, c.ids);
    else if (c.fn === 'togliDaScrivania') await api.togliDaScrivania(db, c.ids);
    else if (c.fn === 'archivia') await api.archiviaCartelle(db, c.ids, true);
    else if (c.fn === 'ripristina') await api.archiviaCartelle(db, c.ids, false);
    else if (c.fn === 'rinominaCartella') await api.rinominaCartella(db, c.id, c.nome);
    else if (c.fn === 'rinominaDocumento') await api.aggiornaDocumento(db, c.id, { titolo: c.nome });
  }
}

/* ---------- fase 2: Drive allineato subito ---------- */

export const DA_SPOSTARE = '>';

// Cosa fare su Drive dopo un'operazione riuscita nel database (puro).
// sposta_documenti: file nella gemella della cartella d'arrivo ('radice' = Archivio personale);
// automatico: documenti tornati fuori dalle cartelle → di nuovo nelle cartelle Categoria/anno (ordinaDrive_);
// cartella_drive: gemella creata o allineata (nuova, rinominata, spostata). Archiviare non tocca Drive.
export function chiamateDrive(op) {
  if (!op) return [];
  if (op.tipo === 'crea') return [{ azione: 'cartella_drive', id: op.id }];
  if (op.tipo === 'rinomina') return op.cosa === 'cartella' ? [{ azione: 'cartella_drive', id: op.id }] : [];
  if (op.tipo !== 'sposta') return [];
  const fuori = [];
  const perDest = new Map();
  const tornati = [];
  for (const m of op.mosse) {
    if (m.tipo === 'cartella') { fuori.push({ azione: 'cartella_drive', id: m.id }); continue; }
    if (m.da === m.a) continue;
    if (m.a === FUORI) { tornati.push(m.id); continue; }
    if (!perDest.has(m.a)) perDest.set(m.a, []);
    perDest.get(m.a).push(m.id);
  }
  for (const [a, ids] of perDest) fuori.push({ azione: 'sposta_documenti', ids, cartella_id: a });
  if (tornati.length) fuori.push({ azione: 'automatico', ids: tornati });
  return fuori;
}

async function chiamaScript(corpo, fetchImpl) {
  const r = await fetchImpl(URL_CARICAMENTO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo) });
  let j;
  try { j = await r.json(); } catch { throw new Error('Google Drive non raggiungibile'); }
  if (!j.ok) throw new Error(j.errore || 'Drive non aggiornato');
  return j;
}

/**
 * Esegue su Drive le chiamate di un'operazione. Non lancia mai: restituisce quante cose restano
 * da sistemare (lo script le recupera al giro successivo grazie alla nota '>cartella:<id>').
 */
export async function allineaDrive(db, op, { token, fetchImpl = fetch } = {}) {
  let problemi = 0;
  for (const c of chiamateDrive(op)) {
    try {
      if (c.azione === 'automatico') {
        // Solo i file fissati da Esplora o da una cartella: tornano a essere ordinati dallo script.
        const { error } = await db.from('documenti').update({ drive_fissa: false, drive_cartella: null }).in('id', c.ids)
          .or('drive_cartella.like.cartella:*,drive_cartella.like.>cartella:*');
        if (error) throw new Error(error.message);
        continue;
      }
      if (!token) throw new Error('Sessione scaduta');
      const r = await chiamaScript({ token, ...c }, fetchImpl);
      if (c.azione === 'sposta_documenti') problemi += (r.errori || []).length;
    } catch {
      problemi += c.ids?.length || 1;
      if (c.azione === 'sposta_documenti') {
        // Nota «da spostare»: la legge recuperaSpostamenti_() dello script.
        try { await db.from('documenti').update({ drive_fissa: true, drive_cartella: `${DA_SPOSTARE}cartella:${c.cartella_id}` }).in('id', c.ids); } catch { /* resta il giro delle cartelle */ }
      }
      // cartella_drive non riuscita: allineaCartelleDrive_() crea e allinea le gemelle a ogni giro.
    }
  }
  return { problemi };
}
