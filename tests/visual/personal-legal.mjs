// LEGAL-SCHEDE, synthetic only: deadline table (duplicates merged, perentorie red with days left, conflict
// flagged, legal/economic filter, mark done) and pratica card (summary, key points with sources, attention,
// steps synced with «Da fare», analyse button). Pixel 7, light and dark.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-legal'; await mkdir(out, { recursive: true });
const oggi = new Date(); const tra = (g) => { const d = new Date(oggi); d.setDate(d.getDate() + g); return d.toISOString().slice(0, 10); };
const doc = (fascicolo, pratica_id, titolo, ptit) => ({ titolo, fascicolo, pratica_id, pratica: { titolo: ptit, fascicolo } });
const riga = (id, g, descrizione, importo, d) => ({ id, data: tra(g), descrizione, importo, documento_id: `doc-${id}`, pratica_id: d.pratica_id, documento: d, pratica: d.pratica });
const uno = doc('legale', 'p-uno', 'Decreto ingiuntivo', 'Fornitore Prova – opposizione decreto ingiuntivo');
const atp = doc('legale', 'p-atp', 'Atto', 'Ricorso di prova R.G. 1/2026');
const SCADENZE = [
  riga('s1', 6, 'Termine recesso gratuito nuove commissioni conto', null, doc('conti', 'p-conto', 'Contratto banca', 'Banca Prova – conto')),
  riga('s2', 19, 'Termine perentorio di 40 giorni dalla notifica per proporre opposizione al decreto ingiuntivo', 2163.59, uno),
  riga('s3', 19, 'Termine perentorio per proporre opposizione al decreto ingiuntivo', null, uno),
  riga('s4', 24, 'Termine per la parte resistente per il deposito di memoria di costituzione e documenti', null, atp),
  riga('s5', 25, 'Termine perentorio per deposito telematico memoria di costituzione e documenti', null, atp),
  riga('s6', 40, 'Scadenza pagamento preruolo verbale 12345VP/26', 103.5, doc('veicoli', 'p-multe', 'Avviso verbale 12345VP/26', 'Polizia Locale – verbali')),
  riga('s7', 3, 'Visita', null, doc('clinico_pazienti', 'p-x', 'Referto', 'Paziente')),
];
const SCHEDA = { pratica_id: 'p-uno', oggetto: 'Opposizione al decreto ingiuntivo n. 1/2026', controparte: 'Fornitore Prova S.p.A.', autorita: 'Giudice di Pace di Prova', importo: 2163.59,
  sintesi: 'Il fornitore chiede 1.694,14 € per fatture dopo la disdetta. Termine per l’opposizione tra 19 giorni.',
  punti: [{ testo: 'Disdetta via email del 13/11/2023, confermata il giorno dopo.', doc: ['d1', 'd2'] }, { testo: 'Cinque fatture contestate, totale 1.694,14 €.', doc: ['d3'] }],
  attenzione: [{ testo: 'Consumi alti dopo la disdetta: verificare se le letture erano reali.', doc: ['d3'] }],
  fonti: ['d1', 'd2', 'd3'], modello: 'claude-code', generata_il: new Date().toISOString() };
