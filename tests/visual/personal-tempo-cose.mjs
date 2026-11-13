// ARCHIVIO-TEMPO / ARCHIVIO-COSE: synthetic data only.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-tempo-cose'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5180', '--strictPort'], { stdio: 'ignore' });
const RIGHE = [
  { mese: '2026-11-01', fascicolo: 'utenze', n: 2 }, { mese: '2026-11-01', fascicolo: 'veicoli', n: 1 },
  { mese: '2026-10-01', fascicolo: 'riscaldamento', n: 1 }, { mese: '2026-10-01', fascicolo: 'studio_fornitori', n: 2 },
  { mese: '2026-09-01', fascicolo: 'famiglia_scuola', n: 1 }, { mese: '2025-06-01', fascicolo: 'conti', n: 3 }, { mese: '2024-03-01', fascicolo: 'immobili', n: 2 },
];
const d = (id, titolo, fascicolo, data, extra = {}) => ({ id, titolo, fascicolo, ente: 'Ente Prova', data_documento: data, email_data: `${data}T09:00:00Z`, importo: null, rilevanza: 'normale', tag: [], dati_estratti: {}, ...extra });
const DOCS = [
  d('u1', 'Bolletta luce', 'utenze', '2026-11-08', { importo: 168.4, dati_estratti: { POD: 'IT001E00000000', 'indirizzo fornitura': 'Via Prova 1' } }),
  d('u2', 'Bolletta gas', 'utenze', '2026-11-03', { importo: 94.2 }),
  d('v1', 'Avviso revisione', 'veicoli', '2026-11-05', { dati_estratti: { targa: 'AB123CD', IBAN: 'IT00NONMOSTRARE' } }),
  d('r1', 'Fattura pellet', 'riscaldamento', '2026-10-23', { importo: 548 }),
  d('s1', 'Fattura laboratorio', 'studio_fornitori', '2026-10-15'), d('s2', 'Materiali', 'studio_fornitori', '2026-10-02'),
  d('f1', 'Mensa scolastica', 'famiglia_scuola', '2026-09-28'), d('p1', 'Referto paziente', 'clinico_pazienti', '2026-11-04'),
];
const oggi = new Date(); const tra = (g) => { const x = new Date(oggi); x.setDate(x.getDate() + g); return x.toISOString().slice(0, 10); };
const SCAD = [{ id: 's1', data: tra(41), descrizione: 'Revisione auto', documento_id: 'v1', completata: false, storica: false }, { id: 's2', data: tra(20), descrizione: 'IMU saldo', documento_id: 'u1', completata: false, storica: false }];
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5180')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] }); const page = await context.newPage(); const errors = []; const rpc = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname.endsWith('supabase.co')) {
      if (u.pathname.endsWith('/v_tempo_mesi')) return route.fulfill({ json: RIGHE });
      if (u.pathname.endsWith('/scadenze')) return route.fulfill({ json: SCAD });
      if (u.pathname.endsWith('/documenti')) return route.fulfill({ json: DOCS.map(({ id, fascicolo }) => ({ id, fascicolo })) });
      if (u.pathname.endsWith('/rpc/cerca_archivio_v2')) {
        const b = JSON.parse(req.postData()); rpc.push(b); const f = b.p_filtri || {};
        let r = DOCS.filter((x) => (!f.da || x.data_documento >= f.da) && (!f.a || x.data_documento <= f.a) && (!f.fascicoli || f.fascicoli.includes(x.fascicolo)));
        if (b.p_testo) r = DOCS.filter((x) => x.titolo.toLowerCase().includes(b.p_testo.toLowerCase().split(' ')[0]));
        return route.fulfill({ json: r });
      }
      return route.fulfill({ json: [] });
    }
    return route.abort();
  });
  await page.goto('http://127.0.0.1:5180/tests/visual/personal-tempo-cose.html');
  await page.getByRole('tab', { name: 'Chiedi' }).waitFor();

  // Le mie cose
  await page.getByRole('tab', { name: 'Le mie cose' }).click();
  await page.locator('.pp-cosa', { hasText: 'Auto' }).getByText(/Revisione auto · tra 41 giorni/).waitFor();
  assert.ok(await page.locator('.pp-cosa', { hasText: 'Casa' }).getByText('5 documenti').isVisible());
  assert.ok(await page.locator('.pp-cosa', { hasText: 'Giulia' }).isVisible());
  await page.screenshot({ path: `${out}/cose.png` });
  await page.locator('.pp-cosa', { hasText: 'Auto' }).click();
  await page.getByRole('heading', { name: 'Auto' }).waitFor();
  await page.getByText('AB123CD').waitFor();
  assert.equal(await page.getByText('IT00NONMOSTRARE').count(), 0, 'niente IBAN');
  await page.screenshot({ path: `${out}/auto.png`, fullPage: true });
  await page.getByRole('button', { name: 'Indietro' }).click();

  // Tempo
  await page.getByRole('tab', { name: 'Tempo' }).click();
  await page.getByRole('heading', { name: /Novembre 2026/ }).waitFor();
  await page.getByText('Avviso revisione').waitFor();
  assert.equal(await page.getByText('Referto paziente').count(), 0, 'pazienti esclusi');
  await page.screenshot({ path: `${out}/tempo-mesi.png` });
  await page.getByRole('button', { name: 'Casa' }).click();
  await page.getByRole('heading', { name: /Marzo 2024/ }).waitFor({ state: 'attached' }).catch(() => {});
  await page.getByText('Fattura pellet').waitFor();
  assert.equal(await page.getByText('Fattura laboratorio').count(), 0, 'filtro Casa');
  await page.getByRole('button', { name: 'Anni', exact: true }).click();
  await page.locator('.pp-tempo-anno', { hasText: '2024' }).waitFor();
  await page.getByRole('button', { name: 'Tutto' }).click();
  await page.screenshot({ path: `${out}/tempo-anni.png` });
  await page.locator('.pp-tempo-anno', { hasText: '2025' }).click();
  await page.getByRole('heading', { name: /Giugno 2025/ }).waitFor();
  assert.ok(await page.getByRole('button', { name: /Solo 2025/ }).isVisible());

  const larga = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(larga, false, 'nessuno scorrimento orizzontale');
  const doppie = rpc.map((b) => JSON.stringify(b)); assert.equal(new Set(doppie).size, doppie.length, 'nessuna richiesta doppia');
  assert.deepEqual(errors, []);
  console.log('personal-tempo-cose PASS');
} finally { await browser?.close(); server.kill(); }
