import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
import worker from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import { quotePdfFile } from './quoteFiles.js';
pdfjs.GlobalWorkerOptions.workerSrc = worker;
export async function renderQuoteJpgFiles(pdf) {
  const task = pdfjs.getDocument({ data: new Uint8Array(await quotePdfFile(pdf).arrayBuffer()) });
  try {
    const doc = await task.promise, files = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i), viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      try {
        await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: '#ffffff' }).promise;
        const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Impossibile generare JPG.')), 'image/jpeg', .92));
        const suffix = doc.numPages > 1 ? `-${i}` : '';
        files.push(new File([blob], pdf.filename.replace(/\.pdf$/i, `${suffix}.jpg`), { type: 'image/jpeg' }));
      } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
    }
    return files;
  } finally { await task.destroy(); }
}
