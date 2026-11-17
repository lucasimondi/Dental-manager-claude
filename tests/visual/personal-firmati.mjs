// DOCUMENTI-FIRMATI + FIRMA-BIRO, synthetic only: sign with the ballpoint (blue and black ink, varying
// width), save with the simple sheet («… firmato» title, suggestion, Documenti firmati, new folder),
// then prepare a Gmail reply draft with the file attached. Supabase and the Apps Script are mocked.
import { chromium, devices } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-firmati'; await mkdir(out, { recursive: true });
const d = await PDFDocument.create(), font = await d.embedFont(StandardFonts.Helvetica);
d.addPage([595, 842]).drawText('MODULO DI ADESIONE FITTIZIO - Fornitore Prova - firma in basso', { x: 40, y: 780, font, size: 13 });
const input = Buffer.from(await d.save());
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5181')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage(); const errors = []; const script = []; const scritture = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname.endsWith('supabase.co')) {
      if (req.method() !== 'GET' && req.method() !== 'HEAD') scritture.push({ path: u.pathname, body: req.postData() });
      if (u.pathname.endsWith('/v_cartelle_mie')) return route.fulfill({ json: [
        { id: 'c-firmati', nome: 'Documenti firmati', padre_id: null, posizione: 0, archiviata_il: null, speciale: 'firmati' },
        { id: 'c-casa', nome: 'Casa', padre_id: null, posizione: 0, archiviata_il: null, speciale: null },
      ] });
      if (u.pathname.endsWith('/cartelle_mie') && req.method() === 'POST') return route.fulfill({ status: 201, json: { id: 'c-nuova', nome: 'Contratti casa', padre_id: 'c-casa' } });
      return route.fulfill({ json: [] });
    }
    if (u.hostname === 'script.google.com') {
      const body = JSON.parse(req.postData() || '{}'); script.push(body);
      if (body.azione === 'titolo_suggerito') return route.fulfill({ json: { ok: true, titolo: 'Modulo adesione – Fornitore Prova – 2026' } });
      if (body.azione === 'bozza_allegato') return route.fulfill({ json: { ok: true, risposta: true, a: 'Fornitore Prova <ufficio@example.invalid>', link: 'https://mail.google.com/mail/u/0/#drafts/prova' } });
      return route.fulfill({ json: { ok: true, id: '00000000-0000-4000-8000-000000000009', titolo: body.titolo } });
    }
    return route.abort();
  });
  await page.goto('http://127.0.0.1:5181/tests/visual/personal-firmati.html');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'modulo-fittizio.pdf', mimeType: 'application/pdf', buffer: input });
  await page.getByLabel('Spazio firma').waitFor();
  // Ballpoint: blue by default, then black; slow and fast strokes give different widths.
  assert.equal(await page.getByRole('radio', { name: 'Biro blu' }).getAttribute('aria-checked'), 'true');
  const pad = await page.getByLabel('Spazio firma').boundingBox();
  const traccia = async (x0, y0, passi, dx, dy, ritardo) => { await page.mouse.move(pad.x + x0, pad.y + y0); await page.mouse.down(); for (let i = 1; i <= passi; i++) { await page.mouse.move(pad.x + x0 + i * dx, pad.y + y0 + Math.sin(i / 2) * dy); if (ritardo) await page.waitForTimeout(ritardo); } await page.mouse.up(); };
  await traccia(30, 110, 14, 6, 28, 25);    // lento: tratto pieno
  await traccia(130, 120, 10, 22, 30, 0);   // veloce: tratto sottile
  const inchiostro = await page.evaluate(() => {
    const c = document.querySelector('.pdf-pad'), g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0, blu = 0, alfaMin = 255, alfaMax = 0;
    for (let i = 0; i < g.length; i += 4) if (g[i + 3] > 20) { n++; if (g[i + 2] > g[i] + 40) blu++; alfaMin = Math.min(alfaMin, g[i + 3]); alfaMax = Math.max(alfaMax, g[i + 3]); }
    return { n, blu, alfaMin, alfaMax };
  });
  assert.ok(inchiostro.n > 500, `ink drawn (${inchiostro.n})`);
  assert.ok(inchiostro.blu / inchiostro.n > 0.8, 'blue Bic ink');
  assert.ok(inchiostro.alfaMax - inchiostro.alfaMin > 120, `shades of pressure/grain (${inchiostro.alfaMin}–${inchiostro.alfaMax})`);
  await page.screenshot({ path: `${out}/firma-biro-blu.png` });
  await page.getByRole('radio', { name: 'Biro nera' }).click();
  const nero = await page.evaluate(() => { const c = document.querySelector('.pdf-pad'), g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, blu = 0; for (let i = 0; i < g.length; i += 4) if (g[i + 3] > 20) { n++; if (g[i + 2] > g[i] + 40) blu++; } return blu / n; });
  assert.ok(nero < 0.05, 'switching to black recolours the stroke');
  await page.screenshot({ path: `${out}/firma-biro-nera.png` });
  await page.getByRole('button', { name: 'Usa questa firma' }).click();
  await page.locator('.pdf-signature').waitFor();
  await page.screenshot({ path: `${out}/firma-posizionata.png` });
  // Save: the simple sheet.
  await page.getByRole('button', { name: 'Salva / Invia', exact: true }).click();
  await page.getByRole('button', { name: 'Salva firmato nell’archivio' }).click();
  const titolo = page.getByLabel('Titolo');
  assert.equal(await titolo.inputValue(), 'Modulo adesione Fornitore Prova firmato');
  await page.getByRole('button', { name: /Suggerito dal contenuto/ }).waitFor();
  assert.ok(script.some((b) => b.azione === 'titolo_suggerito' && /MODULO DI ADESIONE FITTIZIO/.test(b.testo)), 'suggestion asked with the PDF text');
  assert.equal(await page.getByLabel('Dove salvarlo').inputValue(), 'firmati');
  assert.equal(await page.getByLabel('Categoria').count(), 0, 'other classifications closed by default');
  await page.screenshot({ path: `${out}/salva-foglio.png` });
  await page.getByRole('button', { name: /Suggerito dal contenuto/ }).click();
  assert.equal(await titolo.inputValue(), 'Modulo adesione – Fornitore Prova – 2026 firmato');
  await titolo.fill('Adesione Fornitore Prova firmata');
  // New folder inside «Casa»: created in Poliedron, the script makes the Drive twin.
  await page.getByLabel('Dove salvarlo').selectOption('__nuova__');
  await page.getByLabel('Nome della cartella').fill('Contratti casa');
  await page.getByLabel('Dentro (facoltativo)').selectOption('c-casa');
  await page.getByRole('button', { name: /Altro \(facoltativo\)/ }).click();
  await page.getByLabel('Categoria').selectOption('legale');
  await page.screenshot({ path: `${out}/salva-nuova-cartella.png` });
  const larghezza = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert.ok(larghezza, 'no horizontal scroll');
  await page.getByRole('button', { name: 'Salva in «Contratti casa»' }).click();
  await page.getByRole('heading', { name: 'Salvato' }).waitFor();
  const nuova = scritture.find((s) => s.path.endsWith('/cartelle_mie'));
  assert.deepEqual(JSON.parse(nuova.body), { nome: 'Contratti casa', padre_id: 'c-casa' });
  const carica = script.find((b) => b.dati);
  assert.equal(carica.titolo, 'Adesione Fornitore Prova firmata');
  assert.equal(carica.cartella, 'c-nuova');
  assert.equal(carica.fascicolo, 'legale');
  assert.equal(carica.nonAnalizzare, true);
  assert.equal(carica.mime, 'application/pdf');
  // Reply draft with the file attached (never sent).
  await page.getByRole('button', { name: 'Rispondi all’email con il file allegato' }).click();
  await page.getByText('Si crea solo una bozza in Gmail: la invii tu.').waitFor();
  await page.screenshot({ path: `${out}/bozza.png` });
  await page.getByRole('button', { name: 'Prepara la bozza in Gmail' }).click();
  await page.getByRole('link', { name: 'Apri la bozza in Gmail' }).waitFor();
  const bozza = script.find((b) => b.azione === 'bozza_allegato');
  assert.equal(bozza.documento, '00000000-0000-4000-8000-000000000009');
  assert.equal(bozza.origine, '00000000-0000-4000-8000-000000000002');
  assert.match(bozza.testo, /in allegato il documento firmato «Adesione Fornitore Prova firmata»/);
  await page.screenshot({ path: `${out}/bozza-pronta.png` });
  assert.deepEqual(errors, []);
  console.log('personal-firmati PASS Pixel 7: ballpoint blue/black with shades, simple save sheet (firmato title, suggestion, new folder, optional fields), reply draft with attachment.');
} finally { await browser?.close(); server.kill(); }
