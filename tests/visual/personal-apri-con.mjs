// APRI-CON, synthetic only: tapping a document opens its page with the choice (Gestore PDF, Drive, other
// apps) instead of jumping straight into the PDF manager; «Compila» among the PDF tools.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-apri-con'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5182', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5182')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const schema of ['light', 'dark']) {
    const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: schema }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co') && u.pathname.endsWith('/documenti')) return route.fulfill({ json: { id: '00000000-0000-4000-8000-000000000001', titolo: 'Modulo adesione Fornitore Prova', fascicolo: 'utenze', mime_type: 'application/pdf', nome_file_originale: 'modulo.pdf', drive_file_id: 'f1', drive_url: 'https://drive.google.com/file/d/f1/view', gmail_message_id: '18c', tag: [], dati_estratti: {}, scadenze: [], pratica: null } });
      if (u.hostname.endsWith('supabase.co')) return route.fulfill({ json: [] });
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5182/tests/visual/personal-apri-con.html');
    await page.getByRole('button', { name: 'Apri nel Gestore PDF' }).waitFor();
    assert.equal(await page.locator('.pdf-manager').count(), 0, 'the PDF manager does not open by itself');
    assert.equal(await page.getByRole('link', { name: 'Apri in Drive' }).getAttribute('href'), 'https://drive.google.com/file/d/f1/view');
    await page.getByRole('button', { name: 'Apri con altre app…' }).waitFor();
    for (const t of ['Firma', 'Compila', 'Modifica', 'Pagine']) await page.getByRole('button', { name: t, exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll');
    await page.screenshot({ path: `${out}/scheda-${schema}.png` });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('personal-apri-con PASS Pixel 7 light/dark: Gestore PDF · Drive · altre app, tools with Compila, no auto-open.');
} finally { await browser?.close(); server.kill(); }
