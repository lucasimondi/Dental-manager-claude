// Synthetic-only check: ink drawing and free text are saved into the exported copy.
import { chromium, devices } from 'playwright';
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-pdf'; await mkdir(out, { recursive: true });
const d = await PDFDocument.create(), font = await d.embedFont(StandardFonts.Helvetica);
for (let i = 0; i < 3; i++) d.addPage([595, 842]).drawText(`PDF FITTIZIO - pagina ${i + 1}`, { x: 40, y: 780, font, size: 18 });
const input = Buffer.from(await d.save());
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5176', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5176')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:5176/tests/visual/personal-pdf.html');
  await page.screenshot({ path: `${out}/vuoto.png` });
  await page.locator('input[type=file]').first().setInputFiles({ name: 'annotazioni-fittizio.pdf', mimeType: 'application/pdf', buffer: input });
  await page.locator('.pdfViewer .page[data-page-number="1"] canvas').waitFor();
  await page.waitForFunction(() => !document.querySelector('.pdf-primary').disabled);
  const tools = await page.locator('.pdf-tools').boundingBox(), vp = page.viewportSize();
  assert.ok(tools.y + tools.height >= vp.height - 2, 'tools bar sits at the bottom');
  await page.screenshot({ path: `${out}/aperto.png` });
  // Ink
  await page.getByRole('button', { name: 'Disegno', exact: true }).click();
  const p1 = await page.locator('.pdfViewer .page[data-page-number="1"]').boundingBox();
  await page.mouse.move(p1.x + 60, p1.y + 200); await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(p1.x + 60 + i * 18, p1.y + 200 + (i % 2 ? 25 : -10));
  await page.mouse.up();
  // Free text
  await page.getByRole('button', { name: 'Testo', exact: true }).click();
  await page.mouse.click(p1.x + 80, p1.y + 320);
  await page.keyboard.type('Nota di prova');
  await page.getByRole('button', { name: 'Leggi', exact: true }).click();
  // Signature with proportions
  await page.getByRole('button', { name: 'Firma', exact: true }).click();
  const pad = await page.getByLabel('Spazio firma').boundingBox();
  await page.mouse.move(pad.x + 60, pad.y + 100); await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(pad.x + 60 + i * 20, pad.y + 100 + (i % 2 ? 25 : -20));
  await page.mouse.up();
  await page.screenshot({ path: `${out}/firma.png` });
  await page.getByRole('button', { name: 'Usa questa firma' }).click();
  await page.locator('.pdf-signature').waitFor();
  const sig = await page.locator('.pdf-signature').boundingBox();
  assert.ok(sig.width / sig.height > 2 && sig.width / sig.height < 6, `signature keeps its proportions (${sig.width}x${sig.height})`);
  await page.screenshot({ path: `${out}/firma-posizionata.png` });
  await page.getByRole('button', { name: 'Salva copia', exact: true }).click();
  await page.getByRole('button', { name: 'Condividi PDF', exact: true }).click();
  await page.waitForFunction(() => window.pdfTest.shares.length === 1);
  const bytes = Uint8Array.from(await page.evaluate(() => window.pdfTest.shares[0].bytes));
  const result = await PDFDocument.load(bytes);
  const annots = result.getPage(0).node.Annots()?.asArray().map(a => result.context.lookup(a).get(PDFName.of('Subtype'))?.toString()) || [];
  assert.ok(annots.includes('/Ink'), `ink annotation saved (${annots})`);
  assert.ok(annots.includes('/FreeText'), `free text annotation saved (${annots})`);
  assert.deepEqual(errors, []);
  console.log('PASS Pixel 7: ink, free text and proportional signature saved in the copy; tools bar at the bottom.');
} finally { await browser?.close(); server.kill(); }
