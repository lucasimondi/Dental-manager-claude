// CARTELLE-MIE: synthetic data only. Root with folders, create a folder, open «Casa», select a
// subfolder + a document, build a password ZIP (AES-256), download it and open it with the password.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-cartelle-mie'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], { stdio: 'ignore' });
const cart = (id, nome, padre_id, n_documenti, n_sottocartelle) => ({ id, nome, padre_id, colore: null, posizione: 0, creato_il: '2026-11-01T10:00:00Z', modificato_il: '2026-11-01T10:00:00Z', archiviata_il: null, n_documenti, n_sottocartelle });
const CARTELLE = [cart('casa', 'Casa', null, 2, 1), cart('utenze', 'Utenze', 'casa', 1, 1), cart('luce', 'Luce', 'utenze', 1, 0), cart('auto', 'Auto', null, 0, 0)];
const doc = (id, titolo) => ({ id, titolo, ente: 'Ente Prova', data_documento: '2026-10-01', email_data: '2026-10-01T09:00:00Z', importo: null, fascicolo: 'immobili', drive_file_id: `f-${id}`, nome_file_originale: `${id}.pdf`, mime_type: 'application/pdf', tag: [] });
const LINK = { casa: [doc('rogito', 'Rogito casa'), doc('imu', 'IMU 2026')], utenze: [doc('gas', 'Contratto gas')], luce: [doc('bol', 'Bolletta luce')] };
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5179')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true }); const page = await context.newPage(); const errors = []; const creati = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname === 'script.google.com') {
      const b = JSON.parse(req.postData() || '{}');
      return route.fulfill({ json: { ok: true, nome: `${b.drive_file_id}.pdf`, mime: 'application/pdf', dati: Buffer.from(`PDF FINTO ${b.drive_file_id}`).toString('base64') } });
    }
    if (u.hostname.endsWith('supabase.co')) {
      if (u.pathname.endsWith('/v_cartelle_mie')) return route.fulfill({ json: CARTELLE });
      if (u.pathname.endsWith('/cartelle_mie') && req.method() === 'POST') {
        const b = JSON.parse(req.postData()); creati.push(b);
        const nuova = cart(`n${creati.length}`, b.nome, b.padre_id, 0, 0); CARTELLE.push(nuova);
        return route.fulfill({ json: { id: nuova.id, nome: nuova.nome, padre_id: nuova.padre_id } });
      }
      if (u.pathname.endsWith('/cartelle_mie_documenti')) {
        const filtro = u.searchParams.get('cartella_id') || '';
        const ids = filtro.startsWith('eq.') ? [filtro.slice(3)] : filtro.replace(/^in\.\(|\)$/g, '').split(',').map((s) => s.replace(/"/g, ''));
        const righe = ids.flatMap((id) => (LINK[id] || []).map((d) => ({ cartella_id: id, aggiunto_il: '2026-11-01T10:00:00Z', documenti: d })));
        return route.fulfill({ json: righe });
      }
      return route.fulfill({ json: [] });
    }
    return route.abort();
  });
  await page.goto('http://127.0.0.1:5179/tests/visual/personal-cartelle-mie.html');
  await page.locator('.pp-mia-cartella', { hasText: 'Casa' }).waitFor();
  await page.screenshot({ path: `${out}/radice.png` });

  // Nuova cartella (foglio nella pagina, niente prompt del browser)
  await page.getByRole('button', { name: 'Nuova cartella' }).click();
  await page.getByLabel('Nome').fill('Commercialista 2026');
  await page.getByRole('button', { name: 'Crea', exact: true }).click();
  await page.waitForFunction(() => window.mieTest.messaggi.some((m) => m.includes('Commercialista 2026')));
  assert.deepEqual(creati[0], { nome: 'Commercialista 2026', padre_id: null });
  await page.locator('.pp-mia-cartella', { hasText: 'Commercialista 2026' }).waitFor();

  // Dentro «Casa»: sottocartella + documenti; selezione mista
  await page.locator('.pp-mia-cartella', { hasText: 'Casa' }).click();
  await page.getByRole('heading', { name: 'Casa' }).waitFor();
  await page.getByText('Rogito casa').waitFor();
  await page.screenshot({ path: `${out}/casa.png` });
  await page.getByRole('button', { name: 'Seleziona' }).click();
  await page.locator('.pp-mia-cartella', { hasText: 'Utenze' }).click();
  await page.getByRole('button', { name: /IMU 2026/ }).click();
  await page.getByText('2 scelte').waitFor();
  await page.screenshot({ path: `${out}/selezione.png` });
  await page.getByRole('toolbar').getByRole('button', { name: 'Invia' }).click();

  // ZIP con password AES-256
  await page.getByLabel('Nome dello ZIP').fill('Casa per il commercialista');
  await page.getByText('Proteggi con una password').click();
  await page.getByLabel('Password', { exact: true }).fill('Prova-2026');
  await page.getByLabel('Ripeti la password').fill('Prova-202');
  await page.getByText('Le due password non coincidono').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Prepara lo ZIP' }).isDisabled(), true);
  await page.getByLabel('Ripeti la password').fill('Prova-2026');
  await page.screenshot({ path: `${out}/password.png` });
  await page.getByRole('button', { name: 'Prepara lo ZIP' }).click();
  await page.getByText('Casa per il commercialista.zip pronto · con password').waitFor();
  await page.screenshot({ path: `${out}/pronto.png` });
  const [scaricato] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Scarica' }).click()]);
  assert.equal(scaricato.suggestedFilename(), 'Casa per il commercialista.zip');
  const percorso = `${out}/scaricato.zip`; await scaricato.saveAs(percorso);

  const { ZipReader, BlobReader, TextWriter, configure } = await import('@zip.js/zip.js');
  configure({ useWebWorkers: false });
  const blob = new Blob([await readFile(percorso)]);
  const lettore = new ZipReader(new BlobReader(blob), { password: 'Prova-2026' });
  const voci = await lettore.getEntries();
  const nomi = voci.filter((v) => !v.directory).map((v) => v.filename).sort();
  assert.deepEqual(nomi, ['IMU 2026.pdf', 'Utenze/Contratto gas.pdf', 'Utenze/Luce/Bolletta luce.pdf']);
  assert.ok(voci.filter((v) => !v.directory).every((v) => v.encrypted));
  assert.equal(await voci.find((v) => v.filename === 'IMU 2026.pdf').getData(new TextWriter()), 'PDF FINTO f-imu');
  await lettore.close();
  await assert.rejects(async () => { const l = new ZipReader(new BlobReader(blob), { password: 'sbagliata' }); const v = await l.getEntries(); await v.find((x) => !x.directory).getData(new TextWriter()); });

  const larga = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(larga, false, 'nessuno scorrimento orizzontale');
  assert.deepEqual(errors, []);
  assert.ok(!(await page.evaluate(() => window.mieTest.messaggi)).some((m) => m.startsWith('ERRORE')));
  console.log('personal-cartelle-mie PASS');
} finally { await browser?.close(); server.kill(); }
