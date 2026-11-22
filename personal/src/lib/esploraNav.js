// PR #337 §2 — Esplora file, finestra stile Windows 11: schede con cronologia (Indietro / Avanti / Su),
// percorso a breadcrumb (anche scritto a mano), ricerca nella cartella e nelle sottocartelle con filtri,
// Recenti, pannello di navigazione ridimensionabile. Logica pura, testabile senza DOM.
import { RADICE, HOME, CLINICO, NOME_RADICE, cartellaDi, documentiNelNodo, eVirtuale, tipoFile } from './esplora.js';
import { discendenti } from './cartelleMie.js';

/* ---------- schede ---------- */

let progressivo = 0;
// Una scheda: { id, storia: [nodo…], i } (i = posizione nella cronologia).
export const nuovaScheda = (nodo = HOME, id = `s${Date.now().toString(36)}${(progressivo += 1)}`) => ({ id, storia: [nodo], i: 0 });
export const nodoScheda = (s) => s?.storia?.[s.i] ?? HOME;
export const puoIndietro = (s) => !!s && s.i > 0;
export const puoAvanti = (s) => !!s && s.i < s.storia.length - 1;

// Andare in un nodo tronca la cronologia «avanti», come nel browser. Stesso nodo = nessuna voce nuova.
export function vaiInScheda(s, nodo) {
  if (nodoScheda(s) === nodo) return s;
  const storia = [...s.storia.slice(0, s.i + 1), nodo].slice(-50);
  return { ...s, storia, i: storia.length - 1 };
}
// Al posto del nodo attuale (es. la cartella non esiste più): niente voce nuova.
export const sostituisciInScheda = (s, nodo) => ({ ...s, storia: s.storia.map((n, j) => (j === s.i ? nodo : n)) });
export const indietroScheda = (s) => (puoIndietro(s) ? { ...s, i: s.i - 1 } : s);
export const avantiScheda = (s) => (puoAvanti(s) ? { ...s, i: s.i + 1 } : s);

// Chiudere una scheda: l'ultima non si chiude (diventa Home); se era attiva si passa a quella accanto.
export function chiudiScheda(schede, attiva, id) {
  const i = schede.findIndex((s) => s.id === id);
  if (i < 0) return { schede, attiva };
  if (schede.length === 1) { const s = nuovaScheda(HOME); return { schede: [s], attiva: s.id }; }
  const resto = schede.filter((s) => s.id !== id);
  return { schede: resto, attiva: attiva === id ? resto[Math.min(i, resto.length - 1)].id : attiva };
}
// Trascinamento per riordinare: la scheda `id` va alla posizione `a`.
export function spostaScheda(schede, id, a) {
  const i = schede.findIndex((s) => s.id === id);
  if (i < 0) return schede;
  const resto = schede.filter((s) => s.id !== id);
  const dove = Math.max(0, Math.min(a, resto.length));
  return [...resto.slice(0, dove), schede[i], ...resto.slice(dove)];
}
// Posizione di arrivo dal punto x, dati i rettangoli delle schede [{left, width}].
export function posizioneDaX(rettangoli, x) {
  let a = 0;
  for (const r of rettangoli) if (x > r.left + r.width / 2) a += 1;
  return a;
}

/* ---------- percorso scritto a mano ---------- */

// «Personale / Casa / Utenze», «Home › Casa › Utenze», «casa\\utenze» → id della cartella (o null).
export function nodoDaTesto(testo, cartelle = []) {
  const pezzi = String(testo || '').split(/\s*[/\\›>]\s*/).map((p) => p.trim()).filter(Boolean);
  const norm = (x) => x.toLocaleLowerCase('it');
  while (pezzi.length && ['home', norm(NOME_RADICE), 'archivio personale'].includes(norm(pezzi[0]))) {
    const primo = norm(pezzi.shift());
    if (!pezzi.length) return primo === 'home' ? HOME : RADICE;
  }
  if (!pezzi.length) return null;
  let padre = null;
  let nodo = null;
  for (const p of pezzi) {
    const c = cartelle.find((x) => !x.archiviata_il && (x.padre_id || null) === padre && norm(x.nome) === norm(p));
    if (!c) return null;
    nodo = c.id; padre = c.id;
  }
  return nodo;
}
export const testoPercorso = (briciole) => briciole.map((b) => b.nome).join(' › ');

