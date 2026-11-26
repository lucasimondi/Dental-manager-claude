// PERSONALE-HOME: synthetic data only. Home «Personale» → Conti (prossima scadenza, schede).
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-personale'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], { stdio: 'ignore' });
const oggi = new Date(); const tra = (g) => { const x = new Date(oggi); x.setDate(x.getDate() + g); return x.toISOString().slice(0, 10); };
const mese = tra(0).slice(0, 7);
const PROMEMORIA = [{ id: 'a1', stato: 'aperto', priorita: 'alta', titolo: 'Sollecito prova', spiegazione: 'Spiegazione prova', importo: 120, pratica_id: 'p1', scadenza: tra(7) }, { id: 'a2', stato: 'aperto', priorita: 'media', titolo: 'Rispondere prova', spiegazione: 'Spiegazione prova', pratica_id: 'p1' }, { id: 'a3', stato: 'aperto', priorita: 'bassa', titolo: 'Rinnovo prova', spiegazione: 'Spiegazione prova' }];
const DOCS = [
  { id: 'd1', titolo: 'Ricevuta acquisto', fascicolo: 'conti', mime_type: 'application/pdf', creato_il: `${tra(0)}T09:00:00Z`, ente: 'Negozio Prova' },
  { id: 'd2', titolo: 'Referto paziente', fascicolo: 'clinico_pazienti', mime_type: 'application/pdf', creato_il: `${tra(0)}T08:00:00Z` },
  { id: 'd3', titolo: 'Contratto luce', fascicolo: 'utenze', mime_type: 'image/jpeg', creato_il: `${tra(-1)}T08:00:00Z`, ente: 'Fornitore Prova' },
];
const SCAD = [
  { id: 's1', data: tra(4), descrizione: 'Bolletta luce prova', importo: 86.4, completata: false, storica: false },
  { id: 's2', data: tra(14), descrizione: 'Condominio prova', importo: 180, completata: false, storica: false },
];
const MOV = [
  { id: 'm1', data: `${mese}-02`, tipo: 'entrata', importo: 2800, descrizione: 'Entrata prova', categoria: 'Altro' },
  { id: 'm2', data: `${mese}-03`, tipo: 'uscita', importo: 54.8, descrizione: 'Spesa alimentare prova', categoria: 'Spesa' },
];
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5181')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const tema of ['light', 'dark']) {
    // HOME-TELEFONO: questa è la Home del computer (sul telefono c'è HomeTelefono, test personal-home-telefono).
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: tema }); const page = await context.newPage(); const errors = []; const scritture = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        if (!['GET', 'HEAD'].includes(req.method())) scritture.push(u.pathname); // HEAD = conteggio (Rubrica), è una lettura
        if (u.pathname.endsWith('/promemoria_azioni')) return route.fulfill({ json: PROMEMORIA });
        if (u.pathname.endsWith('/v_pratiche')) return route.fulfill({ json: [{ id: 'p1', titolo: 'Pratica di prova – recupero', fascicolo: 'legale', stato: 'aperta', n_documenti: 3 }] });
        if (u.pathname.endsWith('/documenti')) return route.fulfill({ json: DOCS });
        if (u.pathname.endsWith('/scadenze')) return route.fulfill({ json: SCAD });
        if (u.pathname.endsWith('/movimenti')) return route.fulfill({ json: MOV });
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5181/tests/visual/personal-personale.html');
    await page.getByRole('heading', { name: 'Personale' }).waitFor();
    await page.getByText('3 cose da gestire').waitFor();
    await page.getByText('Ricevuta acquisto').waitFor();
    assert.equal(await page.getByText('Referto paziente').count(), 0, 'niente documenti clinici');
    for (const n of ['Identità', 'Foto', 'Note', 'Pratiche', 'Diario', 'Biblioteca', 'Password', 'Oggi']) assert.ok(await page.locator('.pps-tessera', { hasText: n }).isVisible(), n);
    assert.equal(await page.locator('.pps-scan').evaluate((e) => e.tagName), 'BUTTON', 'SCAN-APP: Scan si apre dentro Personal');
    assert.ok(await page.getByRole('button', { name: 'Impostazioni', exact: true }).isVisible());
    await page.screenshot({ path: `${out}/home-${tema}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Aggiungi' }).click();
    await page.getByRole('searchbox', { name: 'Cerca nelle tue cose' }).fill('bibli');
    await page.locator('.pps-riga', { hasText: 'Biblioteca' }).click();
    await page.getByRole('searchbox', { name: 'Cerca nelle tue cose' }).fill('');
    await page.locator('.pps-tessera', { hasText: 'Identità' }).click();
    await page.locator('.pps-carta', { hasText: 'Conti' }).click();
    await page.getByText('Prossima scadenza').waitFor();
    await page.locator('.pp-prossima', { hasText: 'Bolletta luce prova' }).waitFor();
    await page.screenshot({ path: `${out}/conti-${tema}.png`, fullPage: true });
    await page.locator('.pp-prossima').click();
    await page.getByRole('button', { name: /Da valutare con Poliedron/ }).click();
    const t = await page.evaluate(() => window.personaleTest);
    assert.deepEqual(t.vai.slice(0, 3), [['didattica', null], ['documenti', 'personali'], ['conti', null]]);
    assert.equal(t.aggiungi, 1);
    assert.deepEqual(t.aperti.map((x) => x.tipo), ['pagamento', 'revisione']);
    assert.equal(t.aperti[0].id, 's1');
    await page.locator('.pp-segmenti button', { hasText: 'Da pagare' }).first().click();
    await page.getByText('Condominio prova').waitFor();
    await page.getByRole('button', { name: 'Torna' }).click();
    await page.locator('.pps-dafare').click();
    await page.getByText('Sollecito prova').waitFor();
    // DA-FARE-PER-PRATICA: i due promemoria della pratica sono una sola voce; il tocco apre la pratica.
    assert.equal(await page.locator('.pp-promemoria-pratica').count(), 1);
    assert.match(await page.locator('.pp-promemoria-pratica').innerText(), /Pratica di prova – recupero[\s\S]*2 passi da fare[\s\S]*Sollecito prova[\s\S]*Rispondere prova/);
    await page.screenshot({ path: `${out}/dafare-${tema}.png`, fullPage: true });
    await page.locator('.pp-promemoria-pratica').click();
    assert.deepEqual(await page.evaluate(() => { const a = window.personaleTest.aperti.at(-1); return [a.tipo, a.id]; }), ['pratica', 'p1']);
    await page.getByRole('button', { name: 'Torna' }).click();
    await page.getByRole('button', { name: 'Impostazioni', exact: true }).click();
    assert.equal((await page.evaluate(() => window.personaleTest.aperti.at(-1).tipo)), 'impostazioni');
    const larga = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(larga, false, 'nessuno scorrimento orizzontale');
    assert.deepEqual(scritture, [], 'solo letture');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('personal-personale PASS');
} finally { await browser?.close(); server.kill(); }
