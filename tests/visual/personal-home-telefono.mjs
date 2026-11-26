// HOME-TELEFONO (proposta E): synthetic data only. Pixel 7 light/dark: wallpaper Home with search, Da fare, Aggiunte
// (colour icons), Consigliati (nearest scadenza/promemoria, last document, never clinical); typing «gomme» finds the
// gommista (with Chiama), the promemoria and a document; «Tutte le app» asks Start to open; read-only; no side scroll.
// Desktop 1280×800 keeps the old Home.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-home-telefono'; await mkdir(out, { recursive: true });
const tra = (g) => new Date(Date.now() + g * 86400000).toISOString().slice(0, 10);
const PROMEMORIA_AZIONI = [{ id: 'a1', stato: 'aperto', priorita: 'alta', titolo: 'Sollecito prova', spiegazione: 'x', scadenza: tra(7) }, { id: 'a2', stato: 'aperto', priorita: 'media', titolo: 'Rispondere prova', spiegazione: 'x' }];
const DOCS = [
  { id: 'd2', titolo: 'Referto paziente', fascicolo: 'clinico_pazienti', mime_type: 'application/pdf', creato_il: `${tra(0)}T10:00:00Z` },
  { id: 'd1', titolo: 'Ricevuta di prova', fascicolo: 'conti', mime_type: 'application/pdf', creato_il: `${tra(-1)}T09:00:00Z` },
];
const COSE = [{ id: 'c1', ambito: 'auto', nome: 'Auto di prova', campi: [{ etichetta: 'Revisione', tipo: 'data', valore: tra(12), avviso: 30 }] }];
const RUBRICA = [{ id: 'r1', nome: 'Gomme di prova', categorie: ['Gommista'], telefono: '000 0000005', note: 'Gomme invernali in deposito', interventi: [] }, { id: 'r2', nome: 'Idraulica di prova', categorie: ['Idraulico'], telefono: '000 0000001', interventi: [] }];
const RUB_P = [{ id: 'p1', contatto_id: 'r1', cosa: 'Cambio gomme invernali', data: tra(4), ripeti: '1a', avviso_giorni: 30 }];
const TROVATI = [{ id: 'd3', titolo: 'Fattura gomme di prova', fascicolo: 'veicoli', mime_type: 'application/pdf', ente: 'Gommista prova' }, { id: 'd4', titolo: 'Gomme paziente', fascicolo: 'clinico_pazienti', mime_type: 'application/pdf' }];

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5191', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5191')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [nome, opz] of [['phone-light', { ...devices['Pixel 7'], colorScheme: 'light' }], ['phone-dark', { ...devices['Pixel 7'], colorScheme: 'dark' }], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
    const context = await browser.newContext(opz); const page = await context.newPage(); const errors = []; const scritture = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        if (!['GET', 'HEAD'].includes(req.method()) && !u.pathname.includes('/rpc/')) scritture.push(u.pathname);
        const t = u.pathname.split('/').pop();
        if (t === 'promemoria_azioni') return route.fulfill({ json: PROMEMORIA_AZIONI });
        if (t === 'documenti') return route.fulfill({ json: DOCS });
        if (t === 'mie_cose') return route.fulfill({ json: COSE });
        if (t === 'rubrica') return route.fulfill({ json: req.method() === 'HEAD' ? [] : RUBRICA, headers: { 'content-range': `0-1/${RUBRICA.length}` } });
        if (t === 'rubrica_promemoria') return route.fulfill({ json: RUB_P });
        if (t === 'cerca_archivio_v2') return route.fulfill({ json: TROVATI });
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5191/tests/visual/personal-personale.html');
    if (nome === 'desktop') {
      await page.getByRole('heading', { name: 'Personale' }).waitFor();
      assert.equal(await page.locator('.ppt').count(), 0, 'desktop: Home di prima');
      await page.screenshot({ path: `${out}/${nome}.png` });
      assert.deepEqual(errors, []); await context.close(); continue;
    }
    await page.evaluate(() => { window.startAperto = 0; window.addEventListener('poliedra:apri-start', () => { window.startAperto += 1; }); });
    await page.getByRole('searchbox', { name: 'Cerca in Personal' }).waitFor();
    await page.getByText('2 cose da gestire').waitFor();
    for (const n of ['Conti', 'Documenti', 'Scan', 'Assistente', 'Auto', 'Casa', 'Salute', 'Rubrica', 'I miei dati', 'Identità', 'Note', 'Pratiche']) assert.ok(await page.locator('.ppt-app', { hasText: n }).isVisible(), `${nome}: ${n}`);
    assert.equal(await page.locator('.ppt-app svg.pp-icona-colore').count(), 12, `${nome}: icone a colori`);
    await page.locator('.ppt-cons', { hasText: 'Auto: Revisione' }).waitFor();
    await page.locator('.ppt-cons', { hasText: 'Cambio gomme invernali' }).waitFor();
    await page.locator('.ppt-cons', { hasText: 'Ricevuta di prova' }).waitFor();
    assert.equal(await page.getByText('Referto paziente').count(), 0, `${nome}: niente documenti clinici`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: niente scorrimento di lato`);
    await page.screenshot({ path: `${out}/${nome}-home.png`, fullPage: true });

    await page.getByRole('button', { name: 'Tutte le app ›' }).click();
    assert.equal(await page.evaluate(() => window.startAperto), 1, `${nome}: «Tutte le app» apre Start`);
    await page.locator('.ppt-app', { hasText: 'Rubrica' }).click();
    await page.locator('.ppt-app', { hasText: 'Identità' }).click();

    await page.getByRole('searchbox', { name: 'Cerca in Personal' }).fill('gomme');
    await page.locator('.ppt-riga', { hasText: /^Gomme di prova/ }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Chiama Gomme di prova' }).getAttribute('href'), 'tel:0000000005');
    await page.locator('.ppt-riga', { hasText: 'Cambio gomme invernali' }).waitFor();
    await page.locator('.ppt-riga', { hasText: 'Fattura gomme di prova' }).waitFor();
    assert.equal(await page.getByText('Gomme paziente').count(), 0, `${nome}: ricerca senza documenti clinici`);
    assert.equal(await page.locator('.ppt-riga', { hasText: 'Idraulica di prova' }).count(), 0, `${nome}: solo chi c'entra`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: ricerca senza scorrimento di lato`);
    await page.screenshot({ path: `${out}/${nome}-cerca.png` });
    await page.locator('.ppt-riga', { hasText: 'Fattura gomme di prova' }).click();
    await page.getByRole('button', { name: 'Cancella la ricerca' }).click();
    await page.getByText('Aggiunte').waitFor();
    await page.locator('.ppt-dafare').click();

    const t = await page.evaluate(() => window.personaleTest);
    assert.deepEqual(t.aperti.map((x) => [x.tipo, x.id]), [['rubrica', null], ['documento', 'd3']]);
    assert.deepEqual(t.vai, [['documenti', 'personali'], ['dafare', null]]);
    assert.deepEqual(scritture, [], `${nome}: solo letture`);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('personal-home-telefono PASS (Pixel 7 chiaro e scuro, computer)');
} finally { await browser?.close(); server.kill(); }
