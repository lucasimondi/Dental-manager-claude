// SCAN-PDF-MANAGER (PO 2026-11-11) — verifica sintetica su Pixel 7: foto storta raddrizzata da sola,
// OCR in Scan e nel gestore (testo ricercabile), compressione, sigla su tutte le pagine.
// Solo dati inventati; l'invio è intercettato, nessun file lascia il browser.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-scan-strumenti'; await mkdir(out, { recursive: true });
const testoDi = async (bytes) => {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.js')).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  let t = ''; for (let n = 1; n <= doc.numPages; n++) t += (await (await doc.getPage(n)).getTextContent()).items.map(i => i.str).join(' ') + '\n';
  await doc.destroy(); return t;
};
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5177', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5177')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:5177/tests/visual/scan-pdf-workflow.html');
  await page.evaluate(() => localStorage.clear());
  // Foto sintetica: foglio inclinato su un tavolo scuro, con testo stampato.
  const foto = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 1600; const x = c.getContext('2d');
    x.fillStyle = '#2b2b30'; x.fillRect(0, 0, 1200, 1600);
    x.save(); x.translate(600, 800); x.rotate(-0.09); x.fillStyle = '#f4f2ec'; x.fillRect(-420, -580, 840, 1160);
    x.fillStyle = '#111'; x.font = 'bold 64px Arial'; x.fillText('REFERTO ECOGRAFIA', -360, -420);
    x.font = '44px Arial'; ['Paziente di prova', 'Esame eseguito oggi', 'Nessuna alterazione'].forEach((t, i) => x.fillText(t, -360, -280 + i * 90));
    x.restore();
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .92));
    return [...new Uint8Array(await b.arrayBuffer())];
  });
  await page.evaluate(() => {
    window.__condivisi = [];
    const vero = navigator.share;
    Object.defineProperty(navigator, 'share', { configurable: true, get: () => async (dati) => { for (const f of dati.files || []) window.__condivisi.push([...new Uint8Array(await f.arrayBuffer())]); }, set: () => {} });
    Object.defineProperty(navigator, 'canShare', { configurable: true, get: () => () => true, set: () => {} });
    void vero;
  });
  await page.locator('input[type=file][accept="image/*,.heic,.heif"]').setInputFiles({ name: 'foglio-storto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(foto) });
  await page.getByText('Raddrizzata').waitFor({ timeout: 20000 });
  const misure = await page.locator('.pp-scansione-pagina img').first().evaluate(img => [img.naturalWidth, img.naturalHeight]);
  assert.ok(misure[1] / misure[0] > 1.25 && misure[1] / misure[0] < 1.5, `foglio raddrizzato ${misure}`);
  await page.screenshot({ path: `${out}/1-raddrizzata.png`, fullPage: true });
  // Editor degli angoli
  await page.getByRole('button', { name: /Raddrizza o ritaglia pagina 1/ }).click();
  await page.getByRole('dialog', { name: 'Raddrizza il foglio' }).waitFor();
  await page.screenshot({ path: `${out}/2-angoli.png` });
  await page.getByRole('button', { name: 'Raddrizza', exact: true }).click();
  await page.getByRole('dialog', { name: 'Raddrizza il foglio' }).waitFor({ state: 'detached' });
  // OCR in Scan, poi invio intercettato
  await page.getByLabel('Testo ricercabile (OCR)').check();
  await page.getByLabel('PDF leggero').check();
  await page.waitForFunction(() => !document.querySelector('.pp-invio-salute button').disabled, null, { timeout: 120000 });
  await page.screenshot({ path: `${out}/3-ocr-pronto.png`, fullPage: true });
  await page.getByRole('button', { name: 'Mail' }).click();
  await page.waitForFunction(() => window.__condivisi.length === 1);
  const inviato = await page.evaluate(() => window.__condivisi[0]);
  const testo = await testoDi(inviato);
  assert.match(testo, /REFERTO/i, `testo OCR: ${testo.slice(0, 200)}`);
  console.log('Scan OCR:', testo.replace(/\s+/g, ' ').trim().slice(0, 120), '·', Math.round(inviato.length / 1024), 'KB');
  // Gestore: due PDF sintetici, OCR già presente → messaggio; sigla su tutte le pagine; comprimi.
  await page.getByRole('button', { name: 'Carica due PDF di prova' }).click();
  await page.getByRole('button', { name: 'Apri · Firma' }).first().click();
  await page.locator('.pdfViewer .page[data-page-number="1"] canvas').waitFor();
  await page.waitForFunction(() => !document.querySelector('.pdf-header .pdf-primary').disabled);
  await page.getByRole('button', { name: 'Firma', exact: true }).click();
  await page.getByRole('tab', { name: 'Sigla' }).click();
  const pad = await page.getByLabel('Spazio sigla').boundingBox();
  await page.mouse.move(pad.x + 40, pad.y + 120); await page.mouse.down();
  for (let i = 0; i < 8; i++) await page.mouse.move(pad.x + 40 + i * 15, pad.y + 120 + (i % 2 ? -30 : 20));
  await page.mouse.up();
  assert.ok(await page.getByLabel(/Metti su tutte le 3 pagine/).isChecked());
  await page.getByRole('button', { name: 'Usa questa sigla' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.pdf-signature').length >= 1);
  await page.getByRole('button', { name: 'Firma', exact: true }).click();
  await page.getByRole('tab', { name: 'Sigla' }).click();
  assert.ok(await page.getByRole('button', { name: /Usa sigla salvata/ }).isVisible());
  await page.getByRole('button', { name: 'Data di oggi' }).click();
  await page.screenshot({ path: `${out}/4-sigla-data.png` });
  await page.getByRole('button', { name: 'Testo (OCR)' }).click();
  await page.getByText(/già ricercabile/).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Comprimi' }).click();
  await page.getByRole('button', { name: /Forte/ }).click();
  await page.waitForFunction(() => /compresso|Già leggero/.test(document.querySelector('.pdf-status')?.textContent || ''), null, { timeout: 60000 });
  console.log('Comprimi:', await page.locator('.pdf-status').textContent());
  await page.screenshot({ path: `${out}/5-compresso.png` });
  await page.getByRole('button', { name: 'Salva / Invia' }).click();
  await page.getByRole('dialog', { name: 'Salva copia PDF' }).waitFor();
  assert.match(await page.getByRole('dialog', { name: 'Salva copia PDF' }).textContent(), /KB|MB/);
  await page.screenshot({ path: `${out}/6-salva.png` });
  assert.deepEqual(errors, []);
  console.log('PASS scan-strumenti');
} finally { await browser?.close(); server.kill(); }
