// APP-AUTO-CASA-SALUTE, synthetic only: Auto e motori with two vehicles side by side (page never scrolls sideways),
// scadenze coloured, a date typed and saved, a photo added (reduced JPEG saved), a «Tagliando» with km added to the
// register updates «Km attuali», a new vehicle created; Casa and Salute render; the app opened on its own (Home
// icon) shows the bar with «Apri Personal». Pixel 7 light/dark and desktop 1280×800.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-app-cose'; await mkdir(out, { recursive: true });
const C = (gruppo, etichetta, valore, tipo = 'testo', avviso = false) => ({ gruppo, etichetta, valore, tipo, avviso });
const tra = (g) => new Date(Date.now() + g * 86400000).toISOString().slice(0, 10);
const DOC = (id, titolo, tag) => ({ id, titolo, fascicolo: 'veicoli', data_documento: '2026-10-12', mime_type: 'application/pdf', tag, drive_url: 'https://drive.google.com/file/d/x/view' });
const COSE = {
  auto: [
    { id: 'v1', ambito: 'auto', tipo: 'auto', nome: 'Utilitaria di prova', descrizione: 'Grigia', colore: 'ambra', ordine: 0, foto: null,
      campi: [C('veicolo', 'Marca e modello', 'Marca Finta 1.2'), C('veicolo', 'Targa', 'AA000AA'), C('veicolo', 'Km attuali', '99500', 'numero'),
        C('assicurazione', 'Compagnia', 'Assicurazioni Esempio'), C('assicurazione', 'Numero polizza', 'P-0000'), C('assicurazione', 'Scadenza assicurazione', tra(12), 'data', true),
        C('scadenze', 'Scadenza bollo', tra(-5), 'data', true), C('scadenze', 'Prossima revisione', '', 'data', true),
        C('manutenzione', 'Ultimo tagliando', '', 'data'), C('manutenzione', 'Km ultimo tagliando', '', 'numero'), C('manutenzione', 'Prossimo tagliando a km', '100000', 'numero')],
      registro: [{ data: '2025-10-01', voce: 'Cambio gomme', importo: '80' }], persone: [{ ruolo: 'Meccanico', nome: 'Officina Finta', telefono: '000 000000' }], note: null },
    { id: 'v2', ambito: 'auto', tipo: 'moto', nome: 'Moto di prova', descrizione: null, colore: 'blu', ordine: 1, foto: null, campi: [C('veicolo', 'Targa', 'XX00000')], registro: [], persone: [], note: null },
  ],
  casa: [{ id: 'c1', ambito: 'casa', tipo: 'casa', nome: 'Casa di prova', descrizione: 'Residenza', colore: 'blu', ordine: 0, foto: null,
    campi: [C('immobile', 'Indirizzo', 'Via Esempio 1, Città'), C('utenze', 'POD', 'IT000E00000000'), C('manutenzione', 'Revisione caldaia', tra(20), 'data', true)], registro: [], persone: [{ ruolo: 'Idraulico', nome: 'Idraulico Finto' }], note: null }],
  salute: [{ id: 's1', ambito: 'salute', tipo: 'persona', nome: 'Persona di prova', descrizione: null, colore: 'rosa', ordine: 0, foto: null,
    campi: [C('persona', 'Gruppo sanguigno', '0+'), C('medico', 'Medico di base', 'Dott. Finto'), C('medico', 'Tessera sanitaria: scadenza', tra(200), 'data', true), C('clinica', 'Allergie', 'Nessuna nota')], registro: [], persone: [], note: null }],
};
// Una foto PNG finta (gradiente) da caricare.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64');
await writeFile(`${out}/foto.png`, png);

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5187', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5187')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  { const p = await (await browser.newContext()).newPage(); await p.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.fulfill({ json: [] })));
    await p.goto('http://127.0.0.1:5187/tests/visual/personal-app-cose.html'); await p.waitForTimeout(5000); await p.context().close(); }
  for (const [nome, opz] of [['phone-light', { ...devices['Pixel 7'], colorScheme: 'light' }], ['phone-dark', { ...devices['Pixel 7'], colorScheme: 'dark' }], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
    const context = await browser.newContext({ ...opz, permissions: ['clipboard-read', 'clipboard-write'] }); const page = await context.newPage(); const errors = []; const scritture = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        const body = req.postData() ? JSON.parse(req.postData()) : null;
        if (!['GET', 'HEAD'].includes(req.method())) scritture.push({ metodo: req.method(), q: u.search, body });
        if (u.pathname.endsWith('/mie_cose') && req.method() === 'PATCH') return route.fulfill({ json: { id: 'x', modificato_il: new Date().toISOString() } });
        if (u.pathname.endsWith('/mie_cose') && req.method() === 'POST') return route.fulfill({ status: 201, json: { id: 'nuova', ...body } });
        if (u.pathname.endsWith('/mie_cose')) { const a = u.searchParams.get('ambito')?.replace('eq.', ''); return route.fulfill({ json: COSE[a] || [] }); }
        if (u.pathname.endsWith('/documenti')) {
          if (req.method() === 'PATCH') return route.fulfill({ json: { id: 'd9', ...body } });
          if (u.searchParams.get('tag')?.startsWith('cs.')) return route.fulfill({ json: u.searchParams.get('tag').includes('v1') ? [DOC('d1', 'Certificato assicurazione – Utilitaria AA000AA', ['cosa:v1', 'allegato:assicurazione'])] : [] });
          if (u.searchParams.get('or')) return route.fulfill({ json: [DOC('d9', 'Libretto di circolazione AA000AA', [])] });
          if (u.searchParams.get('id')) return route.fulfill({ json: { id: 'd9', tag: ['vecchio'], fascicolo: 'veicoli' } });
        }
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5187/tests/visual/personal-app-cose.html?ambito=auto');
    await page.getByRole('heading', { name: 'Utilitaria di prova' }).waitFor();
    const misure = await page.evaluate(() => { const s = document.querySelector('.pp-md-striscia'); return { pagina: document.documentElement.scrollWidth - innerWidth, striscia: s.scrollWidth - s.clientWidth }; });
    assert.ok(misure.pagina <= 0, `${nome}: la pagina non scorre di lato (${misure.pagina})`);
    assert.ok(misure.striscia > 0, `${nome}: le schede scorrono in orizzontale`);
    assert.ok(await page.locator('.pp-ac-scad.scaduta', { hasText: 'Scadenza bollo' }).isVisible(), `${nome}: bollo scaduto in rosso`);
    assert.ok(await page.locator('.pp-ac-scad.presto', { hasText: 'Scadenza assicurazione' }).isVisible(), `${nome}: assicurazione in scadenza`);
    assert.ok(await page.locator('.pp-ac-scad', { hasText: 'tra 500 km' }).isVisible(), `${nome}: tagliando a km`);
    await page.screenshot({ path: `${out}/${nome}-auto.png` });
    // data scritta e salvata
    await page.locator('#ac-v-v1-7').fill(tra(300)); await page.waitForTimeout(1200);
    let patch = scritture.findLast((w) => w.metodo === 'PATCH' && w.q.includes('v1'));
    assert.ok(patch && patch.body.campi[7].valore === tra(300), `${nome}: la data della revisione si salva`);
    // foto
    await page.locator('[data-scheda="v1"] .pp-ac-foto input[type=file]').setInputFiles(`${out}/foto.png`); await page.waitForTimeout(1000);
    patch = scritture.findLast((w) => w.metodo === 'PATCH' && w.body?.foto);
    assert.ok(patch && /^data:image\/jpeg;base64,/.test(patch.body.foto), `${nome}: la foto si salva ridotta in JPEG`);
    assert.ok(await page.locator('[data-scheda="v1"] .pp-ac-foto img').isVisible(), `${nome}: la foto si vede`);
    // tagliando nel registro → km attuali aggiornati
    await page.locator('[data-scheda="v1"]').getByRole('button', { name: '+ Aggiungi tagliando o intervento' }).click();
    await page.locator('[data-scheda="v1"] [aria-label="Cosa"]').fill('Tagliando');
    await page.locator('[data-scheda="v1"] [aria-label="Km"]').fill('100200');
    await page.locator('[data-scheda="v1"] [aria-label="Spesa"]').fill('250');
    await page.locator('[data-scheda="v1"]').getByRole('button', { name: 'Salva' }).click(); await page.waitForTimeout(800);
    patch = scritture.findLast((w) => w.metodo === 'PATCH' && w.body?.registro);
    assert.ok(patch.body.registro.some((r) => r.voce === 'Tagliando' && r.km === '100200'), `${nome}: il tagliando entra nel registro`);
    assert.equal(patch.body.campi.find((c) => c.etichetta === 'Km attuali').valore, '100200', `${nome}: km attuali aggiornati`);
    assert.equal(patch.body.campi.find((c) => c.etichetta === 'Km ultimo tagliando').valore, '100200');
    await page.locator('[data-scheda="v1"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${nome}-auto-dopo.png`, fullPage: true });
    // documenti della scheda: collegato, suggerito dall'archivio (per targa), Scan con la scheda nelle opzioni
    const v1 = page.locator('[data-scheda="v1"]');
    assert.ok(await v1.getByText('Certificato assicurazione – Utilitaria AA000AA').isVisible(), `${nome}: documento collegato visibile`);
    await v1.getByRole('radio', { name: 'Libretto' }).click();
    await v1.getByRole('button', { name: 'Collega' }).click(); await page.waitForTimeout(700);
    const lega = scritture.findLast((w) => w.metodo === 'PATCH' && w.q.includes('d9'));
    assert.deepEqual(lega?.body?.tag, ['vecchio', 'cosa:v1', 'allegato:libretto'], `${nome}: il libretto si collega con i tag`);
    await v1.getByRole('button', { name: 'Scan' }).click();
    const sc = await page.evaluate(() => window.acTest.aperte.at(-1));
    assert.equal(sc.tipo, 'scansione'); assert.deepEqual(sc.opzioni.cosa, { id: 'v1', tipo: 'Libretto' }); assert.equal(sc.opzioni.fascicolo, 'veicoli');
    await v1.locator('.pp-ac-allegati').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${nome}-documenti.png` });
    // documenti → pagina «cosa» di Personal
    await page.getByRole('button', { name: 'Documenti' }).click();
    assert.deepEqual(await page.evaluate(() => window.acTest.aperte.at(-1)), { tipo: 'cosa', id: 'auto' });
    // nuovo veicolo
    await page.getByRole('button', { name: '+ Moto' }).click(); await page.waitForTimeout(800);
    assert.ok(scritture.some((w) => w.metodo === 'POST' && w.body.ambito === 'auto' && w.body.tipo === 'moto' && w.body.campi.some((c) => c.etichetta === 'Scadenza bollo' && c.avviso)), `${nome}: si aggiunge una moto`);
    for (const a of ['casa', 'salute']) {
      await page.goto(`http://127.0.0.1:5187/tests/visual/personal-app-cose.html?ambito=${a}`);
      await page.locator('.pp-ac-scheda h3').first().waitFor();
      await page.screenshot({ path: `${out}/${nome}-${a}.png` });
    }
    await page.getByRole('button', { name: 'Referti ed esami' }).click();
    assert.deepEqual(await page.evaluate(() => window.acTest.aperte.at(-1)), { tipo: 'salute' });
    await page.goto('http://127.0.0.1:5187/tests/visual/personal-app-cose.html?ambito=casa&sola=1');
    await page.getByRole('link', { name: 'Apri Personal' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Documenti' }).count(), 0, `${nome}: l'app a sé non apre pagine di Personal`);
    await page.screenshot({ path: `${out}/${nome}-casa-a-se.png` });
    assert.deepEqual(errors, [], `${nome}: nessun errore`);
    await context.close();
  }
  console.log('personal-app-cose: PASS');
} finally { await browser?.close(); server.kill(); }
