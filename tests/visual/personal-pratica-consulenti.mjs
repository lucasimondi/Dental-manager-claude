// PRATICHE-CONSULENTI — Pixel 7 light/dark, synthetic data: pratica tabs Consulenti and Email; add a consultant
// (suggested from the scheda), contacts as links, «Togli» never deletes; email threads open Gmail.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-pratica-consulenti'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5189', '--strictPort'], { stdio: 'ignore' });
const EMAIL = [
  { thread_id: 't1', oggetto: 'Re: aggiornamento procedura esecutiva e prossima udienza davanti al giudice', mittenti: ['"Avv. Prova Uno" <uno@studio-prova.example>'], ultima: '2026-11-12T10:00:00Z', n_documenti: 3, documento_email: 'd-email', in_pratica: true, da_consulente: true },
  { thread_id: 't2', oggetto: 'Parcella', mittenti: ['uno@studio-prova.example'], ultima: '2026-10-01T10:00:00Z', n_documenti: 1, documento_email: null, in_pratica: false, da_consulente: true },
];
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5189')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const schema of ['light', 'dark']) {
    const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: schema }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let consulenti = []; const scritture = [];
    await page.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        if (u.pathname.endsWith('/rpc/email_pratica')) return route.fulfill({ json: EMAIL });
        if (u.pathname.endsWith('/pratiche_schede')) return route.fulfill({ json: { pratica_id: 'p-uno', parti: [{ nome: 'Avv. Prova Uno', ruolo: 'avvocato di Luca' }, { nome: 'Banca Prova', ruolo: 'creditore' }] } });
        if (u.pathname.endsWith('/pratiche_consulenti')) {
          const m = req.method();
          if (m === 'GET') return route.fulfill({ json: consulenti });
          const body = req.postDataJSON(); scritture.push([m, body]);
          if (m === 'POST') { const r = { id: 'c1', creato_il: 'x', ...body }; consulenti = [r]; return route.fulfill({ json: r }); }
          if (m === 'PATCH') { if (body.tolto_il) consulenti = []; return route.fulfill({ json: { id: 'c1' } }); }
          return route.fulfill({ status: 405, json: {} });
        }
        if (u.pathname.endsWith('/pratiche')) return route.fulfill({ json: { id: 'p-uno', titolo: 'Fornitore Prova', fascicolo: 'legale', stato: 'aperta', scadenze: [] } });
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5189/tests/visual/personal-pratica-consulenti.html');
    await page.getByRole('tab', { name: /^Consulenti/ }).click();
    await page.getByText('Nessun consulente').waitFor();
    await page.getByRole('button', { name: /\+ Avv\. Prova Uno · Avvocato/ }).click();
    assert.equal(await page.getByLabel('Nome e cognome').inputValue(), 'Avv. Prova Uno');
    await page.getByLabel('Telefono').fill('333 123 4567');
    await page.getByLabel('Email', { exact: true }).fill('Uno@Studio-Prova.example');
    await page.getByLabel('Studio o società').fill('Studio Legale Prova');
    await page.getByRole('button', { name: 'Salva' }).click();
    await page.locator('.pp-consulente').first().waitFor();
    assert.equal(scritture[0][0], 'POST'); assert.equal(scritture[0][1].email, 'uno@studio-prova.example'); assert.equal(scritture[0][1].pratica_id, 'p-uno');
    assert.equal(await page.locator('.pp-consulente a[href^="tel:"]').first().getAttribute('href'), 'tel:3331234567');
    assert.equal(await page.locator('.pp-consulente a[href*="wa.me"]').getAttribute('href'), 'https://wa.me/393331234567');
    assert.match(await page.getByRole('tab', { name: /^Consulenti/ }).innerText(), /1/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll (consulenti)');
    await page.screenshot({ path: `${out}/consulenti-${schema}.png`, fullPage: true });
    await page.getByRole('tab', { name: /^Email/ }).click();
    await page.locator('.pp-email-pratica li').first().waitFor();
    assert.equal(await page.locator('.pp-email-pratica li').count(), 2);
    assert.equal(await page.locator('.pp-email-riga').first().getAttribute('href'), 'https://mail.google.com/mail/u/0/#all/t1');
    assert.match(await page.locator('.pp-email-pratica li').nth(1).innerText(), /non ancora nella pratica/i);
    assert.match(decodeURIComponent(await page.getByRole('link', { name: /Tutte le email con i consulenti/ }).getAttribute('href')), /from:uno@studio-prova\.example OR to:uno@studio-prova\.example/);
    await page.getByRole('button', { name: 'Leggi qui' }).click();
    assert.deepEqual(await page.evaluate(() => window.consulentiTest.aperto.at(-1)), { tipo: 'documento', id: 'd-email' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll (email)');
    await page.screenshot({ path: `${out}/email-${schema}.png`, fullPage: true });
    await page.getByRole('tab', { name: /^Consulenti/ }).click();
    await page.getByRole('button', { name: 'Togli' }).click();
    await page.getByRole('button', { name: 'Conferma: togli' }).click();
    await page.getByText('Nessun consulente').waitFor();
    assert.ok(scritture.some(([m, b]) => m === 'PATCH' && b.tolto_il), '«Togli» marks tolto_il');
    assert.ok(!scritture.some(([m]) => m === 'DELETE'));
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('personal-pratica-consulenti PASS Pixel 7 light/dark: consultant from scheda, contacts, email threads, Togli without delete.');
} finally { await browser?.close(); server.kill(); }
