// PERSONALE-HOME: synthetic data only. Home «Personale» → Conti (prossima scadenza, schede).
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-personale'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], { stdio: 'ignore' });
const oggi = new Date(); const tra = (g) => { const x = new Date(oggi); x.setDate(x.getDate() + g); return x.toISOString().slice(0, 10); };
const mese = tra(0).slice(0, 7);
const PROMEMORIA = [{ id: 'a1', stato: 'aperto', priorita: 'alta', titolo: 'Sollecito prova' }, { id: 'a2', stato: 'aperto', priorita: 'media', titolo: 'Rispondere prova' }, { id: 'a3', stato: 'aperto', priorita: 'bassa', titolo: 'Rinnovo prova' }];
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
    const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: tema }); const page = await context.newPage(); const errors = []; const scritture = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        if (req.method() !== 'GET') scritture.push(u.pathname);
        if (u.pathname.endsWith('/promemoria_azioni')) return route.fulfill({ json: PROMEMORIA });
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
    assert.match(await page.locator('.pps-scan').getAttribute('href'), /scan\/$/);
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
    const larga = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(larga, false, 'nessuno scorrimento orizzontale');
    assert.deepEqual(scritture, [], 'solo letture');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('personal-personale PASS');
} finally { await browser?.close(); server.kill(); }
