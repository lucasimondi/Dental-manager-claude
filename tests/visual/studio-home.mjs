// HOME-STUDIO: synthetic data only. Studio Home on Pixel 7 and iPhone SE, light and dark.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-studio-home'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5183', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5183')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [nome, dev] of [['pixel7', devices['Pixel 7']], ['iphonese', devices['iPhone SE']]]) for (const tema of ['light', 'dark']) {
    const context = await browser.newContext({ ...dev, deviceScaleFactor: 1 }); const page = await context.newPage(); const errors = []; const scritture = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.hostname === '127.0.0.1') return route.continue(); if (route.request().method() !== 'GET') scritture.push(u.pathname); return route.fulfill({ json: [] }); });
    await page.goto(`http://127.0.0.1:5183/tests/visual/studio-home.html?tema=${tema}`);
    await page.getByRole('heading', { name: 'Studio', exact: true }).waitFor();
    await page.screenshot({ path: `${out}/${nome}-${tema}.png`, fullPage: true });
    assert.match(await page.locator('.sh-eroe').innerText(), /2 appuntamenti[\s\S]*1 da confermare[\s\S]*23:58/);
    const azioni = await page.locator('.sh-azione').allInnerTexts();
    assert.deepEqual(azioni.map((s) => s.trim()), ['Appuntamento', 'Paziente', 'Ricetta', 'Preventivo', 'Incasso', 'Spesa']);
    assert.match(await page.locator('.sh-seguire').innerText(), /2 richiami scaduti[\s\S]*1 richiamo in scadenza oggi[\s\S]*1 appuntamento da confermare/);
    assert.equal(await page.locator('.sh-cifra').count(), 0, 'senza permesso nessuna cifra');
    const tessere = await page.locator('.sh-griglia .sh-tessera').allInnerTexts();
    assert.deepEqual(tessere.map((s) => s.trim()), ['Piani', 'Preventivi', 'Richiami', 'Attività', 'Spese', 'Controllo', 'Listino', 'WhatsApp']);
    const strabordano = await page.locator('.sh-azione').evaluateAll((b) => b.filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent));
    assert.deepEqual(strabordano, [], 'testo delle azioni fuori dal tasto');
    const largo = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(largo <= 0, `scroll orizzontale ${largo}px`);
    await page.getByRole('button', { name: 'Ricetta', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Crea' }).count(), 0);
    await page.locator('.sh-azione', { hasText: 'Spesa' }).click();
    await page.locator('.sh-acquisisci').click();
    await page.getByLabel('Cerca pazienti e sezioni').fill('uno');
    await page.getByRole('button', { name: /Prova Uno/ }).click();
    await page.getByLabel('Cerca pazienti e sezioni').fill('listino');
    await page.locator('.sh-trovati').getByRole('button', { name: /Listino/ }).click();
    const stato = await page.evaluate(() => window.studioTest);
    assert.deepEqual(stato.azioni, ['ricetta', 'spesa', 'acquisisci']);
    assert.deepEqual(stato.vai, ['paziente-1', 'listino']);
    assert.deepEqual(scritture, []); assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${nome} ${tema}`);
  }
} finally { await browser?.close(); server.kill(); }
