// SCAN-MLKIT (PO 2026-11-12: «Ml kit») — ponte con l'app Android «Poliedra Scan» (android/scan).
// Nell'app la pagina gira in una WebView che non sa condividere né scaricare file: l'app espone
// `window.PoliedraScan` (solo all'origine personal.poliedrasoft.it) e qui lo si usa per:
//  - navigator.share / navigator.canShare → foglio «Condividi» di Android (file o testo);
//  - scaricaDocumento → «Salva in…» di Android;
//  - ricevere PDF e foto da «Condividi → Poliedra Scan» / «Apri con».
// Lo scanner Google (ML Kit) non passa da qui: l'app lo apre per ogni «Scatta» (input con capture)
// e le pagine arrivano come file `scan-mlkit-*.jpg`, già raddrizzate.

export const ponte = (w = globalThis) => (w?.PoliedraScan && typeof w.PoliedraScan.postMessage === 'function' ? w.PoliedraScan : null);
export const inAppAndroid = (w = globalThis) => Boolean(ponte(w));
// Pagine dallo scanner Google: già ritagliate e raddrizzate, niente secondo raddrizzamento.
export const daScannerNativo = (file) => /^scan-mlkit-/.test(file?.name || '');

export const MAX_BYTES_PONTE = 40 * 1024 * 1024;

async function base64(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}
export function daBase64({ nome, mime, dati }) {
  const bin = atob(dati);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return new File([out], nome || 'documento', { type: mime || 'application/octet-stream' });
}
const descrivi = async (f) => {
  if (f.size > MAX_BYTES_PONTE) throw new Error(`${f.name}: oltre 40 MB.`);
  return { nome: f.name, mime: f.type || 'application/octet-stream', dati: await base64(f) };
};

export async function condividiNativo({ files = [], text = '', title = '' }, p = ponte()) {
  if (files.length) p.postMessage(JSON.stringify({ azione: 'condividi', files: await Promise.all(files.map(descrivi)) }));
  else p.postMessage(JSON.stringify({ azione: 'testo', testo: [title, text].filter(Boolean).join('\n\n') }));
}
export async function salvaNativo(file, p = ponte()) {
  p.postMessage(JSON.stringify({ azione: 'salva', file: await descrivi(file) }));
}

// Da chiamare una volta all'avvio: navigator.share passa dall'app e i file in arrivo vanno a `onFiles`.
export function installaPonte(onFiles, w = globalThis) {
  const p = ponte(w);
  if (!p) return false;
  const nav = w.navigator;
  try {
    Object.defineProperty(nav, 'canShare', { configurable: true, value: (dati) => Boolean(dati?.files?.length || dati?.text || dati?.title || dati?.url) });
    Object.defineProperty(nav, 'share', { configurable: true, value: (dati = {}) => condividiNativo({ files: dati.files || [], text: [dati.text, dati.url].filter(Boolean).join('\n'), title: dati.title }, p) });
  } catch { /* navigator non modificabile: restano i messaggi di ripiego */ }
  const ascolta = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (m.tipo === 'file' && Array.isArray(m.files) && m.files.length) onFiles?.(m.files.map(daBase64));
    } catch { /* messaggio non valido: ignorato */ }
  };
  if (typeof p.addEventListener === 'function') p.addEventListener('message', ascolta); else p.onmessage = ascolta;
  p.postMessage(JSON.stringify({ azione: 'pronto' }));
  return true;
}
