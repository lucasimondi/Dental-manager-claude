// SCAN-PDF-MANAGER (PO 2026-11-11: «Comprimi PDF») — ogni pagina ridisegnata come JPEG a
// risoluzione più bassa, sul dispositivo. Il testo diventa immagine (si può rifare l'OCR dopo):
// l'interfaccia lo dice prima. Se il risultato non pesa almeno il 10% in meno si tiene l'originale.
import { apriDocumento, disegnaPagina, liberaCanvas } from './raster.js';
import { pdfDaImmagini, LIVELLI_COMPRESSIONE, convieneCompresso } from './operazioni.js';

const jpeg = (canvas, qualita) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a)), reject) : reject(new Error('Compressione non riuscita.'))), 'image/jpeg', qualita));

export async function comprimiPdf(bytes, { livello = 'media', titolo, onAvanzamento } = {}) {
  const { dpi, qualita } = LIVELLI_COMPRESSIONE[livello] || LIVELLI_COMPRESSIONE.media;
  const sorgente = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const doc = await apriDocumento(sorgente);
  const pagine = [];
  try {
    for (let n = 1; n <= doc.numPages; n += 1) {
      onAvanzamento?.(`Comprimo… pagina ${n} di ${doc.numPages}`);
      const { canvas, base } = await disegnaPagina(doc, n, { scala: dpi / 72 });
      pagine.push({ jpeg: await jpeg(canvas, qualita), larghezza: base.width, altezza: base.height });
      liberaCanvas(canvas);
    }
  } finally { await doc.destroy(); }
  const out = new Uint8Array(await pdfDaImmagini(pagine, titolo));
  return { bytes: convieneCompresso(sorgente.length, out.length) ? out : sorgente, prima: sorgente.length, dopo: out.length, ridotto: convieneCompresso(sorgente.length, out.length) };
}