/* ---------- ricerca ---------- */

// Documenti dentro una cartella e tutte le sue sottocartelle (Home e Personale = tutto l'archivio).
export function documentiNelSottoalbero(base, { cartelle = [], posizioni = [] } = {}) {
  if (base === HOME || base === RADICE || eVirtuale(base)) return null; // nessun limite
  const ids = [base, ...discendenti(cartelle.filter((c) => !c.archiviata_il), base)];
  return new Set(ids.flatMap((id) => documentiNelNodo(posizioni, id)));
}
export function cartelleNelSottoalbero(base, cartelle = []) {
  const vive = cartelle.filter((c) => !c.archiviata_il);
  if (base === HOME || base === RADICE || eVirtuale(base)) return vive;
  const sotto = new Set(discendenti(vive, base));
  return vive.filter((c) => c.id !== base && sotto.has(c.id));
}

export const FILTRI_TIPO = [['', 'Tutti i tipi'], ['pdf', 'PDF'], ['immagine', 'Immagini'], ['office', 'Documenti Office e Google'], ['email', 'Email'], ['altro', 'Altro']];
export const FILTRI_DATA = [['', 'Qualsiasi data'], ['oggi', 'Oggi'], ['settimana', 'Ultima settimana'], ['mese', 'Ultimo mese'], ['anno', 'Ultimo anno']];
const GIORNI = { oggi: 1, settimana: 7, mese: 31, anno: 366 };

// Risultati della ricerca: solo nel sottoalbero, mai i clinici, poi i filtri tipo / data / categoria.
export function filtraRisultati(documenti = [], { dentro = null, tipo = '', data = '', categoria = '' } = {}, adesso = Date.now()) {
  return documenti.filter((d) => {
    if (!d || d.fascicolo === CLINICO) return false;
    if (dentro && !dentro.has(d.id)) return false;
    if (tipo && tipoFile(d) !== tipo) return false;
    if (categoria && d.fascicolo !== categoria) return false;
    if (data) {
      const t = Date.parse(d.data_documento || d.email_data || d.creato_il || '');
      if (!Number.isFinite(t) || adesso - t > GIORNI[data] * 86400000) return false;
    }
    return true;
  });
}
export const cartelleTrovate = (cartelle, testo) => {
  const q = String(testo || '').trim().toLocaleLowerCase('it');
  return q ? cartelle.filter((c) => String(c.nome).toLocaleLowerCase('it').includes(q)) : [];
};
// Il nome contiene le parole cercate? (altrimenti il risultato è «nel contenuto»).
export function nelNome(nome, testo) {
  const n = String(nome || '').toLocaleLowerCase('it');
  const parole = String(testo || '').toLocaleLowerCase('it').split(/\s+/).filter((p) => p.length > 1);
  return parole.length > 0 && parole.some((p) => n.includes(p));
}
// Evidenziazione: [{ t, m }] con m = true sulle parti che corrispondono a una parola cercata.
export function evidenzia(testo, cerca) {
  const s = String(testo ?? '');
  const parole = String(cerca || '').split(/\s+/).filter((p) => p.length > 1).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!parole.length || !s) return [{ t: s, m: false }];
  // split con un gruppo: le parti in posizione dispari sono le corrispondenze.
  return s.split(new RegExp(`(${parole.join('|')})`, 'i')).map((t, i) => ({ t, m: i % 2 === 1 })).filter((p) => p.t !== '');
}

/* ---------- recenti (per dispositivo, localStorage dentro try/catch) ---------- */

const CHIAVE_RECENTI = 'poliedron-esplora-recenti';
export const MAX_RECENTI = 30;
export function leggiRecenti(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(CHIAVE_RECENTI) || '[]'); return Array.isArray(v) ? v.filter((x) => x && x.id) : []; } catch { return []; }
}
export function ricordaRecente(id, storage = globalThis.localStorage, adesso = Date.now()) {
  const nuovi = [{ id, quando: adesso }, ...leggiRecenti(storage).filter((r) => r.id !== id)].slice(0, MAX_RECENTI);
  try { storage?.setItem(CHIAVE_RECENTI, JSON.stringify(nuovi)); } catch { /* facoltativo */ }
  return nuovi;
}

