// PERSONAL-ESPLORA-WIN11 fase 3 — barra delle applicazioni e Start stile Windows 11 (logica pura).
// Sostituisce il dock senza cambiare destinazioni né viste salvate: Oggi, Agenda, Assistente
// (Poliedron) e Personale («altro») restano le stesse viste; Documenti, Studio e le altre sezioni
// sono in Start. Esplora file è una pagina (tipo 'esplora').

// Icone centrate: Start · Cerca · Oggi · Agenda · Esplora file · Assistente · Personale.
export const VOCI_BARRA = [
  { id: 'start', nome: 'Start' },
  { id: 'cerca', nome: 'Cerca' },
  { id: 'oggi', nome: 'Oggi', vista: 'oggi' },
  { id: 'agenda', nome: 'Agenda', vista: 'agenda' },
  { id: 'esplora', nome: 'Esplora file', pagina: 'esplora' },
  { id: 'poliedron', nome: 'Assistente', vista: 'poliedron' },
  { id: 'altro', nome: 'Personale', vista: 'altro' },
];
const VISTE_BARRA = new Set(VOCI_BARRA.filter((v) => v.vista).map((v) => v.id));
// SCAN-APP (PO 2026-11-24): app che si aprono come pagine sopra la sezione (Esplora file, Scan):
// tipo di pagina → icona della barra che si accende.
const PAGINE_APP = { esplora: 'esplora', scan: 'scan', scanner: 'scan', tessera: 'scan', testo: 'scan', pdfStrumento: 'scan' };
export const appDellaPagina = (p) => (p ? PAGINE_APP[p.tipo] || null : null);

/**
 * Quale icona è attiva. Start aperto vince; poi Esplora se è la pagina in cima; poi la vista.
 * Le viste che non sono nella barra (Documenti, Conti, Legal…) accendono «Personale», come prima.
 */
export function voceAttiva({ vista, pagine = [], start = false, dock = null }) {
  if (start) return start === 'cerca' ? 'cerca' : 'start';
  const inCima = appDellaPagina(pagine[pagine.length - 1]);
  if (inCima === 'esplora' || (inCima === 'scan' && (dock || DOCK_PREDEFINITO).includes('scan'))) return inCima;
  if (VISTE_BARRA.has(vista)) return vista;
  if (dock?.includes(vista)) return vista; // PR #337 §7: un'app fissata nel dock si accende lei
  return 'altro';
}

/**
 * PR #337: app «aperte ma non in primo piano» (trattino corto da 6 px): la vista sotto una pagina aperta
 * e Esplora file quando è aperto sotto un'altra pagina.
 */
export function vociAperte({ vista, pagine = [], start = false, dock = null }) {
  const fuori = new Set();
  const attiva = voceAttiva({ vista, pagine, start, dock });
  if (pagine.length) fuori.add(VISTE_BARRA.has(vista) || dock?.includes(vista) ? vista : 'altro');
  for (const p of pagine) { const a = appDellaPagina(p); if (a) fuori.add(a); }
  fuori.delete(attiva);
  return fuori;
}
// Badge rossi sulle icone: Oggi = scadenze/promemoria urgenti, Esplora = documenti da gestire.
export const badgeBarra = (id, conteggi = {}) => (id === 'oggi' ? Number(conteggi.urgenti) || 0 : id === 'esplora' ? Number(conteggi.esplora) || 0 : 0);

