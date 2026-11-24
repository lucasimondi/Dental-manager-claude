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
  // PDF-TESTO: pannello con carattere/colore/grandezza, trascinamento con un dito, tocco per modificare.
  await page.getByRole('button', { name: 'Testo', exact: true }).click();
  const foglio = page.getByRole('dialog', { name: 'Aggiungi testo' });
  await foglio.getByLabel('Testo da inserire').fill('Nota di prova');
  await foglio.getByRole('radio', { name: 'Classico' }).click();
  await foglio.getByRole('radio', { name: 'Rosso' }).click();
  for (let i = 0; i < 4; i++) await foglio.getByRole('button', { name: 'Più grande' }).click();
  await foglio.getByRole('button', { name: 'Grassetto' }).click();
  assert.equal(await foglio.getByLabel('Grandezza in punti').textContent(), '18 pt');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'pannello testo senza sforamenti');
  await page.screenshot({ path: `${out}/testo-pannello.png` });
  await foglio.getByRole('button', { name: 'Inserisci nella pagina' }).click();
  const box = page.locator('.pdf-testo'); await box.waitFor();
  const b0 = await box.boundingBox();
  assert.match(await box.locator('.pdf-testo-righe').evaluate(el => getComputedStyle(el).fontFamily), /Times/);
  assert.equal(await box.locator('.pdf-testo-righe').evaluate(el => getComputedStyle(el).color), 'rgb(179, 38, 30)');
  // trascinamento con un dito (tocchi reali)
  const cdp = await context.newCDPSession(page);
  const tocco = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await tocco('touchStart', b0.x + b0.width / 2, b0.y + b0.height / 2);
  for (let i = 1; i <= 8; i++) await tocco('touchMove', b0.x + b0.width / 2 - i * 8, b0.y + b0.height / 2 + i * 15);
  await tocco('touchEnd');
  const b1 = await box.boundingBox();
  assert.ok(Math.abs(b1.y - b0.y - 120) < 8 && Math.abs(b1.x - b0.x + 64) < 8, `testo spostato col dito (${b0.x},${b0.y} → ${b1.x},${b1.y})`);
  // un tocco lo riapre; cambio testo
  await tocco('touchStart', b1.x + b1.width / 2, b1.y + b1.height / 2); await tocco('touchEnd');
  const modifica = page.getByRole('dialog', { name: 'Modifica testo' }); await modifica.waitFor();
  await modifica.getByLabel('Testo da inserire').fill('Nota di prova\nseconda riga');
  await modifica.getByRole('button', { name: 'Applica' }).click();
  const b2 = await box.boundingBox();
  assert.ok(b2.height > b1.height * 1.8, 'due righe');
  // ↘ ingrandisce
  const maniglia = await page.getByRole('button', { name: 'Cambia grandezza del testo' }).boundingBox();
  await tocco('touchStart', maniglia.x + 16, maniglia.y + 16); for (let i = 1; i <= 5; i++) await tocco('touchMove', maniglia.x + 16 + i * 10, maniglia.y + 16); await tocco('touchEnd');
  const b3 = await box.boundingBox();
  assert.ok(b3.width > b2.width * 1.2 && b3.height > b2.height * 1.2, 'più grande con ↘');
  await page.screenshot({ path: `${out}/testo-pagina.png` });
  // Signature with proportions
  await page.getByRole('button', { name: 'Firma', exact: true }).click();
  const pad = await page.getByLabel('Spazio firma').boundingBox();
  await page.mouse.move(pad.x + 60, pad.y + 100); await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(pad.x + 60 + i * 20, pad.y + 100 + (i % 2 ? 25 : -20));
  await page.mouse.up();
  await page.screenshot({ path: `${out}/firma.png` });
  await page.getByRole('button', { name: 'Usa questa firma' }).click();
  await page.locator('.pdf-signature:not(.pdf-testo)').waitFor();
  const sig = await page.locator('.pdf-signature:not(.pdf-testo)').boundingBox();
  assert.ok(sig.width / sig.height > 2 && sig.width / sig.height < 6, `signature keeps its proportions (${sig.width}x${sig.height})`);
  await page.screenshot({ path: `${out}/firma-posizionata.png` });
  await page.getByRole('button', { name: 'Salva / Invia', exact: true }).click();
  await page.getByRole('button', { name: 'Condividi PDF', exact: true }).click();
  await page.waitForFunction(() => window.pdfTest.shares.length === 1);
  const bytes = Uint8Array.from(await page.evaluate(() => window.pdfTest.shares[0].bytes));
  const result = await PDFDocument.load(bytes);
  const annots = result.getPage(0).node.Annots()?.asArray().map(a => result.context.lookup(a).get(PDFName.of('Subtype'))?.toString()) || [];
  assert.ok(annots.includes('/Ink'), `ink annotation saved (${annots})`);
  const fonts = result.getPage(0).node.Resources().lookup(PDFName.of('Font'));
  const nomi = fonts.keys().map(k => fonts.lookup(k).get(PDFName.of('BaseFont')).toString());
  assert.ok(nomi.includes('/Times-Bold'), `testo vero in Times grassetto (${nomi})`);
  const { inflateSync } = await import('node:zlib');
  const contenuto = result.getPage(0).node.Contents(); const flussi = contenuto.asArray ? contenuto.asArray().map(r => result.context.lookup(r)) : [contenuto];
  const testo = flussi.map(f => { try { return inflateSync(Buffer.from(f.getContents())).toString('latin1'); } catch { return Buffer.from(f.getContents()).toString('latin1'); } }).join('\n');
  const hex = t => Buffer.from(t, 'latin1').toString('hex').toUpperCase();
  assert.ok(testo.toUpperCase().includes(hex('Nota di prova')) && testo.toUpperCase().includes(hex('seconda riga')), 'le due righe sono nel PDF come testo');
  // DOCK-PER-TE passo 2: «Pagine» dal documento apre subito l'organizzazione delle pagine.
  await page.goto('http://127.0.0.1:5176/tests/visual/personal-pdf.html?strumento=pagine');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'pagine-fittizio.pdf', mimeType: 'application/pdf', buffer: input });
  await page.getByRole('dialog', { name: 'Organizza pagine' }).waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Organizza pagine' }).locator('.pdf-row').count(), 3);
  assert.deepEqual(errors, []);
  console.log('PASS Pixel 7: ink, real text (font/colour/size, finger drag, tap to edit) and proportional signature saved in the copy; tools bar at the bottom; Pagine opens directly.');
} finally { await browser?.close(); server.kill(); }
