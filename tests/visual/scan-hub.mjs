// SCAN-HUB — Pixel 7: Scan opens on its Home (Scanner, PDF e firma, Carta d'identità, tool grid,
// Da album / Da file, Recenti, camera button). Carta d'identità: synthetic front and back → one A4
// PDF, «Scarica» puts it in Recenti (device only). Estrai testo: synthetic sheet → local OCR text.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-scan-hub'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], { stdio: 'ignore' });
let browser;
const immagine = (page, testo, w, h) => page.evaluate(async ([testo, w, h]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, w, h);
  const m = Math.round(Math.min(w, h) * 0.12);
  g.fillStyle = '#f4f4f4'; g.fillRect(m, m, w - 2 * m, h - 2 * m);
  g.fillStyle = '#111'; g.font = `bold ${Math.round(w / 22)}px sans-serif`;
  testo.split('\n').forEach((r, i) => g.fillText(r, m + 30, m + 70 + i * Math.round(h / 10)));
  const b = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer()));
}, [testo, w, h]);
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5178')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:5178/tests/visual/personal-scan.html');
  await page.getByText('Inizia la tua prima scansione').waitFor();
  for (const n of ['Estrai testo', 'Firma PDF', 'Comprimi PDF', 'Da album', 'Da file']) await page.getByRole('button', { name: n }).first().waitFor();
  assert.equal(await page.locator('.scan-griglia .scan-strumento').count(), 8);
  assert.ok(await page.getByRole('button', { name: 'Scatta e scansiona' }).isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'no horizontal overflow on Home');
  await page.screenshot({ path: `${out}/1-home.png` });

  // Carta d'identità: front + back → one A4 page.
  await page.locator('.scan-hero-tessera').click();
  await page.locator('.pp-pagina-titolo', { hasText: "Carta d'identità" }).waitFor();
  await page.screenshot({ path: `${out}/2-tessera-vuota.png` });
  const fronte = await immagine(page, 'CARTA DI PROVA\nCOGNOME ROSSI\nNOME MARIO', 900, 600);
  const retro = await immagine(page, 'RETRO DI PROVA\nCODICE FITTIZIO', 900, 600);
  await page.locator('section[aria-label="Fronte"] input[type=file]').nth(1).setInputFiles({ name: 'fronte.png', mimeType: 'image/png', buffer: Buffer.from(fronte) });
  await page.locator('section[aria-label="Fronte"] img').waitFor();
  await page.locator('section[aria-label="Retro"] input[type=file]').nth(1).setInputFiles({ name: 'retro.png', mimeType: 'image/png', buffer: Buffer.from(retro) });
  await page.locator('section[aria-label="Retro"] img').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Scarica PDF/.test(b.textContent) && !b.disabled));
  assert.equal(await page.locator('.scan-foglio img').count(), 2, 'both faces on the A4 preview');
  assert.ok(await page.locator('.pp-scan-auto').count() >= 1, 'card straightened automatically');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'no horizontal overflow on Carta');
  await page.screenshot({ path: `${out}/3-tessera-pronta.png`, fullPage: true });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Scarica PDF' }).click()]);
  assert.match(download.suggestedFilename(), /^Carta d identit.*\.pdf$/);
  await page.locator('.pp-pagina-barra button').first().click();
  await page.locator('.scan-recente').first().waitFor();
  assert.match(await page.locator('.scan-recente').first().textContent(), /Carta d identit/);
  await page.screenshot({ path: `${out}/4-home-recenti.png` });
  // Recent PDF opens in the PDF manager.
  await page.locator('.scan-recente-apri').first().click();
  await page.locator('.pdf-manager').waitFor();
  await page.locator('.pdf-header button', { hasText: 'Chiudi' }).click();
  await page.locator('.pdf-manager').waitFor({ state: 'detached' });

  // Estrai testo: synthetic sheet → local OCR.
  await page.getByRole('button', { name: 'Estrai testo' }).click();
  await page.locator('.pp-pagina-titolo', { hasText: 'Estrai testo' }).waitFor();
  const foglio = await immagine(page, 'REFERTO DI PROVA\nPAZIENTE FITTIZIO\nTUTTO NELLA NORMA', 1000, 1300);
  await page.locator('.scan-testo input[type=file]').nth(1).setInputFiles({ name: 'referto.png', mimeType: 'image/png', buffer: Buffer.from(foglio) });
  await page.locator('.scan-testo-area').waitFor({ timeout: 120000 });
  const testo = await page.locator('.scan-testo-area').inputValue();
  assert.match(testo, /REFERTO/); assert.match(testo, /NORMA/);
  await page.screenshot({ path: `${out}/5-testo.png` });
  assert.deepEqual(errors, []);
  console.log('scan-hub PASS ·', JSON.stringify(testo.slice(0, 80)));
} finally { await browser?.close(); server.kill(); }