/* ---------- pannello di navigazione ---------- */

const CHIAVE_PANNELLO = 'poliedron-esplora-pannello';
export const larghezzaPannello = (l) => Math.round(Math.max(160, Math.min(Number(l) || 240, 420)));
export function leggiPannello(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(CHIAVE_PANNELLO) || 'null'); return { larghezza: larghezzaPannello(v?.larghezza ?? 240), chiuso: !!v?.chiuso }; } catch { return { larghezza: 240, chiuso: false }; }
}
export function salvaPannello(p, storage = globalThis.localStorage) {
  try { storage?.setItem(CHIAVE_PANNELLO, JSON.stringify(p)); } catch { /* facoltativo */ }
  return p;
}
// Swipe dal bordo sinistro per aprire il pannello su mobile: parte entro 24 px dal bordo, almeno 60 px in orizzontale.
export const swipeApre = (inizio, fine) => !!inizio && !!fine && inizio.x <= 24 && fine.x - inizio.x >= 60 && Math.abs(fine.y - inizio.y) < 50;

/* ---------- barra di stato ---------- */

export function testoSelezione(n, byte) {
  if (!n) return '';
  const dim = byte > 0 ? `, ${dimensione(byte)}` : '';
  return `${n} ${n === 1 ? 'elemento selezionato' : 'elementi selezionati'}${dim}`;
}
function dimensione(b) {
  if (b < 1024) return `${b} byte`;
  const u = ['KB', 'MB', 'GB'];
  let v = b / 1024; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toLocaleString('it-IT', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${u[i]}`;
}

// Esiste ancora? (per le schede che puntano a una cartella archiviata o eliminata)
export const nodoValido = (nodo, cartelle) => nodo === RADICE || eVirtuale(nodo) || !!cartellaDi(cartelle, nodo);

/* ---------- PR #337 §9: virtualizzazione sopra i 200 elementi ---------- */
export const SOGLIA_VIRTUALE = 200;
// Quali elementi disegnare: righe visibili (± margine) di una griglia a `colonne` colonne con righe alte
// `altezza` px che inizia a `inizio` px dentro un contenitore scorrevole. Risultato in indici di elemento,
// più lo spazio vuoto sopra e sotto (px) che tiene la barra di scorrimento giusta.
export function finestraVirtuale({ n, colonne = 1, altezza, scrollTop = 0, viewport = 800, inizio = 0, margine = 6 }) {
  const c = Math.max(1, colonne | 0);
  const h = Math.max(1, altezza || 1);
  const righe = Math.ceil(n / c);
  const prima = Math.max(0, Math.floor((scrollTop - inizio) / h) - margine);
  const ultima = Math.min(righe, Math.ceil((scrollTop - inizio + viewport) / h) + margine);
  return { da: prima * c, a: Math.min(n, Math.max(prima, ultima) * c), sopra: prima * h, sotto: Math.max(0, righe - Math.max(prima, ultima)) * h };
}

/* ---------- PR #337 §9: tastiera (frecce) ---------- */
// Indice di arrivo con le frecce: ←/→ ±1 (solo nelle griglie), ↑/↓ ± colonne, Home/Fine, PagSu/PagGiù ± 10 righe.
export function indiceConTasto(i, tasto, { n, colonne = 1 }) {
  if (!n) return -1;
  const c = Math.max(1, colonne | 0);
  const da = i < 0 ? -1 : i;
  const passi = { ArrowRight: c > 1 ? 1 : 0, ArrowLeft: c > 1 ? -1 : 0, ArrowDown: c, ArrowUp: -c, PageDown: c * 10, PageUp: -c * 10 };
  if (tasto === 'Home') return 0;
  if (tasto === 'End') return n - 1;
  if (!(tasto in passi)) return da;
  if (da < 0) return 0;
  return Math.max(0, Math.min(n - 1, da + passi[tasto]));
}
