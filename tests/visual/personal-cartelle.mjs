// CARTELLE-ELENCO-GESTIONE — Pixel 7, dati finti: Icone/Elenco anche nelle aree, selezione ed eliminazione
// di più cartelle (solo cartelle → PATCH ente=null), nuova cartella dai documenti senza cartella.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-cartelle'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5177', '--strictPort'], { stdio: 'ignore' });
const cartelle = [
  { ente: 'Enel Energia', n: 12, n_utili: 12, dal: '2024-01-02', al: '2026-10-01', fascicolo: 'utenze', etichette: [], n_promemoria: 0, n_da_fare: 0 },
  { ente: 'Acqua Spa', n: 4, n_utili: 4, dal: '2025-02-01', al: '2026-09-01', fascicolo: 'utenze', etichette: ['Da pagare'], n_promemoria: 1, n_da_fare: 0 },
  { ente: 'Banca Test', n: 7, n_utili: 7, dal: '2023-03-01', al: '2026-08-01', fascicolo: 'banca', etichette: [], stato: 'aperta', n_promemoria: 0, n_da_fare: 0 },
];
const senza = [
  { id: 'd1', titolo: 'Bolletta condominio – Test', fascicolo: 'casa', ente: null, email_data: '2026-10-02T10:00:00Z' },
  { id: 'd2', titolo: 'Verbale assemblea – Test', fascicolo: 'casa', ente: null, email_data: '2026-09-20T10:00:00Z' },
];
const patch = [];
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5177')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (!u.hostname.endsWith('supabase.co')) return route.abort();
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (route.request().method() === 'PATCH') { patch.push({ path: u.pathname, query: u.search, body: route.request().postDataJSON() }); return json([{ id: 'x' }, { id: 'y' }]); }
    if (u.pathname.endsWith('/v_cartelle')) return json(cartelle);
    if (u.pathname.endsWith('/documenti')) return json(senza);
    return json([]);
  });
  await page.goto('http://127.0.0.1:5177/tests/visual/personal-cartelle.html');
  await page.getByRole('button', { name: '▦ Icone' }).waitFor();
  await page.screenshot({ path: `${out}/aree-icone.png` });
  await page.getByRole('button', { name: '☰ Elenco' }).click();
  await page.locator('.pp-riga', { hasText: 'Acquisti e servizi' }).first().waitFor().catch(() => {});
  await page.screenshot({ path: `${out}/aree-elenco.png` });
  await page.locator('.pp-riga').first().click();
  await page.getByRole('button', { name: 'Seleziona' }).click();
  const prima = page.locator('.pp-riga', { hasText: /Enel Energia|Acqua Spa|Banca Test/ }).first();
  await prima.click();
  assert.equal(await page.evaluate(() => window.cartelleTest.aperte.length), 0, 'in selezione il tocco sceglie, non apre');
  await page.getByRole('button', { name: 'Elimina' }).click();
  await page.getByText(/Elimina anche i \d+ documenti/).waitFor();
  await page.screenshot({ path: `${out}/elimina-conferma.png` });
  await page.getByRole('button', { name: 'Elimina solo le cartelle' }).click();
  await page.waitForFunction(() => window.cartelleTest.messaggi.length > 0);
  const msg = await page.evaluate(() => window.cartelleTest.messaggi);
  assert.match(msg.at(-1), /cartella eliminata: i documenti sono in “Senza cartella”/, msg.join(' | '));
  assert.equal(patch.length, 1); assert.deepEqual(patch[0].body, { ente: null }); assert.match(patch[0].query, /fascicolo=neq\.clinico_pazienti/);
  await page.getByRole('button', { name: '▦ Icone' }).click();
  await page.getByRole('button', { name: 'Seleziona' }).click();
  await page.locator('.pp-cartella-ente').first().click();
  await page.screenshot({ path: `${out}/icone-selezione.png` });

  await page.goto('http://127.0.0.1:5177/tests/visual/personal-cartelle.html?vista=nuova');
  await page.getByLabel('Nome della cartella').fill('Condominio Test');
  await page.locator('.pp-riga', { hasText: 'Bolletta condominio' }).click();
  await page.locator('.pp-riga', { hasText: 'Verbale assemblea' }).click();
  await page.screenshot({ path: `${out}/nuova-cartella.png` });
  await page.getByRole('button', { name: 'Crea la cartella con 2 documenti' }).click();
  await page.waitForFunction(() => window.cartelleTest.sostituita);
  const p = await page.evaluate(() => window.cartelleTest.sostituita);
  assert.deepEqual(p, { tipo: 'cartella', ente: 'Condominio Test', titolo: 'Condominio Test' });
  const ultima = patch.at(-1); assert.deepEqual(ultima.body, { ente: 'Condominio Test' }); assert.match(decodeURIComponent(ultima.query), /id=in\.\(d1,d2\)/);
  assert.deepEqual(errors, []);
  console.log('personal-cartelle PASS');
} finally { await browser?.close(); server.kill(); }