const PASSI = [{ id: 'a1', titolo: 'Dare l’incarico all’avvocato', scadenza: tra(7), priorita: 'alta', stato: 'aperto', creato_il: '2026-11-18' },
  { id: 'a2', titolo: 'Chiedere le letture al distributore', scadenza: null, priorita: 'media', stato: 'gestito', creato_il: '2026-11-18' }];
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5183', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5183')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  // Warm-up: Vite optimises new dependencies on the first visit and reloads the page; do it before the checks.
  { const p = await (await browser.newContext()).newPage(); await p.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.fulfill({ json: [] })));
    for (const q of ['', '?vista=pratica']) { await p.goto(`http://127.0.0.1:5183/tests/visual/personal-legal.html${q}`); await p.waitForTimeout(4000); } await p.context().close(); }
  for (const schema of ['light', 'dark']) {
    const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: schema }); const page = await context.newPage(); const errors = []; const scritture = []; const script = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        if (!['GET', 'HEAD'].includes(req.method())) { scritture.push({ path: u.pathname, q: u.search, body: req.postData() }); }
        if (u.pathname.endsWith('/scadenze') && req.method() === 'PATCH') return route.fulfill({ json: [{ id: 's2' }, { id: 's3' }] });
        if (u.pathname.endsWith('/scadenze')) return route.fulfill({ json: u.searchParams.get('completata') ? SCADENZE : [] });
        if (u.pathname.endsWith('/v_pratiche')) return route.fulfill({ json: u.searchParams.get('id') ? { id: 'p-uno', titolo: 'Fornitore Prova – opposizione decreto ingiuntivo', fascicolo: 'legale', stato: 'aperta', prossima_scadenza: tra(19) } : [{ id: 'p-uno', titolo: 'Fornitore Prova – opposizione decreto ingiuntivo', fascicolo: 'legale', stato: 'aperta', n_documenti: 3, prossima_scadenza: tra(19) }] });
        if (u.pathname.endsWith('/pratiche_schede')) return route.fulfill({ json: SCHEDA });
        if (u.pathname.endsWith('/promemoria_azioni') && req.method() === 'PATCH') return route.fulfill({ json: { id: 'a1', stato: 'gestito' } });
        if (u.pathname.endsWith('/promemoria_azioni') && req.method() === 'POST') return route.fulfill({ status: 201, json: { id: 'a3', titolo: 'Telefonare all’avvocato', scadenza: null, priorita: 'media', stato: 'aperto', creato_il: '2026-11-18' } });
        if (u.pathname.endsWith('/promemoria_azioni')) return route.fulfill({ json: PASSI });
        if (u.pathname.endsWith('/documenti')) return route.fulfill({ json: [{ id: 'd1', titolo: 'Disdetta email', fascicolo: 'legale', email_data: '2023-11-13T10:00:00Z', tag: [] }] });
        return route.fulfill({ json: [] });
      }
      if (u.hostname === 'script.google.com') { script.push(JSON.parse(req.postData() || '{}')); return route.fulfill({ json: { ok: true, passi_nuovi: 0 } }); }
      return route.abort();
    });
    // Legal: deadline table.
    await page.goto('http://127.0.0.1:5183/tests/visual/personal-legal.html');
    await page.locator('.pp-legal-riga').first().waitFor();
    const righe = await page.locator('.pp-legal-riga').evaluateAll((els) => els.map((e) => ({ cls: e.className, testo: e.innerText.replace(/\s+/g, ' ') })));
    assert.equal(righe.length, 4, `4 rows after merging and dropping the clinical one: ${JSON.stringify(righe)}`);
    assert.match(righe[1].cls, /pp-tipo-perentoria/); assert.match(righe[1].testo, /19 gg/); assert.match(righe[1].testo, /da 2 documenti/); assert.match(righe[1].testo, /2163,59|2.163,59/);
    assert.match(righe[2].testo, /⚠ Nei documenti c'è anche/);
    assert.match(righe[0].testo, /economica/i);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll');
    await page.screenshot({ path: `${out}/scadenze-${schema}.png`, fullPage: true });
    await page.getByRole('tab', { name: 'Legali', exact: true }).click();
    assert.equal(await page.locator('.pp-legal-riga').count(), 2);
    await page.locator('.pp-legal-riga').first().getByRole('button', { name: 'Segna come fatta' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.pp-legal-riga').length === 1);
    const patch = scritture.find((s) => s.path.endsWith('/scadenze'));
    assert.match(decodeURIComponent(patch.q), /id=in\.\(s2,s3\)/, 'both duplicate rows marked done');
    await page.locator('.pp-legal-riga .pp-legal-cosa').first().click();
    assert.deepEqual(await page.evaluate(() => window.legalTest.aperto.at(-1).tipo), 'pratica');
    // Pratica: card.
    await page.goto('http://127.0.0.1:5183/tests/visual/personal-legal.html?vista=pratica');
    await page.getByRole('heading', { name: 'In sintesi' }).waitFor();
    for (const h of ['Punti salienti', 'Da attenzionare', 'Passi da fare · 1 aperti']) await page.getByRole('heading', { name: h }).waitFor();
    assert.deepEqual(await page.locator('.pp-sp-fonte').allTextContents(), ['doc 1', 'doc 2', 'doc 3', 'doc 3'], 'same number for the same document everywhere');
    await page.locator('.pp-sp-fonte').first().click();
    assert.deepEqual(await page.evaluate(() => window.legalTest.aperto.at(-1)), { tipo: 'documento', id: 'd1' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll');
    await page.screenshot({ path: `${out}/scheda-${schema}.png`, fullPage: true });
    await page.locator('.pp-sp-passi label').first().click({ noWaitAfter: true });
    await page.getByRole('heading', { name: 'Passi da fare · 0 aperti' }).waitFor();
    assert.ok(scritture.some((s) => s.path.endsWith('/promemoria_azioni') && /"stato":"gestito"/.test(s.body)));
    await page.getByLabel('Nuovo passo').fill('Telefonare all’avvocato');
    await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
    await page.getByText('Telefonare all’avvocato').waitFor();
    const nuovo = JSON.parse(scritture.find((s) => s.path.endsWith('/promemoria_azioni') && s.body?.includes('Telefonare')).body);
    assert.deepEqual([nuovo.pratica_id, nuovo.categoria, nuovo.stato], ['p-uno', 'legale', 'aperto']);
    await page.getByRole('button', { name: 'Aggiorna analisi' }).click();
    await page.waitForFunction(() => window.legalTest.toast.some((t) => /Scheda aggiornata/.test(t)));
    assert.deepEqual(script.at(-1).azione, 'scheda_pratica');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('personal-legal PASS Pixel 7 light/dark: merged deadlines, perentorie, conflict, filters, mark done; pratica card with sources, steps, analyse.');
} finally { await browser?.close(); server.kill(); }
