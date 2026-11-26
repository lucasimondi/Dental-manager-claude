// RUBRICA, synthetic only: contacts grouped by category, search by problem («perdita lavandino» → idraulico), category
// filter, contact card (Chiama / WhatsApp, notes edited and saved), new contact with a reminder, reminders tab with
// «Fatto» moving a yearly reminder to next year, suggested reminders; the app opened on its own shows «Apri Personal».
// Pixel 7 light/dark and desktop 1280×800.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-rubrica'; await mkdir(out, { recursive: true });
const tra = (g) => new Date(Date.now() + g * 86400000).toISOString().slice(0, 10);
const RUBRICA = [
  { id: 'r1', nome: 'Idraulica di prova', referente: 'Mario', categorie: ['Idraulico'], telefono: '000 0000001', note: 'Ha rifatto lo scarico del bagno', interventi: [{ data: '2025-05-02', voce: 'Scarico bagno', importo: '180' }], preferito: true, voto: 5 },
  { id: 'r2', nome: 'Stufe di prova', categorie: ['Stufa e caldaia'], telefono: '000 0000002', note: 'Pulizia annuale della stufa a pellet', interventi: [] },
  { id: 'r3', nome: 'Elettricista di prova', categorie: ['Elettricista'], telefono: '000 0000003', interventi: [] },
  { id: 'r4', nome: 'Cartongesso di prova', categorie: ['Cartongessista'], interventi: [] },
  { id: 'r5', nome: 'Gomme di prova', categorie: ['Gommista'], telefono: '000 0000005', note: 'Gomme invernali in deposito', interventi: [] },
];
const PROMEMORIA = [
  { id: 'p1', contatto_id: 'r5', cosa: 'Cambio gomme invernali', data: tra(4), ripeti: '1a', avviso_giorni: 30 },
  { id: 'p2', contatto_id: 'r2', cosa: 'Manutenzione stufa', data: tra(200), ripeti: '1a', avviso_giorni: 30 },
];

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5188', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5188')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  { const p = await (await browser.newContext()).newPage(); await p.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.fulfill({ json: [] })));
    await p.goto('http://127.0.0.1:5188/tests/visual/personal-rubrica.html'); await p.waitForTimeout(5000); await p.context().close(); }
  for (const [nome, opz] of [['phone-light', { ...devices['Pixel 7'], colorScheme: 'light' }], ['phone-dark', { ...devices['Pixel 7'], colorScheme: 'dark' }], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
    const context = await browser.newContext({ ...opz, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] }); const page = await context.newPage(); const errors = []; const scritture = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        const body = req.postData() ? JSON.parse(req.postData()) : null;
        if (!['GET', 'HEAD'].includes(req.method())) scritture.push({ metodo: req.method(), tabella: u.pathname.split('/').pop(), q: u.search, body });
        const t = u.pathname.split('/').pop();
        if (req.method() === 'DELETE') return route.fulfill({ json: u.searchParams.get('id') ? { id: u.searchParams.get('id').replace('eq.', '') } : [] });
        if (t === 'rubrica') {
          if (req.method() === 'PATCH') return route.fulfill({ json: { id: 'x', modificato_il: new Date().toISOString() } });
          if (req.method() === 'POST') return route.fulfill({ status: 201, json: { id: 'nuovo', interventi: [], ...body } });
          return route.fulfill({ json: RUBRICA });
        }
        if (t === 'rubrica_promemoria') {
          if (req.method() === 'PATCH') { const id = u.searchParams.get('id').replace('eq.', ''); return route.fulfill({ json: { ...PROMEMORIA.find((p) => p.id === id), ...body } }); }
          if (req.method() === 'POST') return route.fulfill({ status: 201, json: { id: `np${scritture.length}`, ...body } });
          return route.fulfill({ json: PROMEMORIA });
        }
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5188/tests/visual/personal-rubrica.html');
    await page.getByRole('heading', { name: 'Idraulico' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: la pagina non scorre di lato`);
    assert.ok(await page.getByText('1 promemoria da guardare').isVisible(), `${nome}: avviso del cambio gomme`);
    await page.screenshot({ path: `${out}/${nome}-elenco.png` });
    // ricerca per problema
    await page.getByLabel('Cerca nella rubrica').fill('perdita lavandino');
    assert.equal(await page.locator('.pp-rb-riga').count(), 1, `${nome}: un solo risultato`);
    assert.ok(await page.getByRole('button', { name: /Idraulica di prova/ }).isVisible(), `${nome}: «perdita lavandino» trova l'idraulico`);
    await page.screenshot({ path: `${out}/${nome}-cerca.png` });
    await page.getByLabel('Cerca nella rubrica').fill('');
    // filtro per categoria
    await page.locator('.pp-rb-chips').getByRole('button', { name: /Gommista/ }).click();
    assert.deepEqual(await page.locator('.pp-rb-riga strong').allInnerTexts(), ['Gomme di prova'], `${nome}: filtro Gommista`);
    await page.locator('.pp-rb-chips').getByRole('button', { name: /Tutti/ }).click();
    // sincronizza con telefono e Google: un file .vcf con tutti i contatti
    await page.getByRole('button', { name: 'Sincronizza con telefono e Google' }).click();
    await page.screenshot({ path: `${out}/${nome}-sincronizza.png`, fullPage: true });
    const [scarico] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Salva sul telefono' }).click()]);
    const vcf = await (await import('node:fs/promises')).readFile(await scarico.path(), 'utf8');
    assert.equal((vcf.match(/BEGIN:VCARD/g) || []).length, RUBRICA.length, `${nome}: tutti i contatti nel file`);
    assert.match(vcf, /FN:Idraulica di prova\r\n/); assert.match(scarico.suggestedFilename(), /^rubrica-poliedron-\d{4}-\d{2}-\d{2}\.vcf$/);
    await page.getByRole('button', { name: 'Sincronizza con telefono e Google' }).click();
    // scheda
    await page.getByRole('button', { name: /Idraulica di prova/ }).click();
    const [uno] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'In rubrica' }).click()]);
    assert.equal(uno.suggestedFilename(), 'idraulica-di-prova.vcf', `${nome}: un contatto in rubrica`);
    assert.equal(await page.getByRole('link', { name: 'Chiama' }).first().getAttribute('href'), 'tel:0000000001');
    assert.ok(await page.getByRole('link', { name: 'WhatsApp' }).isVisible(), `${nome}: WhatsApp`);
    await page.screenshot({ path: `${out}/${nome}-scheda.png`, fullPage: true });
    await page.getByRole('button', { name: 'Modifica' }).click();
    await page.getByLabel('Note').fill('Bravo e veloce, chiamare la mattina');
    await page.waitForTimeout(1200);
    let patch = scritture.findLast((w) => w.tabella === 'rubrica' && w.metodo === 'PATCH');
    assert.equal(patch?.body?.note, 'Bravo e veloce, chiamare la mattina', `${nome}: le note si salvano da sole`);
    await page.getByRole('button', { name: 'Fatto', exact: true }).first().click();
    await page.getByRole('button', { name: 'Rubrica' }).first().click();
    // nuovo contatto con promemoria
    await page.getByRole('button', { name: 'Nuovo', exact: true }).click();
    await page.getByLabel('Nome o azienda').fill('Spazzacamino di prova');
    await page.locator('.pp-rb-cat').getByRole('button', { name: 'Stufa e caldaia' }).click();
    await page.getByLabel('Telefono').fill('000 0000009');
    await page.getByLabel('Promemoria').check();
    await page.getByLabel('Cosa').fill('Pulizia canna fumaria');
    await page.getByLabel('Data').fill(tra(120));
    await page.screenshot({ path: `${out}/${nome}-nuovo.png`, fullPage: true });
    await page.getByRole('button', { name: 'Salva contatto' }).click(); await page.waitForTimeout(600);
    const nuovo = scritture.find((w) => w.tabella === 'rubrica' && w.metodo === 'POST');
    assert.deepEqual(nuovo.body.categorie, ['Stufa e caldaia'], `${nome}: categoria salvata`);
    const pr = scritture.find((w) => w.tabella === 'rubrica_promemoria' && w.metodo === 'POST');
    assert.equal(pr.body.contatto_id, 'nuovo'); assert.equal(pr.body.ripeti, '1a'); assert.equal(pr.body.data, tra(120));
    assert.ok(await page.getByRole('heading', { name: 'Spazzacamino di prova' }).isVisible(), `${nome}: si apre la scheda nuova`);
    // promemoria: «Fatto» sposta all'anno dopo e segna l'intervento
    await page.getByRole('tab', { name: /Promemoria/ }).click();
    await page.locator('.pp-rb-prom', { hasText: 'Cambio gomme invernali' }).getByRole('button', { name: 'Fatto' }).waitFor();
    await page.screenshot({ path: `${out}/${nome}-promemoria.png`, fullPage: true });
    await page.locator('.pp-rb-prom', { hasText: 'Cambio gomme invernali' }).getByRole('button', { name: 'Fatto' }).click(); await page.waitForTimeout(600);
    const fatto = scritture.findLast((w) => w.tabella === 'rubrica_promemoria' && w.metodo === 'PATCH');
    const dopo = new Date(`${tra(4)}T12:00:00`); dopo.setFullYear(dopo.getFullYear() + 1);
    assert.equal(fatto.body.data, dopo.toISOString().slice(0, 10), `${nome}: il cambio gomme passa all'anno dopo`);
    const storico = scritture.findLast((w) => w.tabella === 'rubrica' && w.metodo === 'PATCH' && w.q.includes('r5'));
    assert.ok(storico?.body?.interventi?.some((r) => r.voce === 'Cambio gomme invernali'), `${nome}: entra nello storico del gommista`);
    // suggeriti
    await page.getByRole('button', { name: '+ Manutenzione stufa' }).count().then((n) => assert.equal(n, 0, `${nome}: un suggerimento già presente non si ripete`));
    await page.getByRole('button', { name: '+ Revisione caldaia' }).click();
    assert.equal(await page.getByLabel('Cosa').inputValue(), 'Revisione caldaia');
    assert.equal(await page.getByLabel('Chi chiamare').inputValue(), 'r2', `${nome}: propone chi fa la stufa`);
    // eliminazione con conferma: promemoria, poi contatto con i suoi promemoria
    await page.getByRole('button', { name: 'Annulla' }).click();
    await page.locator('.pp-rb-prom', { hasText: 'Manutenzione stufa' }).getByRole('button', { name: 'Modifica' }).click();
    await page.locator('.pp-rb-prom', { hasText: 'Manutenzione stufa' }).getByRole('button', { name: 'Elimina' }).click();
    await page.screenshot({ path: `${out}/${nome}-elimina-promemoria.png`, fullPage: true });
    await page.locator('.pp-rb-prom', { hasText: 'Manutenzione stufa' }).getByRole('button', { name: 'Elimina' }).click(); await page.waitForTimeout(500);
    assert.ok(scritture.some((w) => w.tabella === 'rubrica_promemoria' && w.metodo === 'DELETE' && w.q.includes('id=eq.p2')), `${nome}: promemoria eliminato`);
    assert.equal(await page.locator('.pp-rb-prom', { hasText: 'Manutenzione stufa' }).count(), 0);
    await page.getByRole('tab', { name: /Contatti/ }).click();
    await page.getByRole('button', { name: /Gomme di prova/ }).click();
    await page.getByRole('button', { name: 'Elimina contatto' }).click();
    assert.ok(await page.getByText('Eliminare definitivamente «Gomme di prova»? Non si può annullare.').isVisible(), `${nome}: chiede conferma`);
    await page.screenshot({ path: `${out}/${nome}-elimina-contatto.png`, fullPage: true });
    await page.locator('.pp-rb-elimina').getByRole('button', { name: 'Elimina' }).click(); await page.waitForTimeout(500);
    assert.ok(scritture.some((w) => w.tabella === 'rubrica_promemoria' && w.metodo === 'DELETE' && w.q.includes('contatto_id=eq.r5')), `${nome}: anche i suoi promemoria`);
    assert.ok(scritture.some((w) => w.tabella === 'rubrica' && w.metodo === 'DELETE' && w.q.includes('id=eq.r5')), `${nome}: contatto eliminato`);
    assert.equal(await page.getByRole('button', { name: /Gomme di prova/ }).count(), 0, `${nome}: sparito dall'elenco`);
    // app a sé
    await page.goto('http://127.0.0.1:5188/tests/visual/personal-rubrica.html?sola=1');
    await page.getByRole('link', { name: 'Apri Personal' }).waitFor();
    await page.getByRole('heading', { name: 'Idraulico' }).waitFor();
    await page.screenshot({ path: `${out}/${nome}-a-se.png` });
    assert.deepEqual(errors, [], `${nome}: nessun errore`);
    await context.close();
  }
  console.log('personal-rubrica: PASS');
} finally { await browser?.close(); server.kill(); }
