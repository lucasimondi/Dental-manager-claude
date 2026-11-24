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

/**
 * Quale icona è attiva. Start aperto vince; poi Esplora se è la pagina in cima; poi la vista.
 * Le viste che non sono nella barra (Documenti, Conti, Legal…) accendono «Personale», come prima.
 */
export function voceAttiva({ vista, pagine = [], start = false, dock = null }) {
  if (start) return start === 'cerca' ? 'cerca' : 'start';
  if (pagine.length && pagine[pagine.length - 1]?.tipo === 'esplora') return 'esplora';
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
  if (pagine.some((p) => p.tipo === 'esplora')) fuori.add('esplora');
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
  { id: 'scan', nome: 'Scan', azione: { apri: { tipo: 'scan' } } }, // PERSONAL-FINESTRE: lo Scan come finestra del desktop
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
  { id: 'studio', nome: 'Studio', azione: { href: 'studio' } },
  { id: 'impostazioni', nome: 'Impostazioni', azione: { apri: { tipo: 'impostazioni' } } },
];

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
export const DOCK_PREDEFINITO = ['oggi', 'agenda', 'esplora', 'poliedron', 'altro'];
const APP_DOCK = { oggi: VOCI_BARRA[2], agenda: VOCI_BARRA[3], esplora: VOCI_BARRA[4], poliedron: VOCI_BARRA[5], altro: VOCI_BARRA[6] };
const chiaveAggiunta = (x) => `${x.tipo}:${x.id}`;

export function normalizzaStart(v = {}) {
  const app = new Set(AGGIUNTE.map((a) => a.id));
  const aggiunte = Array.isArray(v?.aggiunte)
    ? v.aggiunte.filter((x) => x && ((x.tipo === 'app' && app.has(x.id)) || (x.tipo === 'cartella' && x.id)))
    : AGGIUNTE.map((a) => ({ tipo: 'app', id: a.id }));
  const visti = new Set();
  const uniche = aggiunte.filter((x) => { const k = chiaveAggiunta(x); if (visti.has(k)) return false; visti.add(k); return true; });
  const dock = Array.isArray(v?.dock) ? v.dock.filter((id) => app.has(id) || APP_DOCK[id]).filter((id, i, l) => l.indexOf(id) === i).slice(0, 10) : DOCK_PREDEFINITO;
  return { aggiunte: uniche, dock };
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
export const appTrovate = (testo) => {
  const q = String(testo || '').trim().toLocaleLowerCase('it');
  return q ? AGGIUNTE.filter((a) => a.nome.toLocaleLowerCase('it').includes(q)) : [];
};
// «Consigliati»: scadenze imminenti (entro `giorni`, scadute comprese) dal catalogo, poi i file recenti.
export function scadenzeImminenti(scadenze = [], oggi = new Date().toISOString().slice(0, 10), giorni = 14) {
  const limite = new Date(Date.parse(`${oggi}T12:00:00Z`) + giorni * 86400000).toISOString().slice(0, 10);
  return scadenze
    .filter((s) => s && !s.completata && !s.storica && s.data && s.data <= limite && s.documento?.fascicolo !== 'clinico_pazienti')
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((s) => ({ chiave: `s:${s.id}`, tipo: 'scadenza', id: s.id, documento_id: s.documento_id, nome: s.descrizione || s.documento?.titolo || 'Scadenza', quando: Date.parse(`${s.data}T12:00:00Z`), scaduta: s.data < oggi, importo: s.importo ?? null }));
}
