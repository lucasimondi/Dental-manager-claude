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
  assert.match(download.suggestedFilename(), /^Carta d.identit.*\.pdf$/);
  await page.locator('.pp-pagina-barra button').first().click();
  await page.locator('.scan-recente').first().waitFor();
  assert.match(await page.locator('.scan-recente').first().textContent(), /Carta d'identità/);
  await page.screenshot({ path: `${out}/4-home-recenti.png` });
  // SCAN-ORGANIZZA: a recent document opens its sheet (D): pages, star, category, tags, 10 actions.
  await page.locator('.scan-recente-apri').first().click();
  await page.locator('.scan-scheda-pagine img').first().waitFor();
  assert.match(await page.locator('.scan-scheda-chip').textContent(), /Carta d'identità/);
  await page.getByRole('button', { name: 'Aggiungi ai preferiti' }).click();
  await page.getByRole('button', { name: '+ scadenza' }).click();
  await page.getByLabel('Data di scadenza').fill(new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await page.locator('.scan-chip', { hasText: 'scade tra' }).waitFor();
  await page.getByRole('button', { name: '+ etichetta' }).click();
  await page.getByLabel('Etichetta', { exact: true }).fill('Mario');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await page.locator('.scan-chip', { hasText: '#mario' }).waitFor();
  assert.equal(await page.locator('.scan-scheda-azioni button').count(), 10);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/4b-scheda.png` });
  await page.locator('.pp-pagina:not([hidden]) .pp-pagina-barra button').first().click();

  // Estrai testo: synthetic sheet → local OCR.
  await page.getByRole('button', { name: 'Estrai testo' }).click();
  await page.locator('.pp-pagina-titolo', { hasText: 'Estrai testo' }).waitFor();
  const foglio = await immagine(page, 'REFERTO DI PROVA\nPAZIENTE FITTIZIO\nTUTTO NELLA NORMA', 1000, 1300);
  await page.locator('.scan-testo input[type=file]').nth(1).setInputFiles({ name: 'referto.png', mimeType: 'image/png', buffer: Buffer.from(foglio) });
  await page.locator('.scan-testo-area').waitFor({ timeout: 120000 });
  const testo = await page.locator('.scan-testo-area').inputValue();
  assert.match(testo, /REFERTO/); assert.match(testo, /NORMA/);
  await page.screenshot({ path: `${out}/5-testo.png` });
  await page.getByRole('button', { name: 'Salva come .txt' }).click();
  await page.locator('.pp-pagina-barra button').first().click();

  // SCAN-LIBRERIA: scanner → «Salva in I miei documenti» in a new folder.
  await page.getByRole('button', { name: /^Scanner/ }).click();
  await page.locator('.pp-pagina input[type=file]').nth(1).setInputFiles({ name: 'foglio.png', mimeType: 'image/png', buffer: Buffer.from(foglio) });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Salva in I miei documenti/.test(b.textContent) && !b.disabled));
  await page.getByRole('button', { name: 'Salva in I miei documenti' }).click();
  await page.getByLabel('Nuova cartella').fill('Salute');
  await page.getByRole('button', { name: 'Crea' }).click();
  await page.locator('.pp-toast', { hasText: 'Salute' }).waitFor();
  await page.locator('.pp-pagina-barra button').first().click();

  // Library: 3 documents, folders, search, rename, move, merge, delete.
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.scan-documenti .scan-recente').nth(2).waitFor();
  assert.equal(await page.locator('.scan-documenti .scan-recente').count(), 3);
  await page.waitForFunction(() => document.querySelectorAll('.scan-doc-mini').length >= 2, null, { timeout: 15000 });
  await page.screenshot({ path: `${out}/6-documenti.png` });
  // Cartelle: categories (B) with the deadline warning, then the user's folders.
  await page.getByRole('tab', { name: 'Cartelle' }).click();
  await page.locator('.scan-scadenze', { hasText: 'scade tra' }).waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/6b-cartelle.png`, fullPage: true });
  await page.locator('.scan-categoria', { hasText: "Carta d'identità" }).click();
  assert.equal(await page.locator('.scan-documenti .scan-recente').count(), 1);
  await page.getByRole('button', { name: '‹ Cartelle' }).click();
  await page.locator('.scan-voce-cartella', { hasText: 'Salute' }).click();
  assert.equal(await page.locator('.scan-documenti .scan-recente').count(), 1);
  await page.getByRole('tab', { name: 'Preferiti' }).click();
  assert.equal(await page.locator('.scan-documenti .scan-recente').count(), 1, 'one favourite');
  await page.getByRole('tab', { name: 'Recenti' }).click();
  await page.getByRole('button', { name: 'Vista a griglia' }).click();
  assert.equal(await page.locator('.scan-copertina').count(), 3);
  await page.screenshot({ path: `${out}/6c-griglia.png` });
  await page.getByRole('button', { name: 'Vista a elenco' }).click();
  await page.getByLabel('Cerca nei documenti').fill('carta identita');
  assert.equal(await page.locator('.scan-documenti .scan-recente').count(), 1);
  await page.getByLabel('Cerca nei documenti').fill('');
  await page.getByRole('button', { name: /Altre azioni per Carta d'identità/ }).click();
  await page.getByRole('button', { name: 'Rinomina' }).click();
  await page.getByLabel('Nuovo nome').fill('CI Mario');
  await page.getByRole('button', { name: 'Salva nome' }).click();
  await page.locator('.scan-documenti', { hasText: 'CI Mario' }).waitFor();
  await page.getByRole('button', { name: 'Seleziona', exact: true }).click();
  await page.getByLabel('Seleziona CI Mario.pdf').check();
  await page.locator('.scan-documenti input[type=checkbox]').nth(1).check();
  await page.screenshot({ path: `${out}/7-selezione.png` });
  await page.getByRole('button', { name: 'Unisci in PDF' }).click();
  await page.locator('.scan-documenti', { hasText: 'Unione' }).waitFor();
  assert.equal(await page.locator('.scan-documenti .scan-recente').count(), 4);
  await page.getByRole('button', { name: /Altre azioni per Unione/ }).click();
  await page.locator('.scan-recente-menu').getByRole('button', { name: /Elimina/ }).click();
  await page.locator('.scan-foglio-azioni').getByRole('button', { name: 'Elimina' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.scan-documenti .scan-recente').length === 3);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'no horizontal overflow in library');
  assert.deepEqual(errors, []);
  console.log('scan-hub PASS ·', JSON.stringify(testo.slice(0, 80)));
} finally { await browser?.close(); server.kill(); }
