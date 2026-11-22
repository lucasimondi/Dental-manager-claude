// POL-VITA-ORDINA fase 2 — «Piano di riordino» su TELEFONO (375×812, chiaro e scuro), dati sintetici.
// Screenshot in docs/screenshots/pol-vita-ordina/: elenco per cartella, gruppo aperto con riga gialla, azioni.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = 'docs/screenshots/pol-vita-ordina'; await mkdir(out, { recursive: true });
const PORTA = 5186;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const colore of ['light', 'dark']) {
    const nome = colore === 'light' ? 'chiaro' : 'scuro';
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: colore });
    page.on('pageerror', (e) => { throw e; });
    await page.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
    await page.goto(`http://127.0.0.1:${PORTA}/tests/visual/personal-riordino.html`);
    await page.locator('.rr-gruppo').first().waitFor();
    const largo = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(await largo(), false, 'nessuno sforamento orizzontale');
    await page.screenshot({ path: `${out}/01-elenco-${nome}.jpg`, type: 'jpeg', quality: 80 });
    // gruppo Enel: la riga a 0,72 è gialla e viene prima
    await page.locator('.rr-testa', { hasText: '10 Utenze/Luce – Enel/2024' }).tap();
    const prima = page.locator('.rr-gruppo', { hasText: 'Enel' }).locator('.rr-riga').first();
    assert.match(await prima.getAttribute('class'), /rr-media/);
    await prima.locator('.rr-tocco').tap();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/02-riga-aperta-${nome}.jpg`, type: 'jpeg', quality: 80 });
    await prima.getByRole('button', { name: 'Rinomina' }).tap();
    await prima.locator('input').fill('2024-04-02_Bolletta_Enel_Aprile-Casa.pdf');
    await prima.getByRole('button', { name: 'Salva e approva' }).tap();
    await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(() => window.rrTest.update.at(-1)), [['r1'], { nome_nuovo: '2024-04-02_Bolletta_Enel_Aprile-Casa.pdf', stato: 'approvato' }]);
    // Approva tutto ≥ 0,85: conferma e poi i tre verdi sono approvati
    await page.getByRole('button', { name: /Approva tutto ≥ 0,85/ }).tap();
    await page.screenshot({ path: `${out}/03-approva-soglia-${nome}.jpg`, type: 'jpeg', quality: 80 });
    await page.locator('.pp-conferma').getByRole('button', { name: 'Approva' }).tap();
    await page.waitForTimeout(150);
    assert.deepEqual((await page.evaluate(() => window.rrTest.update.at(-1)))[0].sort(), ['r0', 'r2', 'r3']);
    await page.getByRole('tab', { name: 'Approvati' }).tap();
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${out}/04-approvati-${nome}.jpg`, type: 'jpeg', quality: 80 });
    assert.equal(await largo(), false);
    await page.close();
  }
  console.log('ok: piano di riordino su telefono');
} finally { await browser?.close(); server.kill(); }