// Le sezioni in «Aggiunte» (griglia di 4 colonne), ognuna col suo pallino quando c'è un conteggio.
// azione: { vai: vista } | { apri: { tipo } } | { href } ; conteggio: chiave in `conteggi`.
export const AGGIUNTE = [
  { id: 'oggi', nome: 'Oggi', azione: { vai: 'oggi' }, conteggio: 'urgenti' },
  { id: 'agenda', nome: 'Agenda', azione: { vai: 'agenda' } },
  { id: 'documenti', nome: 'Documenti', azione: { vai: 'documenti' }, conteggio: 'documenti' },
  { id: 'esplora', nome: 'Esplora', azione: { apri: { tipo: 'esplora' } }, conteggio: 'esplora' },
  { id: 'scan', nome: 'Scan', azione: { apri: { tipo: 'scan' } } }, // SCAN-APP
  { id: 'google', nome: 'Google', azione: { cartella: 'google' } }, // SCAN-GOOGLE-OFFICE: cartelle di app in Start
  { id: 'office', nome: 'Office', azione: { cartella: 'office' } },
  { id: 'dafare', nome: 'Da fare', azione: { vai: 'dafare' }, conteggio: 'dafare' },
  { id: 'conti', nome: 'Conti', azione: { vai: 'conti' } },
  { id: 'legal', nome: 'Legal', azione: { vai: 'legal' } },
  { id: 'pratiche', nome: 'Pratiche', azione: { vai: 'legal' } },
  { id: 'personali', nome: 'Portafoglio', azione: { vai: 'personali' } },
  { id: 'diario', nome: 'Diario', azione: { vai: 'diario' } },
  { id: 'note', nome: 'Note', azione: { vai: 'note' } },
  { id: 'password', nome: 'Password', azione: { vai: 'password' } },
  { id: 'foto', nome: 'Foto', azione: { vai: 'foto' } },
  { id: 'concordato', nome: 'Concordato', azione: { vai: 'concordato' } },
  { id: 'dati', nome: 'I miei dati', azione: { vai: 'dati' } }, // MIEI-DATI
  // APP-AUTO-CASA-SALUTE: si aprono come app (finestra), come Scan.
  { id: 'auto', nome: 'Auto e motori', azione: { apri: { tipo: 'auto' } } },
  { id: 'casa', nome: 'Casa', azione: { apri: { tipo: 'casa' } } },
  { id: 'salute', nome: 'Salute', azione: { apri: { tipo: 'saluteApp' } } },
  { id: 'rubrica', nome: 'Rubrica', azione: { apri: { tipo: 'rubrica' } } }, // RUBRICA
  { id: 'studio', nome: 'Studio', azione: { href: 'studio' } },
  { id: 'impostazioni', nome: 'Impostazioni', azione: { apri: { tipo: 'impostazioni' } } },
];

// SCAN-GOOGLE-OFFICE (PO 2026-11-24): cartelle di app in Start, come in Windows 11.
// Google: le app web (sul telefono Android si aprono nelle app Google installate). Office: crea un file
// Word / Excel / PowerPoint in «Personale» (Archivio personale su Drive) e lo apre in Google modalità
// Office; da Esplora «Apri con › Word, Excel, PowerPoint del telefono» lo passa alle app Microsoft.
export const CARTELLE_START = {
  google: { nome: 'Google', voci: [
    { id: 'g-documenti', nome: 'Documenti', icona: 'documenti', href: 'https://docs.google.com/document/u/0/' },
    { id: 'g-fogli', nome: 'Fogli', icona: 'fogli', href: 'https://docs.google.com/spreadsheets/u/0/' },
    { id: 'g-presentazioni', nome: 'Presentazioni', icona: 'presentazioni', href: 'https://docs.google.com/presentation/u/0/' },
    { id: 'g-moduli', nome: 'Moduli', icona: 'moduli', href: 'https://docs.google.com/forms/u/0/' },
    { id: 'g-drive', nome: 'Drive', icona: 'drive', href: 'https://drive.google.com/drive/u/0/my-drive' },
    { id: 'g-gmail', nome: 'Gmail', icona: 'gmail', href: 'https://mail.google.com/mail/u/0/' },
    { id: 'g-calendar', nome: 'Calendar', icona: 'calendar', href: 'https://calendar.google.com/calendar/u/0/r' },
    { id: 'g-nuovo-doc', nome: 'Nuovo documento', icona: 'documenti', crea: 'doc' },
    { id: 'g-nuovo-foglio', nome: 'Nuovo foglio', icona: 'fogli', crea: 'foglio' },
    { id: 'g-nuova-pres', nome: 'Nuova presentazione', icona: 'presentazioni', crea: 'presentazione' },
    { id: 'g-nuovo-modulo', nome: 'Nuovo modulo', icona: 'moduli', crea: 'modulo' },
  ] },
  office: { nome: 'Office', voci: [
    { id: 'o-word', nome: 'Nuovo Word', icona: 'word', crea: 'word' },
    { id: 'o-excel', nome: 'Nuovo Excel', icona: 'excel', crea: 'excel' },
    { id: 'o-powerpoint', nome: 'Nuovo PowerPoint', icona: 'powerpoint', crea: 'powerpoint' },
    { id: 'o-esplora', nome: 'File Office', icona: 'esplora', apri: { tipo: 'esplora' } },
  ] },
};
export const cartellaStart = (id) => CARTELLE_START[id] || null;

