import { chromium, devices } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-salute'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5176', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5176')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:5176/tests/visual/personal-salute.html');
  // Synthetic 600×800 photo: white sheet in the middle of a dark border.
  const foto = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, 600, 800); g.fillStyle = '#fff'; g.fillRect(100, 100, 400, 600); g.fillStyle = '#000'; g.font = '30px sans-serif'; g.fillText('REFERTO FITTIZIO', 130, 200); const b = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); });
  await page.locator('input[type=file]').first().setInputFiles({ name: 'referto.png', mimeType: 'image/png', buffer: Buffer.from(foto) });
  await page.getByLabel('Ritaglia pagina 1').click();
  await page.locator('.pp-ritaglio-box').waitFor();
  await page.screenshot({ path: `${out}/ritaglio.png` });
  const box = await page.locator('.pp-ritaglio-quadro img').boundingBox();
  const drag = async (sel, dx, dy) => { const h = await page.locator(sel).boundingBox(); const x = h.x + h.width / 2; const y = h.y + h.height / 2; await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 6 }); await page.mouse.up(); };
  await drag('.pp-rm-nw', box.width / 6, box.height / 8);
  await drag('.pp-rm-se', -box.width / 6, -box.height / 8);
  await page.getByRole('button', { name: 'Fatto' }).click();
  await page.locator('.pp-ritaglio').waitFor({ state: 'detached' });
  // A PDF from «PDF e file» joins the same list: one PDF with 2 pages.
  const pdfIn = await PDFDocument.create(); pdfIn.addPage([595, 842]);
  await page.locator('input[type=file]').nth(2).setInputFiles({ name: 'esame.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdfIn.save()) });
  await page.locator('.pp-scansione-pdf').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Archivia il PDF/.test(b.textContent) && !b.disabled));
  await page.getByRole('button', { name: 'WhatsApp' }).click();
  await page.waitForFunction(() => window.saluteTest.condivisi.length === 1);
  await page.screenshot({ path: `${out}/scansione.png` });
  await page.getByRole('button', { name: /Archivia il PDF/ }).click();
  await page.waitForFunction(() => window.saluteTest.pagina);
  const r = await page.evaluate(() => window.saluteTest.pagina);
  assert.equal(r.tipo, 'carica'); assert.equal(r.opzioni.salute, true); assert.equal(r.opzioni.persona, 'Persona Test');
  const pdf = await PDFDocument.load(Uint8Array.from(r.bytes)); assert.equal(pdf.getPageCount(), 2);
  // Cropped image (≈400×600 of 600×800) is embedded; check its pixel size.
  const img = [...pdf.context.enumerateIndirectObjects()].map(([, o]) => o).find((o) => o?.dict?.get?.(pdf.context.obj('Subtype'))?.toString() === '/Image');
  const w = img.dict.get(pdf.context.obj('Width')).asNumber(); const h = img.dict.get(pdf.context.obj('Height')).asNumber();
  assert.ok(Math.abs(w - 400) < 20 && Math.abs(h - 600) < 20, `ritaglio ${w}×${h}`);
  // Photo + PDF → one PDF.
  const pagine = await page.evaluate(async (bytes) => {
    const { PDFDocument: P } = await import('/node_modules/.vite/deps/pdf-lib.js').catch(() => ({}));
    const foto = new File([new Uint8Array(bytes)], 'f.png', { type: 'image/png' });
    const pdf = new File([new Uint8Array(window.saluteTest.pagina.bytes)], 'r.pdf', { type: 'application/pdf' });
    const r = await window.saluteTest.unisciInPdf([foto, pdf, new File(['x'], 'fattura.xml')], 'Referti');
    return { nome: r.file.name, esclusi: r.esclusi, bytes: Array.from(new Uint8Array(await r.file.arrayBuffer())), P: !!P };
  }, foto);
  assert.equal(pagine.nome, 'Referti.pdf'); assert.deepEqual(pagine.esclusi, ['fattura.xml']);
  assert.equal((await PDFDocument.load(Uint8Array.from(pagine.bytes))).getPageCount(), 3);
  assert.deepEqual(errors, []);
  console.log('personal-salute PASS', `${w}×${h}`);
} finally { await browser?.close(); server.kill(); }
