// SCAN-LIBRERIA (PO 2026-11-12: «prendi l'app e falla professionale come quelle a pagamento», «dove
// possono andare i file», grafica come WPS) — «I miei documenti» di Scan: i file creati, condivisi,
// scaricati o archiviati da Scan restano in una libreria SOLO su questo dispositivo (IndexedDB),
// con cartelle, rinomina, ricerca, miniature e selezione multipla. Niente rete, niente database:
// l'archivio di Personal resta una destinazione a parte, scelta dall'utente.

export const DB_SCAN = 'poliedron-scan';
export const CARTELLA_BASE = 'Generale';
const VERSIONE = 2;

// ---- Parti pure (testabili) ----
const due = (n) => String(n).padStart(2, '0');
// «Scansione 12-11-2026 13.42» (come le app di scansione; i due punti non vanno nei nomi file).
export function nomeAutomatico(d = new Date(), prefisso = 'Scansione') {
  return `${prefisso} ${due(d.getDate())}-${due(d.getMonth() + 1)}-${d.getFullYear()} ${due(d.getHours())}.${due(d.getMinutes())}`;
}
export function pulisciNome(nome) {
  const s = String(nome || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.slice(0, 120);
}
// Nome libero nella stessa cartella: «Referto.pdf», «Referto (2).pdf», …
export function nomeUnico(nome, esistenti) {
  const usati = new Set(esistenti.map((n) => n.toLowerCase()));
  if (!usati.has(nome.toLowerCase())) return nome;
  const m = nome.match(/^(.*?)(\.[^.]+)?$/);
  for (let i = 2; ; i += 1) { const prova = `${m[1]} (${i})${m[2] || ''}`; if (!usati.has(prova.toLowerCase())) return prova; }
}
export const estensione = (nome) => (nome.match(/\.[^.]+$/) || [''])[0];
// Rinomina conservando l'estensione del file.
export function nuovoNome(vecchio, digitato) {
  const base = pulisciNome(digitato).replace(/\.[^.]+$/, '');
  if (!base) throw new Error('Scrivi un nome.');
  return `${base}${estensione(vecchio)}`;
}
const piega = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Ricerca nel nome e nel testo riconosciuto, filtro per cartella, ordinamento.
// SCAN-ORGANIZZA: anche per categoria, tipo di file (pdf, foto, word, testo), preferiti, archiviati ed etichette.
export const tipoDi = (d) => (/pdf$/i.test(d?.tipo || '') || /\.pdf$/i.test(d?.nome || '') ? 'pdf'
  : /^image\//.test(d?.tipo || '') ? 'foto' : /wordprocessingml|msword/.test(d?.tipo || '') || /\.docx?$/i.test(d?.nome || '') ? 'word' : 'testo');
export function filtraDocumenti(elenco, { cerca = '', cartella = null, ordine = 'recenti', categoria = null, tipo = null, preferiti = false, archiviati = false } = {}) {
  const parole = piega(cerca).replace(/#/g, '').split(/\s+/).filter(Boolean);
  const out = elenco.filter((d) => (!cartella || d.cartella === cartella)
    && (!categoria || (d.categoria || 'generali') === categoria)
    && (!tipo || tipoDi(d) === tipo)
    && (!preferiti || d.preferito) && (!archiviati || d.archiviato)
    && parole.every((p) => piega(d.nome).includes(p) || piega(d.testo).includes(p) || (d.tag || []).some((t) => piega(t).includes(p))));
  const cmp = {
    recenti: (a, b) => b.modificato - a.modificato,
    vecchi: (a, b) => a.modificato - b.modificato,
    nome: (a, b) => a.nome.localeCompare(b.nome, 'it', { numeric: true, sensitivity: 'base' }),
    peso: (a, b) => b.dimensione - a.dimensione,
  }[ordine] || ((a, b) => b.modificato - a.modificato);
  return out.sort(cmp);
}
// Cartelle con conteggio: quelle create (anche vuote) più quelle usate dai documenti.
export function elencoCartelle(documenti, create = []) {
  const n = new Map([[CARTELLA_BASE, 0], ...create.map((c) => [c, 0])]);
  for (const d of documenti) n.set(d.cartella || CARTELLA_BASE, (n.get(d.cartella || CARTELLA_BASE) || 0) + 1);
  return [...n.entries()].map(([nome, quanti]) => ({ nome, quanti }))
    .sort((a, b) => (a.nome === CARTELLA_BASE ? -1 : b.nome === CARTELLA_BASE ? 1 : a.nome.localeCompare(b.nome, 'it')));
}
export function gruppoData(ms, ora = Date.now()) {
  const g = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const giorni = Math.round((g(ora) - g(ms)) / 86400000);
  return giorni <= 0 ? 'Oggi' : giorni === 1 ? 'Ieri' : giorni < 7 ? 'Entro 7 giorni' : 'Precedenti';
}
export function formatoPeso(n = 0) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
export const ePdf = (d) => /pdf$/i.test(d?.tipo || '') || /\.pdf$/i.test(d?.nome || '');

// ---- Memoria del dispositivo (IndexedDB) ----
function apri(idb = globalThis.indexedDB) {
  return new Promise((ok, ko) => {
    if (!idb) { ko(new Error('Memoria del dispositivo non disponibile.')); return; }
    const r = idb.open(DB_SCAN, VERSIONE);
    r.onupgradeneeded = () => {
      const db = r.result;
      const docs = db.objectStoreNames.contains('documenti') ? r.transaction.objectStore('documenti') : db.createObjectStore('documenti', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('cartelle')) db.createObjectStore('cartelle', { keyPath: 'nome' });
      // SCAN-HUB → SCAN-LIBRERIA: i vecchi «Recenti» diventano documenti della cartella Generale.
      if (db.objectStoreNames.contains('recenti')) {
        const vecchi = r.transaction.objectStore('recenti').getAll();
        vecchi.onsuccess = () => {
          for (const v of vecchi.result || []) docs.put({ id: v.id, nome: v.nome, tipo: v.tipo, dimensione: v.dimensione, creato: v.data, modificato: v.data, cartella: CARTELLA_BASE, origine: v.origine || 'scan', miniatura: null, testo: '', blob: v.blob });
          db.deleteObjectStore('recenti');
        };
      }
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error || new Error('Memoria del dispositivo non disponibile.'));
  });
}
function fai(store, modo, fn) {
  return apri().then((db) => new Promise((ok, ko) => {
    const tx = db.transaction(store, modo);
    const out = fn(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); ok(out?.result ?? out); };
    tx.onerror = () => { db.close(); ko(tx.error); };
    tx.onabort = () => { db.close(); ko(tx.error || new Error('Spazio sul telefono esaurito o operazione annullata.')); };
  }));
}
// Il browser non cancella la libreria per far spazio (se il telefono lo consente).
export async function proteggiMemoria(nav = globalThis.navigator) {
  try { if (nav?.storage?.persist && !(await nav.storage.persisted())) await nav.storage.persist(); } catch { /* facoltativo */ }
}
export async function spazioUsato(nav = globalThis.navigator) {
  try { const s = await nav.storage.estimate(); return { usato: s.usage || 0, totale: s.quota || 0 }; } catch { return null; }
}

export async function elencoDocumenti() {
  const tutti = await fai('documenti', 'readonly', (s) => s.getAll());
  return (tutti || []).map(({ blob, ...d }) => d).sort((a, b) => b.modificato - a.modificato);
}
export async function cartelleCreate() {
  return ((await fai('cartelle', 'readonly', (s) => s.getAll())) || []).map((c) => c.nome);
}
export async function creaCartella(nome) {
  const n = pulisciNome(nome);
  if (!n) throw new Error('Scrivi il nome della cartella.');
  await fai('cartelle', 'readwrite', (s) => { s.put({ nome: n }); });
  return n;
}
export async function fileDocumento(id) {
  const d = await fai('documenti', 'readonly', (s) => s.get(id));
  if (!d) throw new Error('File non più disponibile su questo telefono.');
  return new File([d.blob], d.nome, { type: d.tipo || d.blob.type });
}
// Salva i file nella libreria. Stesso nome e stesso peso nella stessa cartella = stesso file:
// si aggiorna la data invece di duplicarlo. extra: { cartella, origine, miniature: [dataURL], testi: [string] }.
export async function salvaDocumenti(files, { cartella = CARTELLA_BASE, origine = 'scan', miniature = [], testi = [], categorie = [], archiviato = false } = {}) {
  const elenco = [...(files || [])].filter(Boolean);
  if (!elenco.length) return [];
  const esistenti = await elencoDocumenti();
  const ora = Date.now();
  const ids = [];
  await fai('documenti', 'readwrite', (s) => {
    elenco.forEach((f, i) => {
      const uguale = esistenti.find((d) => d.cartella === cartella && d.nome === f.name && d.dimensione === f.size);
      const id = uguale?.id || `${ora}-${i}-${Math.random().toString(36).slice(2, 8)}`;
      ids.push(id);
      s.put({ id, nome: f.name, tipo: f.type, dimensione: f.size, creato: uguale?.creato || ora + i, modificato: ora + i, cartella, origine,
        miniatura: miniature[i] ?? uguale?.miniatura ?? null, testo: testi[i] ?? uguale?.testo ?? '', blob: f,
        // SCAN-ORGANIZZA: categoria scelta da sola (finché l'utente non la cambia), preferito, etichette, scadenza.
        categoria: uguale && !uguale.categoriaAuto ? uguale.categoria : (categorie[i] || uguale?.categoria || 'generali'),
        categoriaAuto: uguale ? uguale.categoriaAuto !== false : true,
        preferito: !!uguale?.preferito, tag: uguale?.tag || [], scadenza: uguale?.scadenza || null,
        archiviato: archiviato || !!uguale?.archiviato });
    });
  });
  return ids;
}
async function aggiorna(ids, fn) {
  await fai('documenti', 'readwrite', (s) => {
    for (const id of ids) {
      const r = s.get(id);
      r.onsuccess = () => { if (r.result) s.put({ ...fn(r.result), modificato: Date.now() }); };
    }
  });
}
export async function rinominaDocumento(id, digitato) {
  const tutti = await elencoDocumenti();
  const d = tutti.find((x) => x.id === id);
  if (!d) throw new Error('File non più disponibile.');
  const nome = nomeUnico(nuovoNome(d.nome, digitato), tutti.filter((x) => x.cartella === d.cartella && x.id !== id).map((x) => x.nome));
  await aggiorna([id], (r) => ({ ...r, nome, blob: new File([r.blob], nome, { type: r.tipo || r.blob.type }) }));
  return nome;
}
// Campi che l'utente cambia dalla scheda del documento.
const MODIFICABILI = new Set(['preferito', 'categoria', 'categoriaAuto', 'tag', 'scadenza', 'archiviato']);
export function aggiornaDocumento(id, campi) {
  const ok = Object.fromEntries(Object.entries(campi).filter(([k]) => MODIFICABILI.has(k)));
  return aggiorna([id], (r) => ({ ...r, ...ok }));
}
export async function documento(id) {
  const d = await fai('documenti', 'readonly', (s) => s.get(id));
  if (!d) throw new Error('File non più disponibile su questo telefono.');
  const { blob, ...resto } = d;
  return resto;
}
export const spostaDocumenti = (ids, cartella) => aggiorna(ids, (r) => ({ ...r, cartella }));
export const aggiungiDettagli = (id, { miniatura, testo }) => aggiorna([id], (r) => ({ ...r, ...(miniatura !== undefined ? { miniatura } : {}), ...(testo !== undefined ? { testo } : {}) }));
export const eliminaDocumenti = (ids) => fai('documenti', 'readwrite', (s) => { ids.forEach((id) => s.delete(id)); });
export async function eliminaCartella(nome) {
  if (nome === CARTELLA_BASE) throw new Error('La cartella Generale resta.');
  const dentro = (await elencoDocumenti()).filter((d) => d.cartella === nome).map((d) => d.id);
  if (dentro.length) await spostaDocumenti(dentro, CARTELLA_BASE);
  await fai('cartelle', 'readwrite', (s) => { s.delete(nome); });
}
