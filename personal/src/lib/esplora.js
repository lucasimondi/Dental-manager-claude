// PERSONAL-ESPLORA-WIN11 fase 1 — Esplora file (stile Windows 11) sui dati che ci sono già.
// Albero: «Personale» (= Archivio personale/ su Drive; dentro: le cartelle in cima e i file della
// scrivania) con le cartelle mie, più due cartelle virtuali in sola lettura da cui si trascina via:
// «Da catalogare» (documenti in nessuna cartella mia) e «Per categoria» (un nodo per fascicolo).
// In Esplora un documento ha UNA posizione: Sposta = tolto dalla cartella di partenza (se è una
// cartella mia) e aggiunto a quella di arrivo, con la RPC atomica `sposta_documenti_mie` (POL-VITA-033).
// Fase 2: il file si sposta anche su Drive nella cartella gemella (azioni dello script
// `sposta_documenti` e `cartella_drive`). PR #337 (PO 2026-11-21): ogni azione passa prima da Drive e
// l'interfaccia cambia solo a successo; in caso di errore avviso con «Riprova».
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
// PR #337 §2: nodi del pannello di navigazione (Home, Preferiti, Recenti, Cestino) e risultati di ricerca.
export const HOME = 'home';
export const PREFERITI = 'preferiti';
export const RECENTI = 'recenti';
export const CESTINO = 'cestino';
const SEP_CERCA = '\u0001';
export const nodoCerca = (base, testo) => `cerca:${base}${SEP_CERCA}${testo}`;
export const datiCerca = (nodo) => {
  if (!String(nodo).startsWith('cerca:')) return null;
  const [base, ...t] = String(nodo).slice(6).split(SEP_CERCA);
  return { base: base || HOME, testo: t.join(SEP_CERCA) };
};
const SPECIALI = new Set([DA_CATALOGARE, CATEGORIE, 'accesso-rapido', HOME, PREFERITI, RECENTI, CESTINO]);
export const eVirtuale = (nodo) => SPECIALI.has(nodo) || !!codiceCategoria(nodo) || !!datiCerca(nodo);
export const NOME_RADICE = 'Personale';
const NOMI_SPECIALI = { [HOME]: 'Home', [PREFERITI]: 'Preferiti', [RECENTI]: 'Recenti', [CESTINO]: 'Cestino' };

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
  if (nodo === HOME) return null;
  if (nodo === RADICE || SPECIALI.has(nodo)) return HOME;
  const cerca = datiCerca(nodo);
  if (cerca) return cerca.base;
  if (codiceCategoria(nodo)) return CATEGORIE;
  const c = cartellaDi(cartelle, nodo);
  return c ? (c.padre_id || RADICE) : null;
}

const nomeCategoria = (fascicoli, codice) => fascicoli.find((f) => f.codice === codice)?.nome || codice;

export function nomeNodo(nodo, { cartelle = [], fascicoli = [] } = {}) {
  if (nodo === RADICE) return NOME_RADICE;
  if (nodo === DA_CATALOGARE) return 'Da catalogare';
  if (nodo === CATEGORIE) return 'Per categoria';
  if (nodo === 'accesso-rapido') return 'Accesso rapido';
  if (NOMI_SPECIALI[nodo]) return NOMI_SPECIALI[nodo];
  const cerca = datiCerca(nodo);
  if (cerca) return `Risultati per «${cerca.testo}»`;
  const f = codiceCategoria(nodo);
  if (f) return nomeCategoria(fascicoli, f);
  return cartellaDi(cartelle, nodo)?.nome || 'Cartella';
}