export const vociStart = (conteggi = {}) => AGGIUNTE.map((v) => ({ ...v, n: v.conteggio ? Number(conteggi[v.conteggio]) || 0 : 0 }));

// Il numero accanto all'ora: i promemoria «Da fare» aperti (gli stessi delle notifiche sul telefono).
// PR #337 §8: il numero della campanella = le notifiche del Centro notifiche (prima: i Da fare aperti).
export const numeroNotifiche = (conteggi = {}) => Number(conteggi.notifiche ?? conteggi.dafare) || 0;

// Ora e data come nella barra di Windows: «14:05» e «21/11/2026», fuso di Roma.
export function oraData(d = new Date(), fuso = 'Europe/Rome') {
  const ora = new Intl.DateTimeFormat('it-IT', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  const data = new Intl.DateTimeFormat('it-IT', { timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  return { ora, data, breve: data.slice(0, 5) }; // breve «21/11» per i telefoni stretti
}

// «luca.simondi@…» → «Luca».
export function nomeUtente(email = '') {
  const p = String(email).split('@')[0].split(/[._-]/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'Account';
}

// «Consigliati»: prima i file recenti del telefono, poi (se servono) gli ultimi documenti dell'archivio.
export function consigliati(recenti = [], documenti = [], max = 6) {
  const fuori = recenti.slice(0, max).map((r) => ({ chiave: `r:${r.id}`, tipo: 'recente', id: r.id, nome: r.nome, quando: r.data, mime: r.tipo }));
  for (const d of documenti) {
    if (fuori.length >= max) break;
    fuori.push({ chiave: `d:${d.id}`, tipo: 'documento', id: d.id, nome: d.titolo || d.nome_file_originale || 'Documento', quando: Date.parse(d.creato_il || d.email_data || '') || null, mime: d.mime_type });
  }
  return fuori;
}

export const etichettaNumero = (n) => (!n || n < 1 ? null : n > 99 ? '99+' : String(n));

// PR #337 (dock): trascinando un file su un'icona della barra il file si apre con quell'app.
// Solo le app che sanno cosa farne accendono l'icona durante il trascinamento.
export const APP_PER_FILE = {
  esplora: 'Apri in anteprima',
  poliedron: 'Chiedi all\u2019assistente',
  agenda: 'Crea un impegno con il file',
};
export const accettaFile = (id) => Object.prototype.hasOwnProperty.call(APP_PER_FILE, id);

/* ---------- PR #337 §7: Start personalizzabile e app nel dock ---------- */
// «Aggiunte»: app (dalle AGGIUNTE) e cartelle fissate di Esplora, nell'ordine scelto da Luca.
// Dock: dopo Start e Cerca, le app fissate (predefinite quelle di sempre). Tutto in impostazioni_app
// (chiave `start_personal`), uguale su ogni dispositivo.
// SCAN-APP (PO 2026-11-24): Scan nel dock dopo Esplora file.
export const DOCK_PREDEFINITO = ['oggi', 'agenda', 'esplora', 'scan', 'poliedron', 'altro'];
const APP_DOCK = { oggi: VOCI_BARRA[2], agenda: VOCI_BARRA[3], esplora: VOCI_BARRA[4], poliedron: VOCI_BARRA[5], altro: VOCI_BARRA[6] };
// Versione delle impostazioni di Start: chi le aveva salvate prima di Scan (versione assente) trova
// Scan aggiunto una volta (nel dock dopo Esplora e in Start); poi se lo toglie resta tolto.
export const VERSIONE_START = 2;
const conScan = (lista, dopo, voce, id = 'scan') => {
  if (lista.some((x) => (x?.id ?? x) === id)) return lista;
  const i = lista.findIndex((x) => (x?.id ?? x) === dopo);
  const n = [...lista];
  n.splice(i < 0 ? n.length : i + 1, 0, voce);
  return n;
};
const chiaveAggiunta = (x) => `${x.tipo}:${x.id}`;

export function normalizzaStart(v = {}) {
  const app = new Set(AGGIUNTE.map((a) => a.id));
  const aggiunte = Array.isArray(v?.aggiunte)
    ? v.aggiunte.filter((x) => x && ((x.tipo === 'app' && app.has(x.id)) || (x.tipo === 'cartella' && x.id)))
    : AGGIUNTE.map((a) => ({ tipo: 'app', id: a.id }));
  const visti = new Set();
  const uniche = aggiunte.filter((x) => { const k = chiaveAggiunta(x); if (visti.has(k)) return false; visti.add(k); return true; });
  let dock = Array.isArray(v?.dock) ? v.dock.filter((id) => app.has(id) || APP_DOCK[id]).filter((id, i, l) => l.indexOf(id) === i).slice(0, 10) : DOCK_PREDEFINITO;
  let finali = uniche;
  if (!(Number(v?.versione) >= VERSIONE_START)) {
    if (Array.isArray(v?.dock)) dock = conScan(dock, 'esplora', 'scan').slice(0, 10);
    if (Array.isArray(v?.aggiunte)) {
      finali = conScan(uniche, 'esplora', { tipo: 'app', id: 'scan' });
      finali = conScan(finali, 'scan', { tipo: 'app', id: 'google' }, 'google');
      finali = conScan(finali, 'google', { tipo: 'app', id: 'office' }, 'office');
    }
  }
  return { aggiunte: finali, dock, versione: VERSIONE_START };
}
export function spostaAggiunta(lista, da, a) {
  if (da === a || da < 0 || da >= lista.length) return lista;
  const n = [...lista];
  const [x] = n.splice(da, 1);
  n.splice(Math.max(0, Math.min(a, n.length)), 0, x);
  return n;
}
export const togliAggiunta = (lista, x) => lista.filter((y) => chiaveAggiunta(y) !== chiaveAggiunta(x));
export const aggiungiAggiunta = (lista, x) => (lista.some((y) => chiaveAggiunta(y) === chiaveAggiunta(x)) ? lista : [...lista, x]);
export const nelDock = (dock, id) => dock.includes(id);
export const cambiaDock = (dock, id) => (dock.includes(id) ? dock.filter((x) => x !== id) : [...dock, id]);

// Le icone della barra: Start, Cerca, poi le app fissate nel dock (anche quelle prese da Start).
export function vociBarra(dock = DOCK_PREDEFINITO) {
  return [VOCI_BARRA[0], VOCI_BARRA[1], ...dock.map((id) => APP_DOCK[id] || (() => { const a = AGGIUNTE.find((x) => x.id === id); return a ? { id: a.id, nome: a.nome, azione: a.azione } : null; })()).filter(Boolean)];
}

// Ricerca mentre si scrive in Start: prima le app con quel nome, poi i documenti (dal catalogo).
// SCAN-GOOGLE-OFFICE: anche le app dentro le cartelle (Fogli, Gmail, Nuovo Word…).
export const appTrovate = (testo) => {
  const q = String(testo || '').trim().toLocaleLowerCase('it');
  if (!q) return [];
  const dentro = Object.values(CARTELLE_START).flatMap((c) => c.voci.map((v) => ({ ...v, cartella: c.nome })));
  return [...AGGIUNTE, ...dentro].filter((a) => a.nome.toLocaleLowerCase('it').includes(q) || (a.cartella && `${a.cartella} ${a.nome}`.toLocaleLowerCase('it').includes(q)));
};
// «Consigliati»: scadenze imminenti (entro `giorni`, scadute comprese) dal catalogo, poi i file recenti.
export function scadenzeImminenti(scadenze = [], oggi = new Date().toISOString().slice(0, 10), giorni = 14) {
  const limite = new Date(Date.parse(`${oggi}T12:00:00Z`) + giorni * 86400000).toISOString().slice(0, 10);
  return scadenze
    .filter((s) => s && !s.completata && !s.storica && s.data && s.data <= limite && s.documento?.fascicolo !== 'clinico_pazienti')
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((s) => ({ chiave: `s:${s.id}`, tipo: 'scadenza', id: s.id, documento_id: s.documento_id, nome: s.descrizione || s.documento?.titolo || 'Scadenza', quando: Date.parse(`${s.data}T12:00:00Z`), scaduta: s.data < oggi, importo: s.importo ?? null }));
}
