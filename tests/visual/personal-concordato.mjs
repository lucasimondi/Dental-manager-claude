// CONCORDATO, synthetic only: Beni list (groups, quota, «Con Anna», «Pignorato», PDF buttons), Divisione with no
// proposals (choose the two houses → Proposta A creates the right assignments), proposal page (live totals,
// value typed in Italian format saved on the bene, destination buttons). Pixel 7, light and dark.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-concordato'; await mkdir(out, { recursive: true });
const B = (id, ordine, gruppo, nome, extra = {}) => ({ id, ordine, gruppo, nome, catasto: 'F', comune: 'Città', foglio: '1', particella: '10', subalterno: String(ordine), categoria: 'A/3', classe: '02', consistenza: '6 vani', rendita: 300, titolo: 'Proprietà', quota_luca: '1/2', quota_anna: '1/2', altri_comproprietari: 'Sorella Prova', in_divisione: true, vincoli: null, note: null, valore: null, fonte: 'Prova', ...extra });
const BENI = [
  B('b1', 1, 'Città – via Prova 1', 'Casa via Prova – sub 1', { vincoli: 'Quota 1/2 pignorata (RGE 1/2026).', valore: 200000 }),
  B('b2', 2, 'Città – via Prova 1', 'Villino via Prova – sub 2', { categoria: 'A/7', consistenza: '7 vani', valore: 300000 }),
  B('b3', 3, 'Città – via Prova 1', 'Garage via Prova – sub 3', { categoria: 'C/6', consistenza: '20 m²' }),
  B('b4', 4, 'Città – corso Esempio 2', 'Negozio corso Esempio', { categoria: 'C/1', consistenza: '60 m²', valore: 120000 }),
  B('b5', 5, 'Beinette – via Finta 3', 'Casa Beinette', { comune: 'Beinette', categoria: 'A/2', valore: 150000 }),
  B('b6', 6, 'Paese – via Lontana 4', 'Appartamento Paese', { quota_luca: '1/4', quota_anna: null, in_divisione: false, altri_comproprietari: 'Altri 3/4' }),
  B('b7', 7, 'Terreni – Paese', 'Terreno Paese part. 9 – prato', { catasto: 'T', categoria: 'Prato', consistenza: '1.000 m²', rendita: null, reddito_dominicale: 1.2, reddito_agrario: 2.3, quota_luca: '1/9', quota_anna: null, in_divisione: false }),
];
const FORMALITA = [
  { id: 'f1', ordine: 1, tipo: 'trascrizione', verso: 'contro', data: '2025-02-25', reg_particolare: '1', reg_generale: '2', pubblico_ufficiale: 'Ufficiale Prova', repertorio: '1 del 2025', atto: 'Verbale di pignoramento immobili', natura: 'pignoramento', creditore: 'Creditore Prova', procedura: 'RGE 1/2026', beni: [{ id: 'b1', certezza: 'certo' }], note: null },
  { id: 'f2', ordine: 2, tipo: 'iscrizione', verso: 'contro', data: '2024-10-17', reg_particolare: '3', reg_generale: '4', pubblico_ufficiale: 'Tribunale Prova', repertorio: '2 del 2024', atto: 'Ipoteca giudiziale', natura: 'ipoteca_giudiziale', creditore: 'Altro Prova', procedura: null, beni: [{ id: 'b5', certezza: 'certo' }, { id: 'b2', certezza: 'probabile' }], note: null },
  { id: 'f3', ordine: 3, tipo: 'trascrizione', verso: 'favore', data: '2024-04-08', reg_particolare: '5', reg_generale: '6', pubblico_ufficiale: 'Ufficio Prova', repertorio: '3 del 2024', atto: 'Successione', natura: 'successione', creditore: null, procedura: null, beni: [{ id: 'b1', certezza: 'certo' }], note: null },
];
const SCENARIO = { id: 's1', nome: 'Proposta A – Equa', descrizione: 'Anna prende il negozio, Beinette e la sua casa; tu la tua casa.', assegnazioni: { b1: 'luca', b2: 'anna', b4: 'anna', b5: 'anna', b3: 'vendita' }, voci: [], note: null, creato_il: '2026-11-20' };
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5184', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5184')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  { const p = await (await browser.newContext()).newPage(); await p.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.fulfill({ json: [] })));
    for (const q of ['', '?vista=proposta']) { await p.goto(`http://127.0.0.1:5184/tests/visual/personal-concordato.html${q}`); await p.waitForTimeout(4000); } await p.context().close(); }
  for (const schema of ['light', 'dark']) {
    const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: schema }); const page = await context.newPage(); const errors = []; const scritture = [];
    let scenari = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        const body = req.postData() ? JSON.parse(req.postData()) : null;
        if (!['GET', 'HEAD'].includes(req.method())) scritture.push({ path: u.pathname, metodo: req.method(), q: u.search, body });
        if (u.pathname.endsWith('/concordato_beni') && req.method() === 'PATCH') return route.fulfill({ json: { ...BENI.find((b) => u.search.includes(b.id)), ...body } });
        if (u.pathname.endsWith('/concordato_beni')) return route.fulfill({ json: BENI });
        if (u.pathname.endsWith('/concordato_formalita')) return route.fulfill({ json: FORMALITA });
        if (u.pathname.endsWith('/divisione_scenari') && req.method() === 'POST') return route.fulfill({ status: 201, json: { id: 'nuovo', ...body } });
        if (u.pathname.endsWith('/divisione_scenari') && req.method() === 'PATCH') return route.fulfill({ json: { ...SCENARIO, ...body } });
        if (u.pathname.endsWith('/divisione_scenari')) return route.fulfill({ json: scenari });
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    // Beni.
    await page.goto('http://127.0.0.1:5184/tests/visual/personal-concordato.html');
    await page.getByText('Situazione completa degli immobili').waitFor();
    await page.getByText('Casa via Prova – sub 1').waitFor();
    assert.equal(await page.locator('.pp-cc-gruppo').count(), 5);
    assert.ok(await page.getByText('Pignorato').first().isVisible());
    assert.ok(await page.getByText('Beni in comune con Anna', { exact: true }).isVisible());
    assert.equal(await page.locator('.pp-cc-vincolo').count(), 2, 'ipoteca certa su Beinette, probabile sul villino');
    assert.ok(await page.getByText(/200\.000 € · tua parte 100\.000 €/).isVisible());
    assert.equal(await page.locator('.pp-cc-numeri strong').first().textContent(), '7');
    await page.screenshot({ path: `${out}/beni-${schema}.png`, fullPage: true });
    await page.getByText('Casa via Prova – sub 1').click();
    assert.equal(await page.evaluate(() => window.ccTest.aperto.at(-1).tipo), 'concordato-bene');
    // Ipoteche e atti.
    await page.getByRole('button', { name: 'Ipoteche e atti' }).click();
    await page.locator('.pp-cc-atto').first().waitFor();
    assert.equal(await page.locator('.pp-cc-atto').count(), 2, 'filtro «Contro di te»');
    await page.locator('.pp-cc-atto').first().getByRole('button').first().click();
    await page.getByText('Verbale di pignoramento immobili', { exact: false }).waitFor();
    await page.screenshot({ path: `${out}/atti-${schema}.png`, fullPage: true });
    // Divisione senza proposte: scelta delle case, poi Proposta A.
    await page.getByRole('button', { name: 'Divisione', exact: true }).click();
    await page.getByText('Nuova proposta', { exact: true }).waitFor();
    assert.ok(await page.getByRole('button', { name: /Proposta A – Equa/ }).isDisabled());
    await page.getByLabel('La tua casa (dove vivi)').selectOption('b1');
    await page.getByLabel('La casa di Anna').selectOption('b2');
    await page.screenshot({ path: `${out}/divisione-nuova-${schema}.png`, fullPage: true });
    await page.getByRole('button', { name: /Proposta A – Equa/ }).click();
    await page.waitForFunction(() => window.ccTest.aperto.some((p) => p.tipo === 'divisione-proposta'));
    const creata = scritture.find((s) => s.path.endsWith('/divisione_scenari') && s.metodo === 'POST');
    assert.deepEqual(creata.body.assegnazioni, { b1: 'luca', b2: 'anna', b3: 'vendita', b4: 'anna', b5: 'anna' });
    // Pagina della proposta.
    scenari = [SCENARIO];
    await page.goto('http://127.0.0.1:5184/tests/visual/personal-concordato.html?vista=proposta');
    await page.locator('.pp-cc-conguaglio').waitFor();
    // Luca: casa 200.000 (Anna ne perde 100.000); Anna: 300+120+150 = 570.000 (Luca ne perde 285.000) → 185.000.
    assert.equal(await page.locator('.pp-cc-conguaglio').textContent(), `Anna ti paga ${(185000).toLocaleString('it-IT')} €`);
    assert.match(await page.locator('.pp-cc-mancano').textContent(), /1 beni senza valore/);
    const garage = page.locator('.pp-cc-riga', { hasText: 'Garage via Prova' });
    await garage.getByRole('textbox').fill('30.000');
    await garage.getByRole('textbox').press('Enter');
    await page.waitForFunction(() => document.querySelector('.pp-cc-per-concordato')?.textContent.includes('15.000'));
    assert.ok(scritture.some((s) => s.path.endsWith('/concordato_beni') && s.body?.valore === 30000), 'valore salvato sul bene');
    await garage.getByRole('radio', { name: 'A te' }).click();
    await page.waitForFunction(() => document.querySelector('.pp-cc-conguaglio')?.textContent.includes('170.000'));
    await page.waitForTimeout(900);
    assert.ok(scritture.some((s) => s.path.endsWith('/divisione_scenari') && s.metodo === 'PATCH' && s.body.assegnazioni.b3 === 'luca'), 'proposta salvata da sola');
    await page.screenshot({ path: `${out}/proposta-${schema}.png`, fullPage: true });
    const larghezza = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(larghezza <= 412 + 1, `nessuno scorrimento orizzontale (${larghezza})`);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`personal-concordato ${schema}: PASS`);
  }
} finally { await browser?.close(); server.kill(); }
