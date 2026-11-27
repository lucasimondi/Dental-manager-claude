// STUDIO-TELEFONO: synthetic data only (same fixture as studio-home). The new Studio Home on Pixel 7 and iPhone SE,
// light and dark: wallpaper Home with search, quick actions, today's agenda with Chiama, avvisi, «Aggiunte» with colour
// icons and «Tutte le app» (asks Start to open); search «uno» finds the patient (Chiama, Nuovo appuntamento), his
// next appointment, and «listino» the section; «Crea» sheet; no writes; no side scroll.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-studio-home-telefono'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5192', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5192')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [nome, dev] of [['pixel7', devices['Pixel 7']], ['iphonese', devices['iPhone SE']]]) for (const tema of ['light', 'dark']) {
    const context = await browser.newContext({ ...dev, colorScheme: tema }); const page = await context.newPage(); const errors = []; const scritture = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.hostname === '127.0.0.1') return route.continue(); if (route.request().method() !== 'GET') scritture.push(u.pathname); return route.fulfill({ json: [] }); });
    await page.goto(`http://127.0.0.1:5192/tests/visual/studio-home.html?tema=${tema}`);
    await page.evaluate(() => { window.startAperto = 0; window.addEventListener('studio:apri-start', () => { window.startAperto += 1; }); });
    await page.getByRole('searchbox', { name: 'Cerca nello Studio' }).waitFor();
    assert.equal(await page.locator('.sh').count(), 0, `${nome}: non la Home del computer`);
    // NAVIGAZIONE N4: interruttore Studio | Personale in cima.
    assert.equal(await page.getByRole('button', { name: 'Studio, sei qui' }).getAttribute('aria-pressed'), 'true');
    const rapide = await page.locator('.stt-rapida').evaluateAll((b) => b.map((x) => x.getAttribute('aria-label')));
    assert.deepEqual(rapide, ['Nuovo appuntamento', 'Nuovo paziente', 'Nuova ricetta', 'Nuovo preventivo', 'Nuovo incasso']);
    assert.match(await page.locator('.stt-oggi').innerText(), /Oggi · 2 appuntamenti[\s\S]*23:58[\s\S]*Esempio D\.[\s\S]*Da confermare/);
    assert.match(await page.locator('.stt-avvisi').innerText(), /2[\s\S]*Richiami scaduti[\s\S]*1[\s\S]*Richiami di oggi[\s\S]*1[\s\S]*Da confermare/);
    const app = await page.locator('.stt-griglia .stt-app').allInnerTexts();
    assert.deepEqual(app.map((s) => s.trim()), ['Agenda', 'Pazienti', 'Incassi', 'Piani', 'Preventivi', 'Richiami', 'Attività', 'Spese', 'Controllo', 'Listino', 'WhatsApp', 'Tutte le app']);
    assert.equal(await page.locator('.stt-griglia svg.st-icona-colore').count(), 11, `${nome}: icone a colori`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: niente scorrimento di lato`);
    const fuori = await page.locator('.stt-rapida, .stt-app').evaluateAll((b) => b.filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent));
    assert.deepEqual(fuori, [], `${nome}: testo fuori dai tasti`);
    await page.screenshot({ path: `${out}/${nome}-${tema}-home.png`, fullPage: true });

    await page.getByRole('button', { name: 'Tutte le app ›' }).click();
    assert.equal(await page.evaluate(() => window.startAperto), 1, `${nome}: «Tutte le app» apre Start`);
    await page.getByRole('button', { name: 'Nuova ricetta' }).click();
    await page.getByRole('button', { name: 'Crea' }).click();
    await page.getByRole('dialog', { name: 'Crea' }).waitFor();
    await page.screenshot({ path: `${out}/${nome}-${tema}-crea.png` });
    await page.getByRole('dialog', { name: 'Crea' }).getByRole('button', { name: 'Documento' }).click();
    await page.locator('.stt-app', { hasText: 'Listino' }).click();

    await page.getByRole('searchbox', { name: 'Cerca nello Studio' }).fill('uno');
    await page.locator('.stt-riga', { hasText: 'Prova Uno' }).first().waitFor();
    assert.equal(await page.getByRole('link', { name: 'Chiama Prova Uno' }).getAttribute('href'), 'tel:000');
    assert.match(await page.locator('.stt-risultati').innerText(), /Appuntamenti[\s\S]*Prova Uno/i);
    await page.screenshot({ path: `${out}/${nome}-${tema}-cerca.png` });
    await page.getByRole('button', { name: 'Nuovo appuntamento per Prova Uno' }).click();
    await page.locator('.stt-riga-apri', { hasText: 'Prova Uno' }).first().click();
    await page.getByRole('searchbox', { name: 'Cerca nello Studio' }).fill('listino');
    await page.locator('.stt-risultati').getByRole('button', { name: /Listino/ }).click();
    await page.getByRole('button', { name: 'Cancella la ricerca' }).click();
    await page.getByRole('button', { name: 'Impostazioni' }).click();
    await page.getByRole('button', { name: 'Passa a Personale' }).click();

    const stato = await page.evaluate(() => window.studioTest);
    assert.deepEqual(stato.azioni, ['ricetta', 'acquisisci', 'appuntamento-1']);
    assert.deepEqual(stato.vai, ['listino', 'paziente-1', 'listino', 'set', 'perte']);
    assert.deepEqual(scritture, []); assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${nome} ${tema}`);
  }
  console.log('studio-home-telefono PASS');
} finally { await browser?.close(); server.kill(); }
