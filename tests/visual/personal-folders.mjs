import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5193'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:5193/tests/fixtures/personal-folders.html')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true });
  await mkdir('tests/visual/results-personal-folders', { recursive: true });
  for (const width of [375, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, acceptDownloads: true });
    const reads = [], errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname !== 'script.google.com') return route.abort();
      const body = route.request().postDataJSON();
      assert.equal(body.token, 'synthetic-test-token');
      let result;
      if (body.azione === 'fascicolo_file') result = { ok: true, nome: 'test.txt', mime: 'text/plain', dati: btoa('Original synthetic text') };
      else if (body.azione === 'fascicolo_leggi') {
        reads.push(body.id);
        result = { ok: true, testo: `Fonte [[doc:${body.id}|Documento di prova]]: la data è 1 ottobre 2026.` };
      } else if (body.azione === 'fascicolo_rispondi') result = { ok: true, testo: 'La data è 1 ottobre 2026. [[doc:00000000-0000-0000-0000-000000000000|Documento di prova]]' };
      else if (body.azione === 'fascicolo_drive') result = { ok: true, link: 'https://drive.google.com/drive/folders/synthetic' };
      else throw new Error(`Unexpected operation ${body.azione}`);
      await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(result) });
    });
    await page.goto('http://127.0.0.1:5193/tests/fixtures/personal-folders.html');
    await page.getByRole('button', { name: '📁 Ente di prova' }).click();
    assert.match(await page.locator('#navigation').textContent(), /cartella/);
    await page.getByRole('button', { name: 'Prepara download completo' }).click();
    await page.getByText('12/12 originali inclusi', { exact: true }).waitFor();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Scarica ZIP', exact: true }).click();
    assert.equal((await downloadPromise).suggestedFilename(), 'Ente di prova.zip');
    await page.getByRole('button', { name: 'Sintetizza con AI' }).click();
    await page.getByText('12/12 originali analizzati', { exact: false }).waitFor();
    assert.equal(reads.length, 12);
    await page.getByRole('textbox', { name: 'Chiedi a questi documenti' }).fill('Qual è la data?');
    await page.getByRole('button', { name: 'Chiedi all’AI' }).click();
    await page.getByText('12/12 originali analizzati', { exact: false }).waitFor();
    assert.equal(reads.length, 24);
    await page.getByRole('button', { name: 'Organizza anche su Drive' }).click();
    await page.getByText('12/12 documenti organizzati su Drive.').waitFor();
    assert.equal(await page.getByRole('link', { name: 'Apri cartella su Drive' }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `tests/visual/results-personal-folders/${width}.png`, fullPage: true });
    await page.close();
    console.log(`PASS: folder export, AI, follow-up question, Drive, layout ${width}px`);
  }
} finally { await browser?.close(); server.kill('SIGTERM'); }
