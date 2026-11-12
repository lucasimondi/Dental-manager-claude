// ARCHIVIO-CHIEDI: synthetic data only. Empty state with «Da fare», a question with «Ho capito»,
// the best document on top, a «quanto ho speso» total, and the classic view one tap away.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-chiedi'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], { stdio: 'ignore' });
const doc = (id, titolo, data, importo, fascicolo = 'utenze') => ({ id, titolo, ente: 'Fornitore Prova', data_documento: data, email_data: `${data}T09:00:00Z`, importo, fascicolo, rilevanza: 'normale', drive_url: 'https://example.invalid/file', tag: [] });
const DOCS = [doc('d1', 'Bolletta luce — novembre', '2025-11-18', 168.4), doc('d2', 'Bolletta luce — settembre', '2025-09-20', 142.1), doc('d3', 'Bolletta luce — luglio', '2025-07-19', 121.55)];
const PELLET = [doc('p1', 'Fattura pellet — ottobre', '2026-10-23', 548, 'riscaldamento'), doc('p2', 'Fattura pellet — febbraio', '2026-02-11', 348, 'riscaldamento'), doc('p3', 'Fattura pellet — gennaio', '2026-01-09', 232, 'riscaldamento')];
const oggi = new Date(); const tra = (g) => { const d = new Date(oggi); d.setDate(d.getDate() + g); return d.toISOString().slice(0, 10); };
const SCAD = [{ id: 's1', data: tra(3), descrizione: 'Revisione auto', importo: null, documento_id: 'd9', completata: false, storica: false }, { id: 's2', data: tra(25), descrizione: 'IMU — saldo', importo: 412, documento_id: null, completata: false, storica: false }];
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5178')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage(); const errors = []; const rpc = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname.endsWith('supabase.co')) {
      if (u.pathname.endsWith('/rpc/cerca_archivio_v2')) {
        const body = JSON.parse(route.request().postData() || '{}'); rpc.push(body);
        return route.fulfill({ json: /pellet/.test(body.p_testo) ? PELLET : DOCS });
      }
      if (u.pathname.endsWith('/scadenze')) return route.fulfill({ json: SCAD });
      return route.fulfill({ json: [] });
    }
    return route.abort();
  });
  await page.goto('http://127.0.0.1:5178/tests/visual/personal-chiedi.html');
  await page.getByText('Cosa ti serve?').waitFor();
  await page.getByText('Revisione auto').waitFor();
  await page.screenshot({ path: `${out}/vuota.png` });
  assert.ok(await page.getByRole('button', { name: /carta d’identità di Giulia/ }).isVisible());

  await page.getByLabel("Chiedi all'archivio").fill('bollette luce 2025 sopra 100 €');
  await page.locator('.pp-chiedi-primo').waitFor();
  const chips = await page.locator('.pp-chiedi-chip').allTextContents();
  assert.deepEqual(chips, ['«bollette luce»', 'Importo oltre 100 €', 'Anno 2025']);
  assert.deepEqual(rpc.at(-1), { p_testo: 'bollette luce', p_filtri: { importo_min: 100, da: '2025-01-01', a: '2025-12-31', poco_utili: false }, p_lim: 200 });
  assert.match(await page.locator('.pp-chiedi-primo').textContent(), /Bolletta luce — novembre/);
  await page.screenshot({ path: `${out}/risposta.png` });
  await page.getByRole('button', { name: 'Apri', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.chiediTest.aperti.at(-1)), { tipo: 'documento', id: 'd1' });

  await page.getByLabel("Chiedi all'archivio").fill('quanto ho speso di pellet quest’anno?');
  await page.locator('.pp-chiedi-cifra').waitFor();
  assert.match(await page.locator('.pp-chiedi-cifra').textContent(), /1\.?128,00/);
  assert.equal(await page.locator('.pp-chiedi-barra').count(), 3);
  await page.screenshot({ path: `${out}/totale.png` });

  const larga = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(larga, false, 'nessuno scorrimento orizzontale');

  await page.getByLabel('Cancella').click();
  await page.getByRole('button', { name: /Vista classica/ }).click();
  await page.getByRole('button', { name: /Torna a «Chiedi»/ }).waitFor();
  await page.screenshot({ path: `${out}/classica.png` });
  await page.getByRole('button', { name: /Torna a «Chiedi»/ }).click();
  await page.getByText('Cosa ti serve?').waitFor();
  assert.deepEqual(errors, []);
  console.log('personal-chiedi PASS');
} finally { await browser?.close(); server.kill(); }
