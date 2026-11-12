// SCAN-HUB — «Recenti» di Scan: i file creati, condivisi o scaricati da Scan restano in un elenco
// SOLO su questo dispositivo (IndexedDB del browser), per riaprirli o rimandarli. Niente rete,
// niente database: non sono l'archivio. Si tolgono uno per uno o tutti; l'elenco si accorcia da
// solo (i più vecchi escono) oltre MAX_RECENTI file o MAX_BYTES_RECENTI in tutto.

export const MAX_RECENTI = 30;
export const MAX_BYTES_RECENTI = 80 * 1024 * 1024;
const DB = 'poliedron-scan';
const STORE = 'recenti';

// Pura: dato l'elenco (più recente per primo) restituisce gli id da togliere.
export function daTogliere(elenco, { max = MAX_RECENTI, maxBytes = MAX_BYTES_RECENTI } = {}) {
  const ordinati = [...elenco].sort((a, b) => b.data - a.data);
  const via = [];
  let somma = 0;
  ordinati.forEach((r, i) => {
    somma += r.dimensione || 0;
    if (i >= max || (i > 0 && somma > maxBytes)) via.push(r.id);
  });
  return via;
}

// Pura: «oggi», «ieri», «entro 7 giorni», «precedenti» (come nell'elenco del telefono).
export function gruppoData(ms, ora = Date.now()) {
  const g = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const giorni = Math.round((g(ora) - g(ms)) / 86400000);
  return giorni <= 0 ? 'Oggi' : giorni === 1 ? 'Ieri' : giorni < 7 ? 'Entro 7 giorni' : 'Precedenti';
}

export function formatoPeso(n = 0) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function apri(idb = globalThis.indexedDB) {
  return new Promise((ok, ko) => {
    if (!idb) { ko(new Error('Memoria del dispositivo non disponibile.')); return; }
    const r = idb.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error || new Error('Memoria del dispositivo non disponibile.'));
  });
}
function fai(modo, fn) {
  return apri().then((db) => new Promise((ok, ko) => {
    const tx = db.transaction(STORE, modo);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); ok(out?.result ?? out); };
    tx.onerror = () => { db.close(); ko(tx.error); };
    tx.onabort = () => { db.close(); ko(tx.error || new Error('Operazione annullata.')); };
  }));
}

// Elenco senza i contenuti (leggero), più recente per primo.
export async function elencoRecenti() {
  const tutti = await fai('readonly', (s) => s.getAll());
  return (tutti || []).map(({ blob, ...r }) => r).sort((a, b) => b.data - a.data);
}
export async function fileRecente(id) {
  const r = await fai('readonly', (s) => s.get(id));
  if (!r) throw new Error('File non più disponibile su questo telefono.');
  return new File([r.blob], r.nome, { type: r.tipo || r.blob.type });
}
// Salva i file (stesso nome e stesso peso = stesso file: si aggiorna solo la data).
export async function ricordaFile(files, origine = 'scan') {
  const elenco = [...(files || [])].filter(Boolean);
  if (!elenco.length) return;
  const esistenti = await elencoRecenti();
  const ora = Date.now();
  await fai('readwrite', (s) => {
    elenco.forEach((f, i) => {
      const uguale = esistenti.find((r) => r.nome === f.name && r.dimensione === f.size);
      s.put({ id: uguale?.id || `${ora}-${i}-${Math.random().toString(36).slice(2, 8)}`, nome: f.name, tipo: f.type, dimensione: f.size, data: ora + i, origine, blob: f });
    });
  });
  const via = daTogliere(await elencoRecenti());
  if (via.length) await togliRecenti(via);
}
export const togliRecenti = (ids) => fai('readwrite', (s) => { ids.forEach((id) => s.delete(id)); });
export const svuotaRecenti = () => fai('readwrite', (s) => { s.clear(); });
