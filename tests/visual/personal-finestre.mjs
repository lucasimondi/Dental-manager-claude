// PERSONAL-FINESTRE (PO 2026-11-24) — desktop a finestre stile Windows, dati sintetici, rete finta.
// Telefono 390×844 (tocchi reali) e computer 1280×800 (mouse): più finestre, icone nella barra
// (tocco = avanti, di nuovo = riduci), Home / Mostra desktop, Ripristina e Ingrandisci, spostare e
// ridimensionare, Esplora come «Scegli da Poliedron» per lo Scan, trascinare un documento da Esplora
// alla finestra dello Scan. Screenshot in tests/visual/results-personal-finestre/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { avvia } from './esplora-dati.mjs';

const out = 'tests/visual/results-personal-finestre'; await mkdir(out, { recursive: true });
const PORTA = 5186;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore' });
const centro = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const finestra = (page, nome) => page.locator(`.pf-finestra[aria-label^="${nome}"]`);
const largo = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  /* ---------- telefono ---------- */
  {
    const T = await avvia(browser, { width: 390, height: 844, touch: true, scala: 2, porta: PORTA, url: 'personal-dock.html', attendi: 'nav.pb-barra',
      prepara: (S) => { S.extra = async (route, { p }) => (p.includes('/auth/') ? route.fulfill({ json: {} }) : undefined); } });
    const { page, cdp } = T;
    const tocca = async (loc) => { const p = await centro(loc); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(250); };
    const barra = page.locator('nav.pb-barra');
    await tocca(barra.getByRole('button', { name: /^Esplora file/ }));
    const esp = finestra(page, 'Esplora file'); await esp.locator('.esp-contenuto').waitFor();
    assert.ok(await esp.evaluate((e) => e.classList.contains('pf-ingrandita')), 'sul telefono si apre ingrandita');
    const fb = await esp.boundingBox(), bb = await barra.boundingBox();
    assert.ok(Math.abs(fb.y + fb.height - bb.y) < 1.5, 'la finestra arriva alla barra, la barra resta visibile');
    for (const n of ['Riduci a icona', 'Ripristina', 'Chiudi']) assert.ok(await esp.locator('.pf-titolo').getByRole('button', { name: new RegExp(`^${n}`) }).isVisible(), n);
    await page.screenshot({ path: `${out}/tel-1-esplora.png` });
    // Scan dallo Start: seconda finestra con la sua icona nella barra
    await tocca(barra.getByRole('button', { name: 'Start' }));
    await page.getByRole('dialog', { name: 'Start' }).locator('.pb-app[aria-label^="Scan"]').click();
    const scan = finestra(page, 'Scan'); await scan.locator('.scan-home').waitFor();
    assert.equal(await page.locator('.pb-finestre .pb-finestra[aria-label^="Scan"]').count(), 1, 'icona dello Scan nella barra');
    assert.equal(await page.locator('.pb-finestre .pb-finestra[aria-label^="Esplora"]').count(), 0, 'Esplora usa la sua icona fissata (niente doppioni)');
    assert.ok(!(await largo(page)), 'nessuno sforamento');
    await page.screenshot({ path: `${out}/tel-2-scan.png` });
    // tocco su Esplora: avanti; di nuovo: ridotta
    await tocca(barra.getByRole('button', { name: /^Esplora file/ }));
    assert.ok(await esp.evaluate((e) => e.classList.contains('pf-attiva') && !e.hidden));
    await tocca(barra.getByRole('button', { name: /^Esplora file/ }));
    assert.ok(await esp.evaluate((e) => e.hidden), 'secondo tocco = riduci a icona');
    // Home: riduce tutto, si vede la Home; la finestra resta nella barra
    await tocca(page.locator('.pb-home'));
    assert.ok(await scan.evaluate((e) => e.hidden), 'Home riduce lo Scan');
    assert.ok(await page.locator('.pp-app > .pp-contenuto').first().isVisible());
    await page.screenshot({ path: `${out}/tel-3-home.png` });
    await tocca(page.locator('.pb-finestre .pb-finestra[aria-label^="Scan"]'));
    assert.ok(await scan.isVisible(), 'dalla barra lo Scan torna');
    // Ripristina sul telefono: finestra libera (a scelta), poi di nuovo ingrandita
    await tocca(scan.locator('.pf-titolo').getByRole('button', { name: /^Ripristina/ }));
    assert.ok(await scan.evaluate((e) => e.classList.contains('pf-normale')));
    await page.screenshot({ path: `${out}/tel-4-libera.png` });
    await tocca(scan.locator('.pf-titolo').getByRole('button', { name: /^Ingrandisci/ }));
    // «Poliedron» nello Scan: Esplora file come finestra di scelta → Aggiungi → lo scanner riceve il documento
    await tocca(scan.locator('.scan-sorgenti').getByRole('button', { name: 'Poliedron' }));
    const scegli = finestra(page, 'Scegli da Poliedron'); await scegli.locator('.esp-scegli').waitFor();
    await scegli.locator('.esp-contenuto').waitFor();
    await page.screenshot({ path: `${out}/tel-5-scegli.png` });
    // seleziona «Polizza auto» (sulla scrivania): pressione prolungata, poi chiudi il menu
    const tile = scegli.locator('.esp-contenuto [data-elemento][aria-label="Polizza auto"]');
    const p = await centro(tile);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await page.waitForTimeout(650); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(400);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await scegli.locator('.esp-scegli-ok').waitFor({ state: 'visible' });
    assert.ok(await scegli.locator('.esp-scegli-ok').isEnabled(), 'Aggiungi attivo con un documento scelto');
    await tocca(scegli.locator('.esp-scegli-ok'));
    await scegli.waitFor({ state: 'detached' });
    await scan.locator('.pp-scansione-pagina').first().waitFor({ timeout: 15000 });
    assert.equal(await scan.locator('.pp-scansione-pagina').count(), 1, 'il documento scelto è nello scanner');
    await page.screenshot({ path: `${out}/tel-6-ricevuto.png` });
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }

  /* ---------- computer ---------- */
  {
    const T = await avvia(browser, { width: 1280, height: 800, touch: false, porta: PORTA, url: 'personal-dock.html', attendi: 'nav.pb-barra',
      prepara: (S) => { S.extra = async (route, { p }) => (p.includes('/auth/') ? route.fulfill({ json: {} }) : undefined); } });
    const { page } = T;
    const barra = page.locator('nav.pb-barra');
    await barra.getByRole('button', { name: /^Esplora file/ }).click();
    const esp = finestra(page, 'Esplora file'); await esp.locator('.esp-contenuto').waitFor();
    assert.ok(await esp.evaluate((e) => e.classList.contains('pf-normale')), 'sul computer libera');
    await barra.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('dialog', { name: 'Start' }).locator('.pb-app[aria-label^="Scan"]').click();
    const scan = finestra(page, 'Scan'); await scan.locator('.scan-home').waitFor();
    // trascina le finestre affiancate dalla barra del titolo e ridimensiona
    // afferra la barra del titolo accanto all'icona e porta l'angolo della finestra in (x, y)
    const porta = async (fin, x, y) => { const b = await fin.boundingBox(); await page.mouse.move(b.x + 60, b.y + 20); await page.mouse.down(); await page.mouse.move(x + 60, y + 20, { steps: 8 }); await page.mouse.up(); };
    await porta(scan, 470, 10); await porta(esp, 10, 10);
    const e1 = await esp.boundingBox(), s1 = await scan.boundingBox();
    assert.ok(Math.abs(e1.x - 10) < 2 && Math.abs(s1.x - 470) < 2 && Math.abs(e1.y - 10) < 2, `finestre spostate (${e1.x},${e1.y} · ${s1.x})`);
    const angolo = await scan.locator('.pf-bordo-se').boundingBox();
    await page.mouse.move(angolo.x + 10, angolo.y + 10); await page.mouse.down(); await page.mouse.move(angolo.x - 60, angolo.y + 40, { steps: 6 }); await page.mouse.up();
    const s2 = await scan.boundingBox(); assert.ok(Math.abs(s2.width - (s1.width - 70)) < 4, `ridimensionata (${s1.width} → ${s2.width})`);
    await page.screenshot({ path: `${out}/pc-1-affiancate.png` });
    // trascina «Polizza auto» da Esplora alla finestra dello Scan (Scan spostato a destra per lasciarlo vedere)
    await porta(scan, 780, 60);
    const tile = esp.locator('.esp-contenuto [data-elemento][aria-label="Polizza auto"]');
    const da = await centro(tile), a = await centro(scan.locator('.scan-home'));
    await page.mouse.move(da.x, da.y); await page.mouse.down(); await page.mouse.move(da.x + 12, da.y + 6, { steps: 3 });
    await page.mouse.move(a.x, a.y, { steps: 14 }); await page.waitForTimeout(150);
    assert.ok(await scan.locator('.pf-corpo').evaluate((e) => e.classList.contains('pb-sopra')), 'la finestra dello Scan si accende sotto il documento');
    await page.screenshot({ path: `${out}/pc-2-trascina.png` });
    await page.mouse.up();
    await scan.locator('.pp-scansione-pagina').first().waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${out}/pc-3-ricevuto.png` });
    // doppio clic sul titolo = ingrandisci; Chiudi Esplora toglie la sua finestra
    await scan.locator('.pf-nome').dblclick();
    assert.ok(await scan.evaluate((e) => e.classList.contains('pf-ingrandita')));
    await barra.getByRole('button', { name: /^Esplora file/ }).click(); // dalla barra torna avanti
    await esp.locator('.pf-titolo').getByRole('button', { name: /^Chiudi/ }).click();
    await esp.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Mostra desktop' }).click();
    assert.ok(await scan.evaluate((e) => e.hidden), 'Mostra desktop riduce tutto');
    await page.getByRole('button', { name: 'Mostra desktop' }).click();
    assert.ok(await scan.isVisible(), 'di nuovo Mostra desktop rimette com\'era');
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }
  console.log('personal-finestre PASS (telefono e computer)');
} finally { await browser?.close(); server.kill(); }
