// MIEI-DATI, synthetic only: cards side by side scroll horizontally (page never does), tabs jump to a card, a value is
// typed and saved (PATCH with campi), «Copia fatturazione» copies the block, «+ Società» creates a card. Pixel 7
// light/dark and desktop 1280×800.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-miei-dati'; await mkdir(out, { recursive: true });
const F = (etichetta, valore, gruppo = 'fatturazione') => ({ gruppo, etichetta, valore });
const SCHEDE = [
  { id: 's1', tipo: 'persona', nome: 'Dott. Mario Prova', descrizione: 'Libero professionista', colore: 'blu', ordine: 0, campi: [F('Intestazione', 'Dott. Mario Prova'), F('Indirizzo', 'Via Esempio 1, 10100 Città (XX)'), F('Partita IVA', '00000000000'), F('Codice destinatario SDI', ''), F('PEC', 'prova@pec.example'), F('Email', 'prova@example.com', 'contatti'), F('IBAN', 'IT00X0000000000000000000000', 'banca')], persone: [{ ruolo: 'Commercialista', nome: 'Studio Finto', email: 'studio@example.com', telefono: '000 000000' }], note: 'Nota di prova.' },
  { id: 's2', tipo: 'societa', nome: 'Esempio S.a.s. di Prova & C.', descrizione: 'Socio accomandatario', colore: 'ambra', ordine: 1, campi: [F('Ragione sociale', 'Esempio S.a.s.'), F('Sede legale', 'Via Finta 2, Città'), F('Partita IVA', '11111111111'), F('PEC', '')], persone: [], note: null },
  { id: 's3', tipo: 'societa', nome: 'Altra Prova S.r.l.', descrizione: null, colore: 'verde', ordine: 2, campi: [F('Ragione sociale', 'Altra Prova S.r.l.')], persone: [], note: null },
];
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5186', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5186')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  { const p = await (await browser.newContext()).newPage(); await p.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.fulfill({ json: [] })));
    await p.goto('http://127.0.0.1:5186/tests/visual/personal-miei-dati.html'); await p.waitForTimeout(4000); await p.context().close(); }
  for (const [nome, opz] of [['phone-light', { ...devices['Pixel 7'], colorScheme: 'light' }], ['phone-dark', { ...devices['Pixel 7'], colorScheme: 'dark' }], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
    const context = await browser.newContext({ ...opz, permissions: ['clipboard-read', 'clipboard-write'] }); const page = await context.newPage(); const errors = []; const scritture = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        const body = req.postData() ? JSON.parse(req.postData()) : null;
        if (!['GET', 'HEAD'].includes(req.method())) scritture.push({ metodo: req.method(), q: u.search, body });
        if (u.pathname.endsWith('/miei_dati') && req.method() === 'PATCH') return route.fulfill({ json: { ...SCHEDE.find((s) => u.search.includes(s.id)), ...body } });
        if (u.pathname.endsWith('/miei_dati') && req.method() === 'POST') return route.fulfill({ status: 201, json: { id: 'nuova', ...body } });
        if (u.pathname.endsWith('/miei_dati')) return route.fulfill({ json: SCHEDE });
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5186/tests/visual/personal-miei-dati.html');
    await page.getByText('Dott. Mario Prova', { exact: true }).first().waitFor();
    const misure = await page.evaluate(() => { const s = document.querySelector('.pp-md-striscia'); return { pagina: document.documentElement.scrollWidth - innerWidth, striscia: s.scrollWidth - s.clientWidth }; });
    assert.ok(misure.pagina <= 0, `${nome}: la pagina non scorre di lato (${misure.pagina})`);
    assert.ok(misure.striscia > 0, `${nome}: le schede scorrono in orizzontale`);
    await page.screenshot({ path: `${out}/${nome}.png` });
    await page.getByRole('button', { name: 'Copia fatturazione' }).first().click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'Dott. Mario Prova\nVia Esempio 1, 10100 Città (XX)\nPartita IVA: 00000000000\nPEC: prova@pec.example');
    await page.getByRole('tab', { name: /Altra Prova/ }).click(); await page.waitForTimeout(700);
    assert.ok(await page.locator('[data-scheda="s3"]').evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= -2 && r.left < innerWidth / 2; }), `${nome}: la linguetta porta alla scheda`);
    await page.locator('#md-v-s2-3').fill('esempio@pec.example'); await page.waitForTimeout(1200);
    const patch = scritture.find((w) => w.metodo === 'PATCH' && w.q.includes('s2'));
    assert.ok(patch && patch.body.campi[3].valore === 'esempio@pec.example', `${nome}: il valore scritto si salva`);
    await page.getByRole('button', { name: '+ Società' }).click(); await page.waitForTimeout(800);
    assert.ok(scritture.some((w) => w.metodo === 'POST' && w.body.tipo === 'societa' && w.body.campi.some((c) => c.etichetta === 'PEC')), `${nome}: si aggiunge una società`);
    await page.screenshot({ path: `${out}/${nome}-nuova.png` });
    assert.deepEqual(errors, [], `${nome}: nessun errore`);
    await context.close();
  }
  console.log('personal-miei-dati: PASS');
} finally { await browser?.close(); server.kill(); }
