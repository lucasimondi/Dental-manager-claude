// DOCUMENTI-AZIONI — Pixel 7 light/dark, synthetic data: every document has «•••» (open, download, send, move to a
// case); select one or all; «Scarica / invia» prepares single files or one ZIP; «Pratica» moves the chosen ones.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-documenti-azioni'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5186', '--strictPort'], { stdio: 'ignore' });
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64');
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5186')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [schema, modo] of [['light', 'righe'], ['dark', 'griglia']]) {
    const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: schema }); const page = await context.newPage(); const errors = []; const patch = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.hostname.endsWith('supabase.co')) {
        if (u.pathname.includes('/auth/')) return json({ access_token: 't', user: { id: 'u' } });
        if (req.method() === 'PATCH') { patch.push({ path: u.pathname, q: decodeURIComponent(u.search), body: req.postDataJSON() }); return json([{ id: 'd1' }]); }
        if (u.pathname.endsWith('/v_pratiche')) return json([{ id: 'p2', titolo: 'Zeta – pratica chiusa', stato: 'risolta', n_documenti: 1 }, { id: 'p1', titolo: 'Alfa – causa di prova', stato: 'aperta', n_documenti: 4 }]);
        return json([]);
      }
      if (u.hostname === 'script.google.com' || u.hostname.endsWith('googleusercontent.com')) return json({ ok: true, nome: 'documento.pdf', mime: 'application/pdf', dati: PDF });
      return route.abort();
    });
    await page.addInitScript(() => { window.__tokenFinto = true; });
    await page.goto(`http://127.0.0.1:5186/tests/visual/personal-documenti-azioni.html?modo=${modo}`);
    await page.locator('.pp-doc-menu').first().waitFor();
    assert.equal(await page.locator('.pp-doc-menu').count(), 3, 'every document has «•••»');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll');
    await page.screenshot({ path: `${out}/elenco-${schema}-${modo}.png`, fullPage: true });
    // «•••» → menu with open / download / send / move.
    await page.getByRole('button', { name: 'Azioni: Precetto di prova' }).click();
    for (const v of ['Apri', 'Scarica', 'Invia o condividi', 'Sposta in una pratica', 'Metti in una tua cartella', 'Seleziona più documenti']) await page.getByRole('button', { name: new RegExp(`^${v}`) }).first().waitFor();
    await page.screenshot({ path: `${out}/menu-${schema}.png` });
    await page.getByRole('button', { name: /^Apri$/ }).click();
    assert.deepEqual(await page.evaluate(() => window.azioniTest.aperte.at(-1)), { tipo: 'documento', id: 'd1' });
    // Move one document into a case (open cases first, by name).
    await page.getByRole('button', { name: 'Azioni: Precetto di prova' }).click();
    await page.getByRole('button', { name: /^Sposta in una pratica/ }).click();
    await page.locator('.pp-foglio .pp-riga', { hasText: 'Alfa – causa di prova' }).waitFor();
    const voci = await page.locator('.pp-foglio .pp-riga .pp-riga-titolo').allInnerTexts();
    assert.deepEqual(voci, ['Alfa – causa di prova', 'Zeta – pratica chiusa'], `open first: ${voci}`);
    await page.locator('.pp-foglio .pp-riga', { hasText: 'Alfa – causa di prova' }).click();
    await page.waitForFunction(() => window.azioniTest.messaggi.some((m) => /Nella pratica/.test(m)));
    const mv = patch.find((x) => x.path.endsWith('/documenti'));
    assert.deepEqual(mv.body, { pratica_id: 'p1' }); assert.match(mv.q, /id=in\.\(d1\)/);
    // Select all → bar with Scarica / invia and Pratica.
    await page.getByRole('button', { name: 'Seleziona' }).click();
    await page.getByRole('button', { name: 'Tutti' }).click();
    await page.getByText('3 scelti').waitFor();
    for (const b of ['Scarica / invia', 'Pratica', 'Cartella']) await page.getByRole('toolbar').getByRole('button', { name: new RegExp(b) }).waitFor();
    assert.equal(await page.locator('.pp-invio-salute button').count(), 2, 'Mail and WhatsApp for the chosen ones');
    await page.screenshot({ path: `${out}/selezione-${schema}.png` });
    await page.getByRole('toolbar').getByRole('button', { name: /Scarica \/ invia/ }).click();
    await page.getByRole('dialog', { name: 'Invia' }).waitFor();
    await page.getByRole('dialog', { name: 'Invia' }).getByText('3 documenti', { exact: true }).waitFor();
    await page.screenshot({ path: `${out}/invia-${schema}.png` });
    assert.equal(await page.getByRole('button', { name: 'Prepara lo ZIP' }).isVisible() || await page.getByRole('button', { name: 'Prepara i file' }).isVisible(), true);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('personal-documenti-azioni PASS Pixel 7 light/dark (rows and grid): «•••» on every document, open, move to case (open first), select all, Scarica / invia sheet.');
} finally { await browser?.close(); server.kill(); }
