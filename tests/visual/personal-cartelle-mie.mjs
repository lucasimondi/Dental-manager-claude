// CARTELLE-MIE + SCRIVANIA: synthetic data only, real touch drags (CDP) on a Pixel 7.
// File on file → new folder (named after the common ente), file on folder → moved in, «Porta fuori»,
// long press without moving → selection, then a password ZIP (AES-256) opened again with the password.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-cartelle-mie'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], { stdio: 'ignore' });
const cart = (id, nome, padre_id) => ({ id, nome, padre_id, colore: null, posizione: 0, creato_il: '2026-11-01T10:00:00Z', modificato_il: '2026-11-01T10:00:00Z', archiviata_il: null });
const CARTELLE = [cart('casa', 'Casa', null), cart('utenze', 'Utenze', 'casa'), cart('luce', 'Luce', 'utenze'), cart('auto', 'Auto', null)];
const doc = (id, titolo, ente = 'Ente Prova') => ({ id, titolo, ente, data_documento: '2026-10-01', email_data: '2026-10-01T09:00:00Z', importo: null, fascicolo: 'immobili', drive_file_id: `f-${id}`, nome_file_originale: `${id}.pdf`, mime_type: 'application/pdf', tag: [] });
const TUTTI = { rogito: doc('rogito', 'Rogito casa'), imu: doc('imu', 'IMU 2026'), gas: doc('gas', 'Contratto gas'), bol: doc('bol', 'Bolletta luce'),
  pol: doc('pol', 'Polizza auto', 'Assicurazioni Prova'), b1: doc('b1', 'Bolletta ottobre', 'Enel'), b2: doc('b2', 'Bolletta novembre', 'Enel') };
