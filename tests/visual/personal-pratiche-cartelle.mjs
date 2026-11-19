// PRATICHE-CARTELLE — Pixel 7 light/dark, synthetic data: cases as folders «Pratica …» with up to 4 previews,
// filters Da gestire / Tutte / Chiuse, tap opens the case; Home search lists matching cases first.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-pratiche-cartelle'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5188', '--strictPort'], { stdio: 'ignore' });
const PRATICHE = [
  { id: 'p1', titolo: 'Mondino – esecuzione di prova', fascicolo: 'legale', stato: 'in_corso', n_documenti: 98 },
  { id: 'p2', titolo: 'Alfa Prova srl', fascicolo: 'legale', stato: 'aperta', n_documenti: 3 },
  { id: 'p3', titolo: 'Vecchia pratica di prova', fascicolo: 'casa', stato: 'risolta', n_documenti: 2 },
];
const DOCS = ['a', 'b', 'c', 'd', 'e'].map((x, i) => ({ id: `d${x}`, pratica_id: i < 4 ? 'p1' : 'p2', titolo: `Doc ${x}`, fascicolo: 'legale', drive_file_id: null, mime_type: 'application/pdf' }));
const PASSI = [{ pratica_id: 'p1', scadenza: '2026-11-24', priorita: 'alta' }, { pratica_id: 'p1', scadenza: '2026-11-30', priorita: 'media' }];
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5188')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const schema of ['light', 'dark']) {
    const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: schema }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        if (u.pathname.endsWith('/v_pratiche')) { const t = (u.searchParams.get('titolo') || '').replace(/^ilike\.|%/g, '').toLowerCase(); return route.fulfill({ json: PRATICHE.filter((p) => !t || p.titolo.toLowerCase().includes(t)) }); }
        if (u.pathname.endsWith('/documenti')) return route.fulfill({ json: DOCS });
        if (u.pathname.endsWith('/promemoria_azioni')) return route.fulfill({ json: u.searchParams.get('select')?.startsWith('pratica_id') ? PASSI : [] });
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5188/tests/visual/personal-pratiche-cartelle.html');
    await page.locator('.pp-cartella-pratica').first().waitFor();
    assert.deepEqual(await page.locator('.pp-cartella-pratica-nome').allInnerTexts(), ['Pratica Mondino – esecuzione di prova'], 'Da gestire: only cases with open steps');
    assert.equal(await page.locator('.pp-cartella-pratica').first().locator('.pp-cartella-pratica-casella').count(), 4);
    assert.match(await page.locator('.pp-cartella-pratica-meta').first().innerText(), /2 passi · 24 nov/);
    await page.screenshot({ path: `${out}/da-gestire-${schema}.png`, fullPage: true });
    await page.getByRole('tab', { name: /^Tutte/ }).click();
    assert.deepEqual(await page.locator('.pp-cartella-pratica-nome').allInnerTexts(), ['Pratica Alfa Prova srl', 'Pratica Mondino – esecuzione di prova']);
    await page.getByRole('tab', { name: /^Chiuse/ }).click();
    assert.deepEqual(await page.locator('.pp-cartella-pratica-nome').allInnerTexts(), ['Pratica Vecchia pratica di prova']);
    await page.getByRole('tab', { name: /^Tutte/ }).click();
    await page.locator('.pp-cartella-pratica', { hasText: 'Mondino' }).click();
    assert.deepEqual(await page.evaluate(() => window.cartelleTest.aperti.at(-1)), { tipo: 'pratica', id: 'p1' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll');
    // Home search.
    await page.goto('http://127.0.0.1:5188/tests/visual/personal-pratiche-cartelle.html?vista=home');
    await page.getByLabel('Cerca nelle tue cose').fill('mondino');
    await page.locator('.pps-trovate-pratiche .pp-cartella-pratica').first().waitFor();
    assert.match(await page.locator('.pps-trovate-pratiche').innerText(), /Pratiche[\s\S]*Pratica Mondino/);
    await page.screenshot({ path: `${out}/home-ricerca-${schema}.png`, fullPage: true });
    await page.locator('.pps-trovate-pratiche .pp-cartella-pratica').first().click();
    assert.deepEqual(await page.evaluate(() => window.cartelleTest.aperti.at(-1)), { tipo: 'pratica', id: 'p1' });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('personal-pratiche-cartelle PASS Pixel 7 light/dark: folders «Pratica …» with 4 previews, Da gestire/Tutte/Chiuse, open case, Home search finds cases first.');
} finally { await browser?.close(); server.kill(); }
