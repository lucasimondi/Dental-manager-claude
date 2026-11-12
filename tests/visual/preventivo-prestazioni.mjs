// PREVENTIVO-DA-PRESTAZIONI — Pixel 7, synthetic patient (tests/visual/patient-entry fixture, no account,
// no network writes): section windows on top; tick prestazioni one by one or «Tutte»; «Crea preventivo»
// opens the quote with the ticked voci; a price changed there goes back to the plan voce; «Modifica»
// changes a voce in place; a window tap opens its section.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-preventivo-prestazioni'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5179')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:5179/tests/visual/patient-entry.html?history=1');
  await page.locator('.patient-record-windows').waitFor();
  assert.ok(await page.locator('.patient-record-windows button').count() >= 9);
  assert.equal(await page.locator('.patient-record-nav-mobile').count(), 0);
  await page.screenshot({ path: `${out}/1-scheda.png` });
  // Ticks are independent: one tick selects one row.
  await page.getByRole('checkbox', { name: 'Includi nel preventivo: Corona sul 36' }).check();
  assert.equal(await page.locator('.patient-dental-row.is-picked').count(), 1);
  assert.match(await page.locator('.patient-dental-quote-create').innerText(), /1 prestazione[\s\S]*500/);
  await page.locator('.patient-dental-pickall input').check();
  assert.equal(await page.locator('.patient-dental-row.is-picked').count(), 5);
  await page.locator('.patient-dental-pickall input').uncheck();
  assert.equal(await page.locator('.patient-dental-row.is-picked').count(), 0);
  // «Modifica» in place.
  await page.getByRole('button', { name: 'Modifica prestazione: Corona sul 36' }).click();
  await page.locator('.patient-dental-edit input[type=number]').fill('550');
  await page.locator('.patient-dental-edit-save').click();
  assert.equal(await page.locator('.patient-dental-row').first().locator('.patient-dental-price').innerText(), '€ 550.00');
  // Quote from two ticked voci, one price changed in the quote.
  await page.getByRole('checkbox', { name: 'Includi nel preventivo: Corona sul 36' }).check();
  await page.getByRole('checkbox', { name: 'Includi nel preventivo: Otturazione estetica sul 46' }).check();
  await page.locator('.patient-dental-quotebar').screenshot({ path: `${out}/2-barra-preventivo.png` });
  await page.locator('.patient-dental-quote-create').click();
  await page.getByText('Preventivo pronto').waitFor();
  assert.equal(await page.locator('.quote-pick-row').count(), 2);
  await page.getByLabel('Prezzo Otturazione estetica sul 46').fill('120');
  await page.screenshot({ path: `${out}/3-preventivo.png` });
  await page.getByRole('button', { name: /Salva senza inviare/ }).click();
  await page.getByText(/Il prezzo cambiato è aggiornato anche nelle prestazioni/).waitFor(); // archive fails without a session: expected
  await page.getByRole('button', { name: /Torna al paziente/ }).click();
  assert.deepEqual(await page.locator('.patient-dental-row .patient-dental-price').allInnerTexts(), ['€ 550.00', '€ 120.00', '€ 100.00', '€ 85.00', '€ 100.00']);
  // A window opens its section.
  await page.locator('.patient-record-windows button', { hasText: 'Pagamenti' }).click();
  await page.getByText('Situazione finanziaria').waitFor();
  await page.screenshot({ path: `${out}/4-pagamenti.png` });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll');
  assert.deepEqual(errors, []);
  console.log('preventivo-prestazioni PASS');
} finally { await browser?.close(); server.kill(); }
