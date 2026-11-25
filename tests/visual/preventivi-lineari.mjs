// PREVENTIVI-LINEARI (PO 2026-11-25) — Pixel 7, synthetic data: the quote list says which quote is
// no longer valid; changing a quoted item asks first; adding the same cure twice asks first.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-preventivi-lineari'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5181')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const scheme of ['light', 'dark']) {
    const page = await (await browser.newContext({ ...devices['Pixel 7'], colorScheme: scheme })).newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:5181/tests/visual/preventivi-lineari.html');
    await page.locator('.quote-card').nth(2).waitFor();
    assert.equal(await page.locator('.quote-validity.is-stale').count(), 1);
    assert.equal(await page.locator('.quote-validity.is-valid').count(), 2);
    assert.match(await page.locator('.quote-validity.is-stale').innerText(), /Devitalizzazione sul 13: 80,00\s€ → 90,00\s€/);
    await page.screenshot({ path: `${out}/1-preventivi-${scheme}.png`, fullPage: true });
    if (scheme === 'dark') { assert.deepEqual(errors, []); continue; }

    await page.goto('http://127.0.0.1:5181/tests/visual/preventivi-lineari.html?view=piani');
    await page.getByRole('button', { name: /^Preventivo 25\/11/ }).click();
    await page.getByText('Devitalizzazione').waitFor();
    await page.getByRole('button', { name: /Modifica$/ }).nth(1).click();
    await page.locator('.plan-inline-editor input[type=number]').fill('95');
    await page.locator('.plan-inline-editor').getByRole('button', { name: 'Salva' }).click();
    const avviso = page.getByRole('alertdialog', { name: 'Prestazione già preventivata' });
    await avviso.waitFor();
    assert.match(await avviso.innerText(), /preventivo N° K1L2M3N4O5[\s\S]*non sarà più valido/);
    await avviso.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/2-avviso-modifica.png` });
    await avviso.getByRole('button', { name: 'Salva comunque' }).click();
    await page.getByText(/95\.00/).first().waitFor();

    await page.getByRole('button', { name: '+ Aggiungi prestazione' }).click();
    await page.locator('.plan-inline-editor input').nth(0).fill('Estrazione semplice');
    await page.locator('.plan-inline-editor input').nth(1).fill('44');
    await page.locator('.plan-inline-editor input').nth(2).fill('50');
    await page.locator('.plan-inline-editor').getByRole('button', { name: 'Aggiungi' }).click();
    await avviso.waitFor();
    assert.match(await avviso.innerText(), /Estrazione semplice sul 44: già in «Preventivo»/);
    await avviso.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/3-avviso-doppione.png` });
    await avviso.getByRole('button', { name: 'Annulla' }).click();
    assert.equal(await page.getByText('Estrazione semplice').count(), 0);
    assert.deepEqual(errors, []);
  }
  console.log('preventivi-lineari: PASS');
} finally { await browser?.close(); server.kill(); }
