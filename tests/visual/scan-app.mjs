// SCAN-OCR-MLKIT — Pixel 7 with a simulated Android bridge (window.PoliedraScan, as the Poliedra Scan
// app injects it): Estrai testo uses the app OCR (ML Kit) instead of Tesseract, a scanned PDF saved in
// «I miei documenti» gets its text indexed and is found by searching a word of its content, and
// Condividi goes to the app. Synthetic data only.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-scan-app'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5179')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  // Simulated native bridge: OCR returns a fixed text with word boxes; other messages are recorded.
  await page.addInitScript(() => {
    const ascolti = []; window.__inviati = [];
    window.PoliedraScan = {
      addEventListener: (t, fn) => ascolti.push(fn),
      postMessage: (s) => {
        const m = JSON.parse(s); window.__inviati.push(m.azione);
        if (m.azione === 'ocr') setTimeout(() => ascolti.forEach((fn) => fn({ data: JSON.stringify({ tipo: 'ocr', id: m.id,
          pagine: m.immagini.map(() => ({ testo: 'FATTURA ENEL\nTotale 120 euro', larghezza: 1000, altezza: 1300, parole: [{ testo: 'FATTURA', x0: 100, y0: 100, x1: 400, y1: 160 }, { testo: 'ENEL', x0: 420, y0: 100, x1: 600, y1: 160 }] })) }) })), 50);
      },
    };
  });
  const foglio = await (async () => { await page.goto('about:blank'); return page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 1000; c.height = 1300; const g = c.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, 1000, 1300); g.fillStyle = '#fff'; g.fillRect(120, 120, 760, 1060); const b = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); }); })();
  await page.goto('http://127.0.0.1:5179/tests/visual/personal-scan.html');
  await page.getByText('Inizia la tua prima scansione').waitFor();
  assert.ok(await page.evaluate(() => window.__inviati.includes('pronto')), 'bridge installed');

  await page.getByRole('button', { name: 'Estrai testo' }).click();
  await page.getByText('Riconoscimento Google ML Kit').waitFor();
  await page.locator('.scan-testo input[type=file]').nth(1).setInputFiles({ name: 'bolletta.png', mimeType: 'image/png', buffer: Buffer.from(foglio) });
  await page.locator('.scan-testo-area').waitFor({ timeout: 20000 });
  assert.match(await page.locator('.scan-testo-area').inputValue(), /FATTURA ENEL/);
  await page.getByRole('button', { name: 'Condividi' }).click();
  await page.waitForFunction(() => window.__inviati.includes('testo'));
  await page.screenshot({ path: `${out}/1-testo-mlkit.png` });
  await page.locator('.pp-pagina-barra button').first().click();

  // Scanner with «Testo ricercabile (OCR)» → saved in a folder → found by a word of its content.
  await page.getByRole('button', { name: /^Scanner/ }).click();
  await page.getByLabel('Testo ricercabile (OCR)').check();
  await page.locator('.pp-pagina input[type=file]').nth(1).setInputFiles({ name: 'bolletta.png', mimeType: 'image/png', buffer: Buffer.from(foglio) });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Salva in I miei documenti/.test(b.textContent) && !b.disabled), null, { timeout: 30000 });
  await page.getByRole('button', { name: 'Salva in I miei documenti' }).click();
  await page.locator('.scan-voce', { hasText: 'Generale' }).click();
  await page.locator('.pp-pagina-barra button').first().click();
  await page.getByRole('button', { name: 'I miei documenti' }).click();
  await page.getByLabel('Cerca nei documenti').fill('enel');
  await page.locator('.scan-documenti .scan-recente').first().waitFor({ timeout: 20000 });
  assert.equal(await page.locator('.scan-documenti .scan-recente').count(), 1, 'found by OCR text');
  await page.getByRole('button', { name: /^Condividi Scansione/ }).click();
  await page.waitForFunction(() => window.__inviati.includes('condividi'));
  await page.screenshot({ path: `${out}/2-ricerca-testo.png` });
  // SCAN-ESPORTA: Word and JPG from the scanned PDF, saved in the same folder; «Aggiungi pagine».
  await page.getByLabel('Cerca nei documenti').fill('');
  await page.getByRole('button', { name: /^Altre azioni per Scansione/ }).click();
  await page.getByRole('button', { name: 'Esporta come Word, JPG, testo' }).click();
  await page.screenshot({ path: `${out}/3-esporta.png` });
  await page.locator('.scan-voce', { hasText: 'Word (.docx)' }).click();
  await page.locator('.scan-documenti .scan-recente', { hasText: 'Scansione' }).nth(1).waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.scan-documenti .scan-recente').length === 2);
  assert.match(await page.locator('.scan-documenti').textContent(), /DOCX/);
  await page.getByRole('button', { name: /^Altre azioni per Scansione.*\.pdf/ }).click();
  await page.getByRole('button', { name: 'Esporta come Word, JPG, testo' }).click();
  await page.locator('.scan-voce', { hasText: 'Immagini JPG' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.scan-documenti .scan-recente').length === 3, null, { timeout: 30000 });
  await page.screenshot({ path: `${out}/4-esportati.png` });
  await page.getByRole('button', { name: /^Altre azioni per Scansione.*\.pdf/ }).click();
  await page.getByRole('button', { name: 'Aggiungi pagine' }).click();
  await page.locator('.pp-pagina-titolo', { hasText: 'Scanner' }).waitFor();
  await page.locator('.pp-scansione-pagina').first().waitFor();
  assert.equal(await page.locator('.pp-scansione-pagina').count(), 1, 'existing PDF loaded in the scanner');
  assert.deepEqual(errors, []);
  console.log('scan-app PASS ·', await page.evaluate(() => window.__inviati.join(',')));
} finally { await browser?.close(); server.kill(); }
