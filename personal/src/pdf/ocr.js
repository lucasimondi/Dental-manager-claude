// SCAN-PDF-MANAGER (PO 2026-11-11: «OCR locale») — riconoscimento del testo sul telefono con
// Tesseract (italiano). Motore e lingua sono serviti dal nostro sito (/ocr/, scaricati una volta e
// tenuti dal browser): il documento non lascia mai il dispositivo e nessun modello esterno lo legge.
import { apriDocumento, disegnaPagina, liberaCanvas } from './raster.js';
import { aggiungiTestoOcr } from './operazioni.js';

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
      const worker = await avviaMotore(onAvanzamento);
      onAvanzamento?.(`Leggo il testo… pagina ${n} di ${totale}`);
      const { canvas, viewport } = await disegnaPagina(doc, n, { latoMax: 2200 });
      const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });
      liberaCanvas(canvas);
      risultati.push({ page: n, transform: viewport.transform, parole: paroleDaBlocchi(data.blocks) });
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
