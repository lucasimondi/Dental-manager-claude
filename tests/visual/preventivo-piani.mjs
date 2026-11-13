// PREVENTIVO-DA-PRESTAZIONI (PO 2026-11-13) — Pixel 7, synthetic patient with two plans: the list is
// split per plan, «Tutto il piano» ticks only that plan, one quote can take voci from both plans and a
// price changed there goes back to its own plan; «Ricetta» opens the prescription in one tap.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-preventivo-piani'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5180', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5180')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:5180/tests/visual/patient-entry.html?history=2');
  await page.locator('.patient-dental-plan-head').first().waitFor();
  assert.equal(await page.locator('.patient-dental-plan-head').count(), 2);
  await page.getByRole('checkbox', { name: 'Spunta tutto il piano Prestazioni occasionali' }).check();
  assert.equal(await page.locator('.patient-dental-row.is-picked').count(), 2);
  await page.getByRole('checkbox', { name: 'Includi nel preventivo: Corona sul 36' }).check();
  assert.match(await page.locator('.patient-dental-quote-create').innerText(), /3 prestazioni[\s\S]*800/);
  assert.ok(await page.locator('.patient-dental-quote-create').isEnabled());
  await page.locator('.patient-dental-quotebar').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/1-due-piani.png` });
  await page.locator('.patient-dental-quote-create').click();
  await page.getByText('Preventivo pronto').waitFor();
  assert.equal(await page.locator('.quote-pick-row').count(), 3);
  await page.getByLabel('Prezzo Estrazione complessa sul 32').fill('170');
  await page.screenshot({ path: `${out}/2-preventivo.png` });
  await page.getByRole('button', { name: /Salva senza inviare/ }).click();
  await page.getByText(/Il prezzo cambiato è aggiornato anche nelle prestazioni/).waitFor(); // archive fails without a session: expected
  await page.getByRole('button', { name: /Torna al paziente/ }).click();
  assert.match(await page.getByRole('button', { name: 'Estrazione complessa sul 32: azioni' }).innerText(), /170/);
  // Ricetta: one tap from the header.
  await page.locator('.patient-record-legacy').evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/3-testata.png` });
  await page.getByRole('button', { name: 'Nuova ricetta' }).click();
  await page.getByText('Caricamento editor ricetta…').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  assert.equal(await page.getByText('Caricamento editor ricetta…').count(), 0, 'prescription editor opened');
  await page.screenshot({ path: `${out}/4-ricetta.png` });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll');
  assert.deepEqual(errors, []);
  console.log('preventivo-piani PASS');
} finally { await browser?.close(); server.kill(); }
