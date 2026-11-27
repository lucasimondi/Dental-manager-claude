// AGENDA-TASTI: synthetic only. On the shared Agenda the Studio phone dock has only Personale · Poliedron · Studio
// (icons only, inside the screen, 44 px); tapping Studio goes to the Studio Home with the Studio bar (STUDIO-TELEFONO).
// Pixel 7 and iPhone SE, light and dark.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-studio-agenda-tasti'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5194', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5194')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [nome, dev] of [['pixel7', devices['Pixel 7']], ['iphonese', devices['iPhone SE']]]) for (const tema of ['light', 'dark']) {
    const context = await browser.newContext({ ...dev, colorScheme: tema }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ json: [] })));
    await page.goto(`http://127.0.0.1:5194/tests/visual/studio-agenda-tasti.html?tema=${tema}`);
    const barra = page.getByRole('navigation', { name: 'Navigazione principale' });
    await barra.waitFor();
    const voci = await page.locator('.poliedron-mobile-dock__item').evaluateAll((b) => b.map((x) => { const r = x.getBoundingClientRect(); return { t: x.getAttribute('aria-label'), testo: x.textContent.trim(), w: r.width, h: r.height }; }));
    assert.deepEqual(voci.map((v) => v.t), ['Personale', 'Studio'], `${nome}: sull'Agenda solo Personale e Studio`);
    for (const v of voci) assert.ok(v.w >= 44 && v.h >= 44, `${nome}: ${v.t} almeno 44 px`);
    assert.ok(voci.every((v) => v.testo === ''), `${nome}: solo icone, nessuna scritta`);
    const centri = await page.evaluate(() => { const m = (e) => { const r = e.getBoundingClientRect(); return (r.top + r.bottom) / 2; }; return { barra: m(document.querySelector('.poliedron-mobile-dock')), riquadri: [...document.querySelectorAll('.poliedron-mobile-dock__riquadro')].map(m) }; });
    for (const c of centri.riquadri) assert.ok(Math.abs(c - centri.barra) <= 1, `${nome}: icona centrata in verticale (${c} vs ${centri.barra})`);
    const fuori = await page.locator('.poliedron-mobile-dock__spazio').evaluateAll((b) => b.filter((x) => [...x.children].some((c) => { const r = c.getBoundingClientRect(), p = x.getBoundingClientRect(); return r.left < p.left - 1 || r.right > p.right + 1; })).map((x) => x.textContent));
    assert.deepEqual(fuori, [], `${nome}: icona e nome dentro il tasto`);
    assert.equal(await page.locator('[data-slot="poliedron"]').count(), 1, 'Poliedron al centro');
    const r = await page.locator('.poliedron-mobile-dock').boundingBox();
    assert.ok(r.x >= 0 && r.x + r.width <= page.viewportSize().width, `${nome}: barra dentro lo schermo`);
    await page.screenshot({ path: `${out}/${nome}-${tema}-agenda.png` });
    await barra.getByRole('button', { name: 'Studio' }).click();
    assert.deepEqual(await page.locator('.poliedron-mobile-dock__item').evaluateAll((b) => b.map((x) => x.getAttribute('aria-label'))), ['Agenda', 'Start', 'Pazienti', 'Documenti', 'Incassi', 'Studio'], `${nome}: fuori dall'Agenda la barra dello Studio`);
    await barra.getByRole('button', { name: 'Agenda' }).click();
    await barra.getByRole('button', { name: 'Personale' }).click();
    assert.deepEqual(await page.evaluate(() => window.studioTest.pagine), ['studio', 'agenda', 'perte']);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${nome} ${tema}`);
  }
  console.log('studio-agenda-tasti PASS');
} finally { await browser?.close(); server.kill(); }
