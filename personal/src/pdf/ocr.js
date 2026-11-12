// SCAN-PDF-MANAGER (PO 2026-11-11: «OCR locale») — riconoscimento del testo sul telefono con
// Tesseract (italiano). Motore e lingua sono serviti dal nostro sito (/ocr/, scaricati una volta e
// tenuti dal browser): il documento non lascia mai il dispositivo e nessun modello esterno lo legge.
import { apriDocumento, disegnaPagina, liberaCanvas } from './raster.js';
import { aggiungiTestoOcr } from './operazioni.js';
import { testoDaBlocchi } from './testo.js';
import { inAppAndroid, ocrNativo } from '../lib/nativo.js';

export const MAX_PAGINE_OCR = 30;
let motore = null;

function avviaMotore(avvisa) {
  if (!motore) {
    motore = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('ita', 1, {
        workerPath: '/ocr/worker.min.js', corePath: '/ocr/', langPath: '/ocr', workerBlobURL: false,
        logger: (m) => { if (/loading|initializ/i.test(m.status || '')) avvisa?.('Preparo il riconoscimento del testo (la prima volta scarica circa 5 MB)…'); },
      });
    })().catch((e) => { motore = null; throw new Error(`OCR non disponibile: ${e?.message || e}`); });
  }
  return motore;
}

// SCAN-OCR-MLKIT (PO 2026-11-12: «la gestione dell'ocr fatto bene»): nell'app Android il testo lo
// legge ML Kit di Google sul telefono (veloce, preciso sulle foto); nel browser resta Tesseract.
// immagine: canvas o data URL. Restituisce { testo, parole: [{ testo, x0, y0, x1, y1 }] } in pixel.
async function riconosci(immagine, avvisa) {
  if (inAppAndroid()) {
    const url = typeof immagine === 'string' ? immagine : immagine.toDataURL('image/jpeg', 0.92);
    const [pagina] = await ocrNativo([url]);
    return { testo: pagina?.testo || '', parole: (pagina?.parole || []).filter((w) => String(w.testo || '').trim()) };
  }
  const worker = await avviaMotore(avvisa);
  const { data } = await worker.recognize(immagine, {}, { blocks: true, text: false });
  return { testo: testoDaBlocchi(data.blocks), parole: paroleDaBlocchi(data.blocks) };
}
export const motoreOcr = () => (inAppAndroid() ? 'mlkit' : 'tesseract');

// Una pagina ha già testo vero (PDF nato digitale): niente OCR.
const haTesto = async (page) => (await page.getTextContent()).items.reduce((n, t) => n + (t.str || '').trim().length, 0) > 20;

export function paroleDaBlocchi(blocks, fiduciaMin = 35) {
  const out = [];
  for (const b of blocks || []) for (const par of b.paragraphs || []) for (const l of par.lines || []) for (const w of l.words || []) {
    const testo = (w.text || '').trim();
    if (testo && (w.confidence ?? 100) >= fiduciaMin) out.push({ testo, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
  }
  return out;
}

// Restituisce { bytes, parole, pagine } — bytes uguali all'originale se non c'era nulla da leggere.
export async function rendiRicercabile(bytes, { onAvanzamento } = {}) {
  const sorgente = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const doc = await apriDocumento(sorgente);
  const tutte = doc.numPages, totale = Math.min(tutte, MAX_PAGINE_OCR);
  const risultati = [];
  try {
    for (let n = 1; n <= totale; n += 1) {
      const page = await doc.getPage(n);
      if (await haTesto(page)) continue;
      onAvanzamento?.(`Leggo il testo… pagina ${n} di ${totale}`);
      const { canvas, viewport } = await disegnaPagina(doc, n, { latoMax: 2200 });
      try { risultati.push({ page: n, transform: viewport.transform, parole: (await riconosci(canvas, onAvanzamento)).parole }); }
      finally { liberaCanvas(canvas); }
    }
  } finally { await doc.destroy(); }
  const pagine = risultati.filter((r) => r.parole.length);
  if (!pagine.length) return { bytes: sorgente, parole: 0, pagine: 0, oltre: tutte > totale };
  const out = await aggiungiTestoOcr(sorgente, pagine);
  return { bytes: out.bytes, parole: out.parole, pagine: pagine.length, oltre: tutte > totale };
}

export async function fileRicercabile(file, opzioni) {
  const r = await rendiRicercabile(new Uint8Array(await file.arrayBuffer()), opzioni);
  return r.parole ? new File([r.bytes], file.name, { type: 'application/pdf' }) : file;
}

// SCAN-HUB — «Estrai testo»: il testo di foto o PDF, da copiare o condividere. Stesso motore locale.
// immagini: data URL, canvas o Blob (già raddrizzate). Restituisce il testo, pagina per pagina.
export async function testoDaImmagini(immagini, { onAvanzamento } = {}) {
  const parti = [];
  for (let i = 0; i < immagini.length; i += 1) {
    onAvanzamento?.(immagini.length > 1 ? `Leggo il testo… pagina ${i + 1} di ${immagini.length}` : 'Leggo il testo…');
    parti.push((await riconosci(immagini[i], onAvanzamento)).testo);
  }
  return parti;
}

// PDF: le pagine con testo vero lo danno subito, le altre (scansioni) passano dall'OCR.
// soloDigitale: solo il testo già nel PDF, senza OCR (indicizzazione veloce della libreria nel browser).
export async function testoDaPdf(file, { onAvanzamento, maxPagine = MAX_PAGINE_OCR, soloDigitale = false } = {}) {
  const doc = await apriDocumento(new Uint8Array(await file.arrayBuffer()));
  const totale = Math.min(doc.numPages, maxPagine);
  const parti = [];
  try {
    for (let n = 1; n <= totale; n += 1) {
      const page = await doc.getPage(n);
      if (await haTesto(page)) {
        const c = await page.getTextContent();
        parti.push(c.items.map((t) => `${t.str}${t.hasEOL ? '\n' : ''}`).join('').replace(/[ \t]+\n/g, '\n').trim());
        continue;
      }
      if (soloDigitale) continue;
      onAvanzamento?.(`Leggo il testo… pagina ${n} di ${totale}`);
      const { canvas } = await disegnaPagina(doc, n, { latoMax: 2200 });
      try { parti.push((await riconosci(canvas, onAvanzamento)).testo); } finally { liberaCanvas(canvas); }
    }
  } finally { await doc.destroy(); }
  return { parti, oltre: doc.numPages > totale };
}

// SCAN-OCR-MLKIT — testo per la ricerca in «I miei documenti»: nell'app con ML Kit (anche le
// scansioni, fino a 10 pagine); nel browser solo il testo già presente nel PDF, per non rallentare.
export async function testoPerRicerca(file) {
  const app = inAppAndroid();
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const { parti } = await testoDaPdf(file, { maxPagine: 10, soloDigitale: !app });
    return parti.join('\n\n').slice(0, 20000);
  }
  if (/^text\//.test(file.type)) return (await file.text()).slice(0, 20000);
  if (app && (file.type || '').startsWith('image/')) {
    const url = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(r.error); r.readAsDataURL(file); });
    return (await riconosci(url)).testo.slice(0, 20000);
  }
  return '';
}
