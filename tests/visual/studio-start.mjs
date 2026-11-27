// STUDIO-TELEFONO: synthetic only. Studio phone bar (Start · Agenda · Pazienti · Poliedron · Documenti · Studio ·
// Personale, colour icons, 44 px targets, inside the screen) and full-screen Start (groups, search, open an app,
// Escape closes). Pixel 7 and iPhone SE, light and dark; without the documents archive the slot is Incassi.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-studio-start'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5193', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5193')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [nome, dev] of [['pixel7', devices['Pixel 7']], ['iphonese', devices['iPhone SE']]]) for (const tema of ['light', 'dark']) {
    const context = await browser.newContext({ ...dev, colorScheme: tema }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ json: [] })));
    await page.goto(`http://127.0.0.1:5193/tests/visual/studio-start.html?tema=${tema}`);
    const barra = page.getByRole('navigation', { name: 'Navigazione principale' });
    await barra.waitFor();
    const g = await page.evaluate(() => {
      const nav = document.querySelector('.studio-barra').getBoundingClientRect();
      const voci = [...document.querySelectorAll('.studio-barra .poliedron-mobile-dock__item')].map((b) => { const r = b.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), w: r.width, h: r.height, colore: !!b.querySelector('svg.st-icona-colore') }; });
      return { left: nav.left, right: nav.right, vw: innerWidth, voci };
    });
    assert.deepEqual(g.voci.map((v) => v.label), ['Start', 'Agenda', 'Pazienti', 'Documenti', 'Studio', 'Personale']);
    assert.ok(g.left >= 0 && g.right <= g.vw, `${nome}: barra dentro lo schermo`);
    for (const v of g.voci) assert.ok(v.w >= 44 && v.h >= 44, `${nome}: ${v.label} almeno 44 px`);
    assert.ok(g.voci.slice(1).every((v) => v.colore), `${nome}: icone a colori`);
    assert.equal(await page.locator('[data-slot="poliedron"]').count(), 1);
    await page.screenshot({ path: `${out}/${nome}-${tema}-barra.png` });
    await barra.getByRole('button', { name: 'Pazienti' }).click();
    assert.equal(await barra.getByRole('button', { name: 'Pazienti' }).getAttribute('aria-current'), 'page');
    await barra.getByRole('button', { name: 'Start' }).click();
    const start = page.getByRole('dialog', { name: 'Start · Tutte le app' });
    await start.waitFor();
    for (const t of ['Lavoro', 'Gestione', 'Comunicazione e assistente', 'Personale', 'Sistema']) assert.ok(await start.getByRole('region', { name: t }).isVisible(), `${nome}: gruppo ${t}`);
    assert.equal(await start.getByRole('button', { name: 'Agente AI' }).count(), 0, 'solo le app che lo studio vede');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: niente scorrimento di lato`);
    await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${nome}-${tema}-start.png` });
    await start.getByLabel("Cerca un'app").fill('rich');
    assert.deepEqual((await start.locator('.sts-app').allInnerTexts()).map((s) => s.trim()), ['Richiami']);
    await start.getByRole('button', { name: 'Richiami' }).click();
    assert.equal(await start.count(), 0, 'Start si chiude aprendo un app');
    await barra.getByRole('button', { name: 'Start' }).click(); await start.waitFor();
    await page.keyboard.press('Escape'); assert.equal(await start.count(), 0, 'Esc chiude');
    await barra.getByRole('button', { name: 'Start' }).click(); await start.waitFor();
    await start.getByRole('button', { name: 'Impostazioni' }).click();
    assert.deepEqual(await page.evaluate(() => window.studioTest.pagine), ['paz', 'richiami', 'set']);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${nome} ${tema}`);
  }
  { const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage();
    await page.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ json: [] })));
    await page.goto('http://127.0.0.1:5193/tests/visual/studio-start.html?archivio=no');
    const labels = await page.locator('.studio-barra .poliedron-mobile-dock__item').evaluateAll((b) => b.map((x) => x.getAttribute('aria-label')));
    assert.deepEqual(labels, ['Start', 'Agenda', 'Pazienti', 'Incassi', 'Studio', 'Personale'], 'senza archivio: Incassi');
    await context.close(); }
  console.log('studio-start PASS');
} finally { await browser?.close(); server.kill(); }
