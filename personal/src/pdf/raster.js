// SCAN-PDF-MANAGER — disegno delle pagine PDF su canvas (per OCR e compressione), sul dispositivo.
import * as pdfjs from 'pdfjs-personal/build/pdf.mjs';
import workerUrl from 'pdfjs-personal/build/pdf.worker.min.mjs?url';

if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function apriDocumento(bytes) {
  try { return await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, enableXfa: false }).promise; }
  catch (e) { throw new Error(e?.name === 'PasswordException' ? 'PDF protetto da password: aprilo e salvane una copia prima.' : 'PDF non leggibile.'); }
}

// Pagina `n` (da 1) disegnata con il lato lungo ≤ `latoMax` px oppure alla scala data.
export async function disegnaPagina(doc, n, { latoMax = 2000, scala = null } = {}) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const s = scala || Math.min(4, latoMax / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale: s });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, annotationMode: pdfjs.AnnotationMode.ENABLE }).promise;
  return { page, canvas, viewport, base };
}
export const liberaCanvas = (canvas) => { canvas.width = 0; canvas.height = 0; };
