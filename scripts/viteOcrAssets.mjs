// SCAN-PDF-MANAGER (PO 2026-11-11: «OCR locale») — motore Tesseract e lingua italiana serviti
// dal nostro sito sotto /ocr/ (copiati da node_modules al build, niente binari nel repository,
// niente CDN esterni a runtime). Il PDF non lascia mai il dispositivo.
import { createReadStream, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const radice = (pkg) => dirname(require.resolve(`${pkg}/package.json`));

export function fileOcr() {
  const core = radice('tesseract.js-core');
  const file = {
    'ocr/worker.min.js': join(radice('tesseract.js'), 'dist/worker.min.js'),
    'ocr/ita.traineddata.gz': join(radice('@tesseract.js-data/ita'), '4.0.0_best_int/ita.traineddata.gz'),
  };
  for (const v of ['relaxedsimd-lstm', 'simd-lstm', 'lstm']) file[`ocr/tesseract-core-${v}.wasm.js`] = join(core, `tesseract-core-${v}.wasm.js`);
  return file;
}

export function ocrAssets() {
  const file = fileOcr();
  return {
    name: 'poliedra-ocr-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const percorso = file[(req.url || '').split('?')[0].replace(/^\//, '')];
        if (!percorso) return next();
        res.setHeader('Content-Type', percorso.endsWith('.gz') ? 'application/gzip' : 'text/javascript');
        createReadStream(percorso).pipe(res);
      });
    },
    generateBundle() {
      for (const [fileName, percorso] of Object.entries(file)) this.emitFile({ type: 'asset', fileName, source: readFileSync(percorso) });
    },
  };
}
