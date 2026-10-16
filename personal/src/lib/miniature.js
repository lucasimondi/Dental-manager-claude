// POL-VITA-006 — miniature dei documenti negli elenchi (dallo script, che le dà solo per i file
// registrati in archivio e mai per quelli dei pazienti). Richieste raggruppate, memoria nel
// telefono (IndexedDB) per non riscaricarle: se la memoria non c'è, funziona lo stesso.
import { URL_CARICAMENTO } from './archivio.js';

const LOTTO = 12;
const memoria = new Map(); // id → dataURL | null
const inAttesa = new Map(); // id → [resolve]
let timer = null;
let tokenDi = async () => null;

export const impostaToken = (fn) => { tokenDi = fn; };

const apriDb = () => new Promise((ok) => {
  try {
    const r = indexedDB.open('poliedron-personal', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('miniature');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ok(null);
  } catch { ok(null); }
});
let db = null;
const dbPronto = () => (db ??= apriDb());

async function leggiSalvate(ids) {
  const d = await dbPronto();
  if (!d) return {};
  return new Promise((ok) => {
    const out = {};
    try {
      const st = d.transaction('miniature').objectStore('miniature');
      let n = ids.length;
      if (!n) ok(out);
      ids.forEach((id) => {
        const r = st.get(id);
        r.onsuccess = () => { if (r.result !== undefined) out[id] = r.result; if (--n === 0) ok(out); };
        r.onerror = () => { if (--n === 0) ok(out); };
      });
    } catch { ok(out); }
  });
}

async function salva(coppie) {
  const d = await dbPronto();
  if (!d) return;
  try {
    const st = d.transaction('miniature', 'readwrite').objectStore('miniature');
    coppie.forEach(([id, v]) => { if (v) st.put(v, id); });
  } catch { /* facoltativo */ }
}

export async function scaricaMiniature(ids, token, fetchImpl = fetch) {
  const res = await fetchImpl(URL_CARICAMENTO, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, azione: 'miniature', ids }),
  });
  const r = await res.json();
  if (!r.ok) throw new Error(r.errore || 'Miniature non disponibili');
  return r.miniature || {};
}

async function svuota() {
  timer = null;
  const ids = [...inAttesa.keys()];
  const salvate = await leggiSalvate(ids);
  const mancanti = ids.filter((id) => !(id in salvate));
  const risolvi = (id, v) => { memoria.set(id, v); (inAttesa.get(id) || []).forEach((f) => f(v)); inAttesa.delete(id); };
  Object.entries(salvate).forEach(([id, v]) => risolvi(id, v));
  const token = mancanti.length ? await tokenDi() : null;
  for (let i = 0; i < mancanti.length; i += LOTTO) {
    const parte = mancanti.slice(i, i + LOTTO);
    let trovate = {};
    try { if (token) trovate = await scaricaMiniature(parte, token); } catch { trovate = {}; }
    parte.forEach((id) => risolvi(id, trovate[id] || null));
    salva(Object.entries(trovate));
  }
}

// Una miniatura (dataURL) o null. Le richieste ravvicinate partono insieme.
export function miniatura(driveFileId) {
  if (!driveFileId) return Promise.resolve(null);
  if (memoria.has(driveFileId)) return Promise.resolve(memoria.get(driveFileId));
  return new Promise((ok) => {
    inAttesa.set(driveFileId, [...(inAttesa.get(driveFileId) || []), ok]);
    if (!timer) timer = setTimeout(svuota, 60);
  });
}