const LINK = { casa: ['rogito', 'imu'], utenze: ['gas'], luce: ['bol'], auto: [] };
let SCRIVANIA = ['pol', 'b1', 'b2'];
const vista = () => CARTELLE.map((c) => ({ ...c, n_documenti: (LINK[c.id] || []).length, n_sottocartelle: CARTELLE.filter((s) => s.padre_id === c.id).length }));
const sposta = (ids, da, a) => {
  if (a) LINK[a] = [...new Set([...(LINK[a] || []), ...ids])]; else SCRIVANIA = [...new Set([...SCRIVANIA, ...ids])];
  if (da) LINK[da] = LINK[da].filter((x) => !ids.includes(x)); else SCRIVANIA = SCRIVANIA.filter((x) => !ids.includes(x));
};
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5179')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true }); const page = await context.newPage(); const errors = []; const chiamate = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname === 'script.google.com') {
      const b = JSON.parse(req.postData() || '{}');
      return route.fulfill({ json: { ok: true, nome: `${b.drive_file_id}.pdf`, mime: 'application/pdf', dati: Buffer.from(`PDF FINTO ${b.drive_file_id}`).toString('base64') } });
    }
    if (u.hostname.endsWith('supabase.co')) {
      const p = u.pathname;
      if (p.endsWith('/v_cartelle_mie')) return route.fulfill({ json: vista() });
      if (p.endsWith('/cartelle_mie_scrivania')) return route.fulfill({ json: SCRIVANIA.map((id) => ({ aggiunto_il: '2026-11-01T10:00:00Z', documenti: TUTTI[id] })) });
      if (p.endsWith('/rpc/sposta_documenti_mie')) { const b = JSON.parse(req.postData()); chiamate.push(['sposta', b]); sposta(b.p_documenti, b.p_da, b.p_a); return route.fulfill({ json: b.p_documenti.length }); }
      if (p.endsWith('/rpc/raggruppa_documenti_mie')) {
        const b = JSON.parse(req.postData()); chiamate.push(['raggruppa', b]);
        const id = `n${CARTELLE.length}`; CARTELLE.push(cart(id, b.p_nome, b.p_dove)); LINK[id] = []; sposta(b.p_documenti, b.p_dove, id);
        return route.fulfill({ json: id });
      }
      if (p.endsWith('/cartelle_mie') && req.method() === 'PATCH') {
        const b = JSON.parse(req.postData()); chiamate.push(['rinomina', b]);
        const id = (u.searchParams.get('id') || '').replace(/^eq\./, ''); const c = CARTELLE.find((x) => x.id === id); if (c) c.nome = b.nome;
        return route.fulfill({ json: { id, nome: b.nome } });
      }
      if (p.endsWith('/cartelle_mie_documenti')) {
        const filtro = u.searchParams.get('cartella_id') || '';
        const ids = filtro.startsWith('eq.') ? [filtro.slice(3)] : filtro.replace(/^in\.\(|\)$/g, '').split(',').map((s) => s.replace(/"/g, ''));
        return route.fulfill({ json: ids.flatMap((id) => (LINK[id] || []).map((d) => ({ cartella_id: id, aggiunto_il: '2026-11-01T10:00:00Z', documenti: TUTTI[d] }))) });
      }
      return route.fulfill({ json: [] });
    }
    return route.abort();
  });
  const cdp = await context.newCDPSession(page);
  const centro = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  // Tieni premuto, poi trascina fino al bersaglio (calcolato dopo la presa) e lascia.
  const trascina = async (da, verso, { foto } = {}) => {
    const a = await centro(da);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await page.waitForTimeout(550);
    if (!verso) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(400); return; }
    const b = await centro(typeof verso === 'function' ? verso() : verso);
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10 }] });
    await page.waitForTimeout(80);
    if (foto) await page.screenshot({ path: `${out}/${foto}.png` });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
  };
  const icona = (nome) => page.locator(`.pp-icona-voce[aria-label="${nome}"]`);

  await page.goto('http://127.0.0.1:5179/tests/visual/personal-cartelle-mie.html');
  await icona('Polizza auto').waitFor();
  await page.screenshot({ path: `${out}/scrivania.png` });

  // 1) file sopra file = nuova cartella col nome dell'ente comune
  await trascina(icona('Bolletta ottobre'), icona('Bolletta novembre'), { foto: 'trascina-file-su-file' });
  await page.getByText('Nuova cartella: dai un nome').waitFor();
  assert.deepEqual(chiamate.at(-1), ['raggruppa', { p_documenti: ['b1', 'b2'], p_dove: null, p_nome: 'Enel' }]);
  assert.equal(await page.getByRole('textbox', { name: 'Nome' }).inputValue(), 'Enel');
  await page.getByRole('textbox', { name: 'Nome' }).fill('Luce Enel');
  await page.getByRole('button', { name: 'Fatto' }).click();
  await icona('Cartella Luce Enel').waitFor();
  assert.deepEqual(chiamate.at(-1)[0], 'rinomina');
  assert.equal(await icona('Bolletta ottobre').count(), 0);

  // 2) file sopra cartella = dentro
  await trascina(icona('Polizza auto'), icona('Cartella Auto'));
  await page.waitForFunction(() => window.mieTest.messaggi.some((m) => m.includes('«Auto»')));
  assert.deepEqual(chiamate.at(-1), ['sposta', { p_documenti: ['pol'], p_da: null, p_a: 'auto' }]);

  // 3) dentro «Casa»: «Porta fuori» porta IMU sulla scrivania
  await icona('Cartella Casa').click();
  await page.getByRole('heading', { name: 'Casa' }).waitFor();
  await icona('IMU 2026').waitFor();
  await trascina(icona('IMU 2026'), () => page.locator('.pp-mie-fuori'), { foto: 'trascina-fuori' });
  await page.waitForFunction(() => window.mieTest.messaggi.some((m) => m.includes('«Le mie cartelle»')));
  assert.deepEqual(chiamate.at(-1), ['sposta', { p_documenti: ['imu'], p_da: 'casa', p_a: null }]);
  await icona('IMU 2026').waitFor({ state: 'detached' });

  // 4) tieni premuto e lascia senza muovere = selezione
  await trascina(icona('Cartella Utenze'), null);
  await page.getByText('1 scelta').waitFor();
  await icona('Rogito casa').click();
  await page.getByText('2 scelte').waitFor();
  await page.screenshot({ path: `${out}/selezione.png` });
  await page.getByRole('toolbar').getByRole('button', { name: 'Invia' }).click();
  await page.getByLabel('Nome dello ZIP').fill('Casa per il commercialista');
  await page.getByText('Proteggi con una password').click();
  await page.getByLabel('Password', { exact: true }).fill('Prova-2026');
  await page.getByLabel('Ripeti la password').fill('Prova-2026');
  await page.getByRole('button', { name: 'Prepara lo ZIP' }).click();
  await page.getByText('Casa per il commercialista.zip pronto · con password').waitFor();
  const [scaricato] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Scarica' }).click()]);
  const percorso = `${out}/scaricato.zip`; await scaricato.saveAs(percorso);
  const { ZipReader, BlobReader, configure } = await import('@zip.js/zip.js');
  configure({ useWebWorkers: false });
  const lettore = new ZipReader(new BlobReader(new Blob([await readFile(percorso)])), { password: 'Prova-2026' });
  const voci = await lettore.getEntries();
  assert.deepEqual(voci.filter((v) => !v.directory).map((v) => v.filename).sort(), ['Rogito casa.pdf', 'Utenze/Contratto gas.pdf', 'Utenze/Luce/Bolletta luce.pdf']);
  assert.ok(voci.filter((v) => !v.directory).every((v) => v.encrypted));
  await lettore.close();

  const larga = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(larga, false, 'nessuno scorrimento orizzontale');
  assert.deepEqual(errors, []);
  assert.ok(!(await page.evaluate(() => window.mieTest.messaggi)).some((m) => m.startsWith('ERRORE')));
  console.log('personal-cartelle-mie PASS');
} finally { await browser?.close(); server.kill(); }