// Dalla cima al nodo: [{id, nome}], per il percorso cliccabile.
export function percorsoNodo(nodo, { cartelle = [], fascicoli = [] } = {}) {
  if (nodo === RADICE) return [{ id: RADICE, nome: NOME_RADICE }];
  if (nodo === DA_CATALOGARE || nodo === CATEGORIE || nodo === 'accesso-rapido' || NOMI_SPECIALI[nodo]) return [{ id: nodo, nome: nomeNodo(nodo) }];
  const cerca = datiCerca(nodo);
  if (cerca) return [...(cerca.base === HOME ? [] : percorsoNodo(cerca.base, { cartelle, fascicoli })), { id: nodo, nome: nomeNodo(nodo) }];
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
  if (op.tipo === 'aggiungi') return { tipo: 'togli', ids: op.ids, da: op.a };
  if (op.tipo === 'togli') return { tipo: 'aggiungi', ids: op.ids, a: op.da };
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
  } else if (op.tipo === 'aggiungi') {
    for (const id of op.ids) if (!posizioni.some((p) => p.doc === id && p.nodo === op.a)) posizioni = [...posizioni, { doc: id, nodo: op.a }];
  } else if (op.tipo === 'togli') {
    posizioni = posizioni.filter((p) => !(op.ids.includes(p.doc) && p.nodo === op.da));
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
  if (op.tipo === 'aggiungi') return op.ids.length ? [op.a === RADICE ? { fn: 'aggiungiAScrivania', ids: op.ids } : { fn: 'aggiungiDocumenti', cartella: op.a, ids: op.ids }] : [];
  if (op.tipo === 'togli') return op.ids.length ? [op.da === RADICE ? { fn: 'togliDaScrivania', ids: op.ids } : { fn: 'togliDocumenti', cartella: op.da, ids: op.ids }] : [];
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

export const taglia = (sorgenti, nome, modo = 'taglia') => (sorgenti?.length ? { sorgenti, modo, nome: nome || (sorgenti.length === 1 ? 'elemento' : `${sorgenti.length} elementi`) } : null);
// Copia (decisione del PO, 2026-11-21): il documento compare ANCHE nella cartella d'arrivo, nessun file nuovo su Drive.
export const copia = (sorgenti, nome) => taglia((sorgenti || []).filter((s) => s.tipo === 'doc'), nome, 'copia');
export function operazioneAggiungi(sorgenti, dest, { cartelle = [], posizioni = [] } = {}) {
  if (!dest || eVirtuale(dest) || !eCartellaVera(cartelle, dest)) return null;
  const ids = [...new Set((sorgenti || []).filter((s) => s.tipo === 'doc').map((s) => s.id))].filter((id) => !posizioni.some((p) => p.doc === id && p.nodo === dest));
  return ids.length ? { tipo: 'aggiungi', ids, a: dest } : null;
}
export const incolla = (appunti, dest, opz) => (!appunti ? null : appunti.modo === 'copia' ? operazioneAggiungi(appunti.sorgenti, dest, opz) : operazioneSposta(appunti.sorgenti, dest, opz));

/* ---------- nuova cartella e menu ---------- */

export function nomeNuovaCartella(esistenti, base = 'Nuova cartella') {
  const usati = new Set(esistenti.map((n) => String(n).toLowerCase()));
  if (!usati.has(base.toLowerCase())) return base;
  let i = 2;
  while (usati.has(`${base} (${i})`.toLowerCase())) i += 1;
  return `${base} (${i})`;
}

// Menu contestuale stile Windows 11 (PR #337). Restituisce { rapide: [...], voci: [...] }:
// rapide = la riga di icone in alto (Taglia, Copia, Rinomina, Condividi, Elimina);
// voci = { id, nome, tasto?, attiva, sotto?: [...] } oppure { separatore: true }.
// `selezione` = elementi su cui agisce (uno o più); le voci non applicabili restano visibili, disattivate.
export function menuContestuale(cosa, { nodo, appunti = null, opz = {}, selezione = [], preferiti = [], ambiente = 'scarica', convertibile = false, conFile = true, vista = 'grandi', ordine = { chiave: 'nome', verso: 'su' }, gruppo = '', altrove = false, zip = false, cestino = false } = {}) {
  const sep = { separatore: true };
  const segno = (si, nome) => `${si ? '✓ ' : ''}${nome}`;
  if (cosa === 'vuoto') {
    const vero = !eVirtuale(nodo);
    return { rapide: [], voci: [
      { id: 'vista', nome: 'Visualizza', attiva: true, sotto: VISTE_ESPLORA.map(([k, n]) => ({ id: `vista:${k}`, nome: segno(vista === k, n), attiva: true })) },
      { id: 'ordina', nome: 'Ordina per', attiva: true, sotto: [['nome', 'Nome'], ['data', 'Data modifica'], ['tipo', 'Tipo'], ['dimensione', 'Dimensione'], ['categoria', 'Categoria']].map(([k, n]) => ({ id: `ordina:${k}`, nome: segno(ordine.chiave === k, n), attiva: true }))
        .concat([sep, { id: 'verso:su', nome: segno(ordine.verso === 'su', 'Crescente'), attiva: true }, { id: 'verso:giu', nome: segno(ordine.verso === 'giu', 'Decrescente'), attiva: true }]) },
      { id: 'raggruppa', nome: 'Raggruppa per', attiva: true, sotto: GRUPPI.map(([k, n]) => ({ id: `gruppo:${k || 'nessuno'}`, nome: segno(gruppo === k, n), attiva: true })) },
      sep,
      { id: 'nuovo', nome: 'Nuovo', attiva: vero, sotto: [
        { id: 'nuova', nome: 'Cartella', tasto: 'Ctrl+Maiusc+N', attiva: vero },
        { id: 'nuovo:doc', nome: 'Documento Google', attiva: vero },
        { id: 'nuovo:foglio', nome: 'Foglio Google', attiva: vero },
        sep,
        { id: 'carica', nome: 'Carica file…', attiva: vero },
      ] },
      { id: 'incolla', nome: appunti ? `Incolla «${appunti.nome}»` : 'Incolla', tasto: 'Ctrl+V', attiva: vero && !!incolla(appunti, nodo, opz) },
      { id: 'aggiorna', nome: 'Aggiorna', tasto: 'F5', attiva: true },
      { id: 'seleziona-tutto', nome: 'Seleziona tutto', tasto: 'Ctrl+A', attiva: true },
      sep,
      { id: 'proprieta-cartella', nome: 'Proprietà della cartella', tasto: 'Alt+Invio', attiva: vero && nodo !== RADICE },
    ] };
  }
  const piu = selezione.length > 1;
  const soloFile = selezione.every((x) => x.tipo === 'doc');
  const mie = selezione.every((x) => x.tipo === 'doc' || (x.id !== RADICE && !eVirtuale(x.id)));
  const una = selezione[0] || {};
  const file = una.tipo === 'doc';
  const clinico = selezione.some((x) => x.clinico);
  const nodoMenu = una.id;
  if (cestino) {
    return { rapide: [], voci: [
      { id: 'ripristina', nome: 'Ripristina', attiva: true },
      sep,
      { id: 'elimina-definitivo', nome: 'Elimina definitivamente', tasto: 'Maiusc+Canc', attiva: soloFile && !clinico },
    ] };
  }
  const rapide = [
    { id: 'taglia', nome: 'Taglia', attiva: mie },
    { id: 'copia', nome: 'Copia', attiva: soloFile },
    { id: 'rinomina', nome: 'Rinomina', attiva: !piu && mie },
    { id: 'condividi-sistema', nome: 'Condividi', attiva: !piu && file && conFile },
    { id: 'elimina', nome: 'Elimina', attiva: mie && !clinico },
  ];
  if (!file) {
    const cartellaMia = !piu && nodoMenu !== RADICE && !eVirtuale(nodoMenu);
    return { rapide, voci: [
      { id: 'apri', nome: 'Apri', tasto: 'Invio', attiva: !piu },
      { id: 'scheda-nuova', nome: 'Apri in una nuova scheda', attiva: !piu },
      { id: 'nuova', nome: 'Nuova cartella qui', attiva: !piu && !eVirtuale(nodoMenu) },
      sep,
      { id: 'preferito', nome: ePreferito(preferiti, 'cartella', nodoMenu) ? 'Togli da Accesso rapido' : 'Aggiungi ad Accesso rapido', attiva: !piu && (nodoMenu === RADICE || !eVirtuale(nodoMenu)) },
      sep,
      { id: 'taglia', nome: 'Taglia', tasto: 'Ctrl+X', attiva: mie },
      { id: 'incolla-qui', nome: appunti ? 'Incolla in questa cartella' : 'Incolla', tasto: 'Ctrl+V', attiva: !piu && !!incolla(appunti, nodoMenu, opz) },
      { id: 'copia-percorso', nome: 'Copia percorso', attiva: !piu },
      sep,
      { id: 'rinomina', nome: 'Rinomina', tasto: 'F2', attiva: cartellaMia },
      { id: 'sposta', nome: 'Sposta in…', attiva: mie },
      sep,
      { id: 'zip', nome: 'Comprimi in ZIP', attiva: mie },
      { id: 'mostra-cartella', nome: 'Mostra nella cartella', attiva: altrove && !piu },
      { id: 'proprieta', nome: 'Proprietà', tasto: 'Alt+Invio', attiva: cartellaMia },
      sep,
      { id: 'elimina', nome: 'Elimina (archivia)', tasto: 'Canc', attiva: mie },
    ] };
  }
  return { rapide, voci: [
    { id: 'apri', nome: 'Apri', tasto: 'Invio', attiva: !piu },
    { id: 'apri-con', nome: 'Apri con', attiva: !piu && conFile, sotto: [
      { id: 'con:anteprima', nome: 'Anteprima Poliedra', attiva: true },
      { id: 'con:drive', nome: 'Visualizzatore Google Drive', attiva: true },
      { id: 'con:docs', nome: 'Google Documenti / Fogli', attiva: convertibile },
      { id: 'con:scheda', nome: 'Nuova scheda del browser', attiva: true },
      { id: 'con:scarica', nome: 'Scarica', attiva: true },
      { id: 'con:altra', nome: ambiente === 'capacitor' ? 'Altra app…' : 'Altra app… (condividi)', attiva: ambiente !== 'scarica' },
      sep,
      { id: 'con:predefinita', nome: 'Scegli app predefinita…', attiva: true },
    ] },
    { id: 'condividi', nome: 'Condividi', attiva: !piu, sotto: [
      { id: 'cond:sistema', nome: 'Condivisione di sistema', attiva: conFile },
      { id: 'cond:link', nome: 'Copia link Drive', attiva: true },
      { id: 'cond:email', nome: 'Email', attiva: true },
      { id: 'cond:whatsapp', nome: 'WhatsApp', attiva: true },
      { id: 'cond:accesso', nome: 'Gestisci accesso Drive', attiva: conFile },
    ] },
    { id: 'preferito', nome: ePreferito(preferiti, 'doc', una.id) ? 'Togli dai Preferiti' : 'Aggiungi ai Preferiti', attiva: !piu },
    sep,
    { id: 'taglia', nome: 'Taglia', tasto: 'Ctrl+X', attiva: true },
    { id: 'copia', nome: 'Copia', tasto: 'Ctrl+C', attiva: true },
    { id: 'duplica', nome: 'Duplica', tasto: 'Ctrl+D', attiva: true },
    { id: 'copia-percorso', nome: 'Copia percorso', attiva: !piu },
    sep,
    { id: 'rinomina', nome: 'Rinomina', tasto: 'F2', attiva: !piu },
    { id: 'sposta', nome: 'Sposta in…', attiva: true },
    { id: 'copia-in', nome: 'Copia in…', attiva: true },
    sep,
    { id: 'zip', nome: 'Comprimi in ZIP', attiva: true },
    { id: 'estrai', nome: 'Estrai tutto', attiva: !piu && zip && conFile },
    { id: 'scarica', nome: 'Scarica', attiva: !piu && conFile },
    { id: 'mostra-cartella', nome: 'Mostra nella cartella', attiva: altrove && !piu },
    { id: 'proprieta', nome: 'Proprietà', tasto: 'Alt+Invio', attiva: !piu },
    sep,
    { id: 'elimina', nome: 'Elimina', tasto: 'Canc', attiva: !clinico },
  ] };
}

// Compatibilità: le voci di fase 1 (solo nomi e stato), derivate dal menu nuovo.
export function vociMenu(cosa, { nodo, appunti = null, opz = {}, clinico = false } = {}) {
  const sel = cosa === 'vuoto' ? [] : [{ tipo: cosa === 'file' ? 'doc' : 'cartella', id: nodo, clinico }];
  return menuContestuale(cosa, { nodo, appunti, opz, selezione: sel }).voci.filter((v) => !v.separatore);
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
    const righe = await db.from('documenti').select(CAMPI_ESPLORA).neq('fascicolo', CLINICO)
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
  const righe = await db.from('documenti').select(CAMPI_ESPLORA).eq('fascicolo', codice)
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


/* ---------- PR #337 §5: azioni nuove dello script (pubblicazione con clasp a cura di Luca) ---------- */
// Lo script di prima risponde «File mancante» alle azioni che non conosce: messaggio chiaro.
async function chiamaScriptNuovo(corpo, fetchImpl) {
  try { return await chiamaScript(corpo, fetchImpl); } catch (e) {
    if (/File mancante/.test(e.message)) throw new Error('Questa azione richiede lo script di Drive aggiornato (da pubblicare)');
    throw e;
  }
}
export const creaFileDrive = ({ token, tipo, nome, cartella }, fetchImpl = fetch) => chiamaScriptNuovo({ token, azione: 'crea_file', tipo, nome, cartella: cartella && cartella !== RADICE ? cartella : null }, fetchImpl);
// Duplica = vera copia del file su Drive (decisione del PO del 2026-11-22), registrata come documento nuovo.
export const duplicaFileDrive = ({ token, id, cartella }, fetchImpl = fetch) => chiamaScriptNuovo({ token, azione: 'duplica_file', id, cartella: cartella || null }, fetchImpl);
export const ripristinaFileDrive = ({ token, ids }, fetchImpl = fetch) => chiamaScriptNuovo({ token, azione: 'ripristina_file', ids }, fetchImpl);
export const ripristinaVersioneDrive = ({ token, id, versione }, fetchImpl = fetch) => chiamaScriptNuovo({ token, azione: 'ripristina_versione', id, versione }, fetchImpl);

// Cestino dell'app (recuperabile): il documento resta in archivio con l'etichetta «cestino» e il file va nel
// Cestino di Drive. «Ripristina» fa il contrario. «Elimina definitivamente» = il flusso di sempre (righe tolte
// dall'archivio, file nel Cestino di Drive per 30 giorni): mai cancellazioni definitive su Drive.
export const TAG_CESTINO = 'cestino';
export const nelCestino = (d) => Array.isArray(d?.tag) && d.tag.includes(TAG_CESTINO);
export const conCestino = (tag = [], dentro = true) => (dentro ? [...new Set([...(tag || []), TAG_CESTINO])] : (tag || []).filter((t) => t !== TAG_CESTINO));
export async function segnaCestino(db, docs, dentro = true) {
  for (const d of docs) {
    const { error } = await db.from('documenti').update({ tag: conCestino(d.tag, dentro) }).eq('id', d.id);
    if (error) throw new Error(error.message);
  }
}
export async function documentiNelCestino(db) {
  return esito(await db.from('documenti').select(CAMPI_ESPLORA).contains('tag', [TAG_CESTINO]).neq('fascicolo', CLINICO).order('creato_il', { ascending: false }).limit(500));
}
// «Estrai tutto»: solo gli archivi ZIP.
export const eZip = (d = {}) => /zip/.test(String(d.mime_type || '').toLowerCase()) || /\.zip$/i.test(String(d.nome_file_originale || ''));

/* ---------- PR #337: Drive prima, interfaccia solo a successo ---------- */

/**
 * Esegue un'operazione passando prima da Drive. Restituisce l'operazione davvero riuscita (da applicare
 * all'interfaccia), gli elementi non riusciti e l'errore. Non lancia mai.
 * - documenti spostati: prima `sposta_documenti` (il file su Drive), poi il database solo per quelli riusciti;
 * - documenti tornati fuori dalle cartelle (Annulla): database, poi di nuovo all'ordine automatico per Categoria/anno;
 * - cartelle spostate, rinominate, create: database, poi `cartella_drive`; se Drive non riesce si torna indietro;
 * - documento rinominato: prima `rinomina_file`, poi il titolo;
 * - archivia / ripristina / aggiungi (copia) / togli: solo database (Drive non cambia).
 */
export async function eseguiCompleto(db, op, { token, fetchImpl = fetch, api, creaCartella } = {}) {
  const script = (corpo) => chiamaScript({ token, ...corpo }, fetchImpl);
  const non = [];
  try {
    if (!op) return { ok: false, errore: 'Niente da fare', nonRiusciti: [] };
    if (op.tipo === 'crea') {
      const c = await creaCartella(db, { nome: op.nome, padre_id: op.padre === RADICE ? null : op.padre });
      const fatta = { ...op, id: c.id, nome: c.nome };
      try { await script({ azione: 'cartella_drive', id: c.id }); } catch (e) {
        await api.archiviaCartelle(db, [c.id], true).catch(() => {});
        return { ok: false, errore: `Cartella non creata su Drive: ${e.message}`, nonRiusciti: [c.id] };
      }
      return { ok: true, op: fatta, nonRiusciti: [] };
    }
    if (op.tipo === 'rinomina' && op.cosa === 'doc') {
      if (!token) throw new Error('Sessione scaduta');
      await script({ azione: 'rinomina_file', id: op.id, nome: op.a });
      await eseguiOperazione(db, op, api);
      return { ok: true, op, nonRiusciti: [] };
    }
    if (op.tipo === 'rinomina' && op.cosa === 'cartella') {
      await eseguiOperazione(db, op, api);
      try { await script({ azione: 'cartella_drive', id: op.id }); } catch (e) {
        await eseguiOperazione(db, inversa(op), api).catch(() => {});
        throw e;
      }
      return { ok: true, op, nonRiusciti: [] };
    }
    if (op.tipo !== 'sposta') {
      await eseguiOperazione(db, op, api);
      return { ok: true, op, nonRiusciti: [] };
    }
    // sposta: cartelle e documenti
    const riuscite = [];
    for (const m of op.mosse.filter((x) => x.tipo === 'cartella')) {
      const una = { tipo: 'sposta', mosse: [m] };
      try {
        await eseguiOperazione(db, una, api);
        try { await script({ azione: 'cartella_drive', id: m.id }); } catch (e) { await eseguiOperazione(db, inversa(una), api).catch(() => {}); throw e; }
        riuscite.push(m);
      } catch { non.push(m.id); }
    }
    const docs = op.mosse.filter((x) => x.tipo === 'doc' && x.da !== x.a);
    const perDest = new Map();
    for (const m of docs.filter((x) => x.a !== FUORI)) { if (!perDest.has(m.a)) perDest.set(m.a, []); perDest.get(m.a).push(m); }
    const okDrive = [];
    for (const [a, mosse] of perDest) {
      try {
        if (!token) throw new Error('Sessione scaduta');
        const r = await script({ azione: 'sposta_documenti', ids: mosse.map((m) => m.id), cartella_id: a });
        const male = new Set([...(r.errori || []).map((e) => e.id), ...(r.non_trovati || [])]);
        for (const m of mosse) (male.has(m.id) ? non : okDrive).push(male.has(m.id) ? m.id : m);
      } catch { non.push(...mosse.map((m) => m.id)); }
    }
    const tornati = docs.filter((x) => x.a === FUORI);
    const daFare = { tipo: 'sposta', mosse: [...okDrive, ...tornati] };
    if (daFare.mosse.length) {
      try {
        await eseguiOperazione(db, daFare, api);
      } catch (e) {
        // Il database ha rifiutato: i file tornano dov'erano su Drive.
        for (const [da, ms] of groupBy(okDrive.filter((m) => m.da !== FUORI), (m) => m.da)) await script({ azione: 'sposta_documenti', ids: ms.map((m) => m.id), cartella_id: da }).catch(() => {});
        const fuori = okDrive.filter((m) => m.da === FUORI).map((m) => m.id);
        if (fuori.length) await db.from('documenti').update({ drive_fissa: false, drive_cartella: null }).in('id', fuori).then(() => {}, () => {});
        return { ok: false, op: riuscite.length ? { tipo: 'sposta', mosse: riuscite } : null, errore: e.message, nonRiusciti: [...non, ...daFare.mosse.map((m) => m.id)] };
      }
      if (tornati.length) {
        await db.from('documenti').update({ drive_fissa: false, drive_cartella: null }).in('id', tornati.map((m) => m.id))
          .or('drive_cartella.like.cartella:*,drive_cartella.like.>cartella:*').then(() => {}, () => {});
      }
    }
    const fatte = [...riuscite, ...daFare.mosse];
    return { ok: !non.length, op: fatte.length ? { tipo: 'sposta', mosse: fatte } : null, nonRiusciti: non, errore: non.length ? `${non.length} ${non.length === 1 ? 'elemento non spostato' : 'elementi non spostati'} su Drive` : null };
  } catch (e) {
    return { ok: false, op: null, errore: e.message || String(e), nonRiusciti: non };
  }
}
function groupBy(lista, chiave) { const m = new Map(); for (const x of lista) { const k = chiave(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }

// Le altre azioni del menu che leggono Drive (Proprietà, Gestisci accesso).
export const proprietaDrive = ({ token, id, cartella = false }, fetchImpl = fetch) => chiamaScript({ token, azione: 'proprieta_file', id, cartella }, fetchImpl);
export const accessoDrive = ({ token, ...corpo }, fetchImpl = fetch) => chiamaScript({ token, azione: 'accesso_file', ...corpo }, fetchImpl);

/* ---------- viste: Icone grandi, Icone medie, Elenco, Dettagli (salvate per cartella) ---------- */
// PR #337 §3: le sei viste di Windows 11. L'ordine è anche quello di Ctrl+rotella (dalla più grande).
export const VISTE_ESPLORA = [['grandi', 'Icone grandi'], ['medie', 'Icone medie'], ['piccole', 'Icone piccole'], ['elenco', 'Elenco'], ['dettagli', 'Dettagli'], ['riquadri', 'Riquadri']];
// Ctrl+rotella: verso < 0 (rotella su) = più grande, > 0 = più piccola; ai bordi si resta fermi.
export function vistaConRotella(vista, verso) {
  const ordine = VISTE_ESPLORA.map(([k]) => k);
  const i = Math.max(0, ordine.indexOf(vista));
  return ordine[Math.max(0, Math.min(ordine.length - 1, i + (verso > 0 ? 1 : -1)))];
}
const CHIAVE_VISTE = 'poliedron-esplora-viste';
export function leggiViste(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(CHIAVE_VISTE) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
export function salvaVista(nodo, vista, storage = globalThis.localStorage) {
  const tutte = { ...leggiViste(storage), [nodo]: vista };
  try { storage?.setItem(CHIAVE_VISTE, JSON.stringify(tutte)); } catch { /* memoria non disponibile: resta per questa volta */ }
  return tutte;
}
export const vistaDi = (viste, nodo, predefinita = 'grandi') => (VISTE_ESPLORA.some(([k]) => k === viste?.[nodo]) ? viste[nodo] : predefinita);

/* ---------- Dettagli: colonne e ordinamento ---------- */
const MIME_LEGGIBILI = [
  [/pdf/, 'Documento PDF'], [/^image\/jpe?g/, 'Immagine JPEG'], [/^image\/png/, 'Immagine PNG'], [/^image\//, 'Immagine'],
  [/^video\//, 'Video'], [/^audio\//, 'Audio'], [/wordprocessingml|msword/, 'Documento Word'], [/spreadsheetml|ms-excel/, 'Foglio Excel'],
  [/presentationml|ms-powerpoint/, 'Presentazione PowerPoint'], [/google-apps\.document/, 'Documento Google'], [/google-apps\.spreadsheet/, 'Foglio Google'],
  [/google-apps\.presentation/, 'Presentazione Google'], [/rfc822/, 'Email'], [/zip/, 'Archivio ZIP'], [/^text\//, 'Testo'],
];
export function tipoLeggibile(d = {}) {
  const m = String(d.mime_type || '').toLowerCase();
  for (const [re, nome] of MIME_LEGGIBILI) if (re.test(m)) return nome;
  const ext = (String(d.nome_file_originale || '').match(/\.([a-z0-9]{1,5})$/i) || [])[1];
  return ext ? `File ${ext.toUpperCase()}` : 'File';
}
export function dimensioneLeggibile(byte) {
  const n = Number(byte);
  if (!Number.isFinite(n) || n <= 0) return '';
  const unita = ['byte', 'KB', 'MB', 'GB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < unita.length - 1) { v /= 1024; i += 1; }
  return `${i === 0 ? v : v.toLocaleString('it-IT', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${unita[i]}`;
}
export function dataLeggibile(iso, fuso = 'Europe/Rome') {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('it-IT', { timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(t)).replace(',', '');
}
// Righe della vista Dettagli: cartelle prima, poi file (come in Windows), ordinate per la colonna scelta.
export function righeDettagli(cartelle = [], documenti = [], titoli = {}, fascicoli = []) {
  const categoria = (d) => fascicoli.find((f) => f.codice === d.fascicolo)?.nome || d.fascicolo || '';
  return [
    ...cartelle.map((c) => ({ id: c.id, cosa: 'cartella', nome: c.nome, data: c.modificato_il || c.creato_il || null, tipo: 'Cartella di file', dimensione: null, categoria: '', voce: c })),
    ...documenti.map((d) => ({ id: d.id, cosa: 'file', nome: titoli[d.id] ?? (d.titolo || d.nome_file_originale || 'Documento'), data: d.creato_il || null, tipo: tipoLeggibile(d), dimensione: d.dimensione_byte ?? null, categoria: categoria(d), voce: d })),
  ];
}

/* ---------- PR #337 §3: colonne, raggruppamento, impostazioni per cartella ---------- */
export const COLONNE_DETTAGLI = [['nome', 'Nome', 280], ['data', 'Data modifica', 150], ['tipo', 'Tipo', 150], ['dimensione', 'Dimensione', 96], ['categoria', 'Categoria', 150]];
export const COLONNE_PREDEFINITE = ['nome', 'data', 'tipo', 'dimensione', 'categoria'];
// Il Nome resta sempre; le altre si accendono e si spengono dal menu dell'intestazione.
export const cambiaColonna = (visibili, chiave) => (chiave === 'nome' ? visibili : visibili.includes(chiave) ? visibili.filter((k) => k !== chiave) : COLONNE_DETTAGLI.map(([k]) => k).filter((k) => k === chiave || visibili.includes(k)));

export const GRUPPI = [['', 'Nessuno'], ['nome', 'Nome'], ['data', 'Data modifica'], ['tipo', 'Tipo'], ['categoria', 'Categoria']];
const giornoRoma = (t) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(t));
// Gruppi come in Windows: Nome per intervalli di lettere, Data per periodo, Tipo e Categoria per valore.
export function gruppoDi(riga, chiave, adesso = Date.now()) {
  if (chiave === 'nome') {
    const c = String(riga.nome || '').trim().charAt(0).toLocaleUpperCase('it');
    if (/[0-9]/.test(c)) return '0 – 9';
    if (c >= 'A' && c <= 'H') return 'A – H';
    if (c >= 'I' && c <= 'P') return 'I – P';
    if (c >= 'Q' && c <= 'Z') return 'Q – Z';
    return 'Altro';
  }
  if (chiave === 'data') {
    const t = Date.parse(riga.data || '');
    if (!Number.isFinite(t)) return 'Senza data';
    const g = Math.round((Date.parse(`${giornoRoma(adesso)}T12:00:00Z`) - Date.parse(`${giornoRoma(t)}T12:00:00Z`)) / 86400000);
    if (g <= 0) return 'Oggi';
    if (g === 1) return 'Ieri';
    if (g < 7) return 'Questa settimana';
    if (g < 31) return 'Questo mese';
    if (g < 366) return 'Quest’anno';
    return 'Tempo fa';
  }
  if (chiave === 'tipo') return riga.tipo || 'File';
  if (chiave === 'categoria') return riga.cosa === 'cartella' ? 'Cartelle' : riga.categoria || 'Senza categoria';
  return '';
}
const ORDINE_DATE = ['Oggi', 'Ieri', 'Questa settimana', 'Questo mese', 'Quest’anno', 'Tempo fa', 'Senza data'];
// [{ titolo, righe }] mantenendo l'ordine delle righe dentro ogni gruppo; senza chiave un solo gruppo.
export function raggruppa(righe, chiave, adesso = Date.now()) {
  if (!chiave) return [{ titolo: '', righe }];
  const m = new Map();
  for (const r of righe) { const g = gruppoDi(r, chiave, adesso); if (!m.has(g)) m.set(g, []); m.get(g).push(r); }
  const gruppi = [...m.entries()].map(([titolo, rr]) => ({ titolo, righe: rr }));
  if (chiave === 'data') return gruppi.sort((a, b) => ORDINE_DATE.indexOf(a.titolo) - ORDINE_DATE.indexOf(b.titolo));
  return gruppi.sort((a, b) => (a.titolo === 'Cartelle' ? -1 : b.titolo === 'Cartelle' ? 1 : a.titolo.localeCompare(b.titolo, 'it')));
}

// Ordinamento e raggruppamento salvati per cartella (la vista resta in CHIAVE_VISTE, come prima).
const CHIAVE_CARTELLE = 'poliedron-esplora-cartelle';
export function leggiCartelle(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(CHIAVE_CARTELLE) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
export function salvaCartella(nodo, parte, storage = globalThis.localStorage) {
  const tutte = leggiCartelle(storage);
  tutte[nodo] = { ...(tutte[nodo] || {}), ...parte };
  try { storage?.setItem(CHIAVE_CARTELLE, JSON.stringify(tutte)); } catch { /* memoria non disponibile */ }
  return tutte;
}
export const impostazioniDi = (tutte, nodo) => ({ ordine: tutte?.[nodo]?.ordine || { chiave: 'nome', verso: 'su' }, gruppo: tutte?.[nodo]?.gruppo || '', colonne: tutte?.['*']?.colonne || COLONNE_PREDEFINITE });
// Miniature reali solo per immagini e PDF con un file su Drive (lo script non le dà mai per i pazienti).
export const conMiniatura = (d = {}) => !!d.drive_file_id && d.fascicolo !== CLINICO && ['immagine', 'pdf'].includes(tipoFile(d));
export function ordinaRighe(righe, { chiave = 'nome', verso = 'su' } = {}) {
  const k = verso === 'giu' ? -1 : 1;
  const conf = (a, b) => {
    if (chiave === 'dimensione' || chiave === 'data') {
      const va = chiave === 'data' ? Date.parse(a.data || '') || 0 : a.dimensione ?? -1;
      const vb = chiave === 'data' ? Date.parse(b.data || '') || 0 : b.dimensione ?? -1;
      return va - vb;
    }
    return String(a[chiave] ?? '').localeCompare(String(b[chiave] ?? ''), 'it', { numeric: true, sensitivity: 'base' });
  };
  return [...righe].sort((a, b) => ((a.cosa === 'cartella') !== (b.cosa === 'cartella') ? (a.cosa === 'cartella' ? -1 : 1) : (conf(a, b) * k) || a.nome.localeCompare(b.nome, 'it')));
}
export const ordinaSuColonna = (ordine, chiave) => (ordine?.chiave === chiave ? { chiave, verso: ordine.verso === 'su' ? 'giu' : 'su' } : { chiave, verso: 'su' });

/* ---------- apertura con l'app predefinita ---------- */
const OFFICE_DOCS = [[/wordprocessingml|msword/, 'document'], [/spreadsheetml|ms-excel/, 'spreadsheets'], [/presentationml|ms-powerpoint/, 'presentation']];
export const linkDrive = (d = {}) => (d.drive_file_id ? `https://drive.google.com/file/d/${encodeURIComponent(d.drive_file_id)}/view` : d.drive_url || null);
// Office in Documenti / Fogli / Presentazioni Google (modalità Office, senza fare copie); Google nativi: il loro link.
export function linkDocs(d = {}) {
  const m = String(d.mime_type || '').toLowerCase();
  if (/google-apps\.(document|spreadsheet|presentation)/.test(m)) return d.drive_url || null;
  const t = OFFICE_DOCS.find(([re]) => re.test(m))?.[1];
  return t && d.drive_file_id ? `https://docs.google.com/${t}/d/${encodeURIComponent(d.drive_file_id)}/edit` : null;
}
/** Doppio clic / tocco: anteprima per PDF, immagini, video, audio; Drive per Google/Office ed email; altrimenti scarica. */
export function comeAprire(d = {}) {
  const m = String(d.mime_type || '').toLowerCase();
  const nome = String(d.nome_file_originale || '').toLowerCase();
  if (m === 'message/rfc822' || !d.drive_file_id) return d.drive_url ? { modo: 'link', url: d.drive_url } : { modo: 'scheda' };
  if (m === 'application/pdf' || nome.endsWith('.pdf')) return { modo: 'anteprima', tipo: 'pdf' };
  if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/.test(nome)) return { modo: 'anteprima', tipo: 'immagine' };
  if (m.startsWith('video/') || /\.(mp4|webm|mov)$/.test(nome)) return { modo: 'anteprima', tipo: 'video' };
  if (m.startsWith('audio/') || /\.(mp3|m4a|wav|ogg)$/.test(nome)) return { modo: 'anteprima', tipo: 'audio' };
  if (/google-apps|wordprocessingml|msword|spreadsheetml|ms-excel|presentationml|ms-powerpoint|opendocument/.test(m) || /\.(docx?|xlsx?|pptx?|od[tsp])$/.test(nome)) return { modo: 'link', url: d.drive_url || linkDrive(d) };
  return { modo: 'scarica' };
}
// Condividi ▸ Email / WhatsApp: si aprono con il link di Drive, l'invio lo fai tu.
export const linkEmail = (titolo, link) => `mailto:?subject=${encodeURIComponent(titolo || 'Documento')}&body=${encodeURIComponent(link || '')}`;
export const linkWhatsApp = (titolo, link) => `https://wa.me/?text=${encodeURIComponent(`${titolo || 'Documento'} ${link || ''}`.trim())}`;
// «Altra app…»: app impacchettata con Capacitor (plugin FileOpener presente) → apri con nativo; PWA → foglio
// di condivisione del sistema; altrimenti si scarica.
export function ambienteApertura(g = globalThis) {
  if (g.Capacitor?.isNativePlatform?.() && g.Capacitor?.Plugins?.FileOpener) return 'capacitor';
  if (typeof g.navigator?.share === 'function') return 'condividi';
  return 'scarica';
}

/* ---------- selezione: Ctrl/Shift su desktop, caselle su mobile ---------- */
export function seleziona(scelti, id, ordine, { ctrl = false, shift = false, ancora = null, casella = false } = {}) {
  const s = new Set(scelti);
  if (shift && ancora && ordine.includes(ancora)) {
    const [a, b] = [ordine.indexOf(ancora), ordine.indexOf(id)].sort((x, y) => x - y);
    const tratto = ordine.slice(a, b + 1);
    return { scelti: new Set(ctrl ? [...s, ...tratto] : tratto), ancora };
  }
  if (ctrl || casella) { if (s.has(id)) s.delete(id); else s.add(id); return { scelti: s, ancora: id }; }
  return { scelti: new Set([id]), ancora: id };
}

/* ---------- Accesso rapido (preferiti), salvato nell'archivio come le impostazioni ---------- */
export const ACCESSO_RAPIDO = 'accesso-rapido';
const CHIAVE_PREFERITI = 'esplora_preferiti';
export const ePreferito = (preferiti, tipo, id) => preferiti.some((p) => p.tipo === tipo && p.id === id);
export const cambiaPreferito = (preferiti, tipo, id) => (ePreferito(preferiti, tipo, id) ? preferiti.filter((p) => !(p.tipo === tipo && p.id === id)) : [...preferiti, { tipo, id }]);
export async function caricaPreferiti(db) {
  const { data, error } = await db.from('impostazioni_app').select('valore').eq('chiave', CHIAVE_PREFERITI).maybeSingle();
  if (error) throw new Error(error.message);
  return Array.isArray(data?.valore) ? data.valore.filter((p) => p && (p.tipo === 'cartella' || p.tipo === 'doc') && p.id) : [];
}
export async function salvaPreferiti(db, preferiti) {
  const { error } = await db.from('impostazioni_app').upsert({ chiave: CHIAVE_PREFERITI, valore: preferiti, aggiornato_il: new Date().toISOString() }, { onConflict: 'chiave' });
  if (error) throw new Error(error.message);
  return preferiti;
}

// Campi per Esplora: quelli dell'archivio più la dimensione (colonna Dettagli).
export const CAMPI_ESPLORA = `${CAMPI_DOC}, dimensione_byte`;
export async function documentiCartellaEsplora(db, nodo) {
  const q = nodo === RADICE
    ? db.from('cartelle_mie_scrivania').select(`aggiunto_il, documenti(${CAMPI_ESPLORA})`)
    : db.from('cartelle_mie_documenti').select(`aggiunto_il, documenti(${CAMPI_ESPLORA})`).eq('cartella_id', nodo);
  return (await q.order('aggiunto_il', { ascending: false }).limit(1000).then(esito)).map((r) => r.documenti).filter(Boolean);
}
export async function documentiPerId(db, ids) {
  if (!ids.length) return [];
  return db.from('documenti').select(CAMPI_ESPLORA).in('id', ids.slice(0, 200)).then(esito);
}
