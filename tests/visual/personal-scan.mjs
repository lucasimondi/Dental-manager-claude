// SCAN-HOME — Pixel 7: the Scan app opens on the scanner, a photo becomes a page, «PDF e firma» opens
// the PDF manager with Firma and closing it returns to the scanner; Archivia opens the archive page.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-scan'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5177', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5177')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:5177/tests/visual/personal-scan.html');
  // SCAN-HUB: Scan opens on its Home; «Scanner» opens the scanner page on top.
  await page.getByRole('button', { name: /^Scanner/ }).click();
  await page.getByRole('button', { name: /Scatta/ }).waitFor();
  assert.equal(await page.locator('.pp-schede, .pp-fab').count(), 0, 'no dock and no + in Scan');
  await page.screenshot({ path: `${out}/scan-vuota.png` });
  const foto = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, 600, 800); g.fillStyle = '#fff'; g.fillRect(100, 100, 400, 600); g.fillStyle = '#000'; g.font = '30px sans-serif'; g.fillText('DOCUMENTO FITTIZIO', 120, 200); const b = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); });
  await page.locator('.pp-pagina input[type=file]').first().setInputFiles({ name: 'foglio.png', mimeType: 'image/png', buffer: Buffer.from(foto) });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Archivia il PDF/.test(b.textContent) && !b.disabled));
  await page.screenshot({ path: `${out}/scan-pagina.png` });
  const largo = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(largo <= 0, `no horizontal overflow (${largo})`);
  // «PDF e firma» opens the PDF manager; closing it keeps the scanned page.
  await page.getByRole('button', { name: /Solo firmare o modificare un PDF/ }).click();
  await page.locator('.pdf-manager').waitFor();
  await page.getByRole('button', { name: 'Apri PDF o foto' }).waitFor();
  await page.screenshot({ path: `${out}/scan-pdf.png` });
  await page.locator('.pdf-header button', { hasText: 'Chiudi' }).click();
  await page.locator('.pdf-manager').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.pp-scansione-pagina').count(), 1, 'scanned page kept');
  // Archivia → the shared archive page of Personal opens on top.
  await page.getByRole('button', { name: /Archivia il PDF/ }).click();
  await page.locator('.pp-pagina-titolo', { hasText: 'Archivia un documento' }).waitFor();
  await page.screenshot({ path: `${out}/scan-archivia.png` });
  assert.deepEqual(errors, []);
  console.log('personal-scan PASS');
} finally { await browser?.close(); server.kill(); }
