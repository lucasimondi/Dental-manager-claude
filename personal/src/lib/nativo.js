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

// SCAN-OCR-MLKIT — un solo ascoltatore per ponte: file in arrivo e risposte dell'OCR di ML Kit.
const stati = new WeakMap();
function stato(p) {
  let s = stati.get(p);
  if (s) return s;
  s = { attese: new Map(), onFiles: null, n: 0 };
  stati.set(p, s);
  const ascolta = (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; } // messaggio non valido: ignorato
    if (m.tipo === 'file' && Array.isArray(m.files) && m.files.length) s.onFiles?.(m.files.map(daBase64));
    else if (m.tipo === 'ocr' && s.attese.has(m.id)) {
      const { ok, ko } = s.attese.get(m.id); s.attese.delete(m.id);
      if (m.errore) ko(new Error(`Riconoscimento non riuscito: ${m.errore}`)); else ok(m.pagine || []);
    }
  };
  if (typeof p.addEventListener === 'function') p.addEventListener('message', ascolta); else p.onmessage = ascolta;
  return s;
}
const base64Url = (u) => String(u).replace(/^data:[^,]*,/, '');
// immagini: data URL JPEG/PNG. Restituisce [{ testo, larghezza, altezza, parole: [{ testo, x0, y0, x1, y1 }] }].
export function ocrNativo(immagini, p = ponte(), attesaMs = 120000) {
  if (!p) return Promise.reject(new Error('OCR del telefono non disponibile.'));
  const s = stato(p);
  s.n += 1;
  const id = `ocr-${Date.now()}-${s.n}`;
  return new Promise((ok, ko) => {
    const t = setTimeout(() => { s.attese.delete(id); ko(new Error('Riconoscimento troppo lento: riprova.')); }, attesaMs);
    s.attese.set(id, { ok: (v) => { clearTimeout(t); ok(v); }, ko: (e) => { clearTimeout(t); ko(e); } });
    p.postMessage(JSON.stringify({ azione: 'ocr', id, immagini: immagini.map(base64Url) }));
  });
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
  stato(p).onFiles = onFiles;
  p.postMessage(JSON.stringify({ azione: 'pronto' }));
  return true;
}
