// POL-VITA-ORDINA fase 3b — barra di avanzamento dello spostamento automatico su TELEFONO (375×812, chiaro e scuro),
// dati sintetici. Pausa/Riprendi chiamano lo script (intercettato: nessuna rete vera). Screenshot in docs/screenshots/pol-vita-ordina/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = 'docs/screenshots/pol-vita-ordina'; await mkdir(out, { recursive: true });
const PORTA = 5187;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const colore of ['light', 'dark']) {
    const nome = colore === 'light' ? 'chiaro' : 'scuro';
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: colore });
    page.on('pageerror', (e) => { throw e; });
    const script = [];
    await page.route('**/*', (r) => {
      const u = new URL(r.request().url());
      if (u.hostname === '127.0.0.1') return r.continue();
      if (u.hostname === 'script.google.com') {
        script.push(JSON.parse(r.request().postData() || '{}'));
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      }
      return r.abort();
    });
    // Sessione finta nella memoria del client Supabase (solo per avere un token da mandare allo script intercettato).
    const { ARCHIVIO_STORAGE_KEY } = await import('../../personal/src/lib/archivioConfig.js');
    await page.addInitScript(([k]) => {
      const scade = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem(k, JSON.stringify({ access_token: 'tok-finto', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: scade,
        user: { id: '00000000-0000-4000-8000-000000000001', email: 'proprietario@example.com', aud: 'authenticated', role: 'authenticated' } }));
    }, [ARCHIVIO_STORAGE_KEY]);
    await page.goto(`http://127.0.0.1:${PORTA}/tests/visual/personal-riordino.html?giro=1`);
    const barra = page.locator('.rr-avanzamento');
    await barra.waitFor();
    // in alto, prima del riepilogo
    assert.equal(await page.locator('.rr-vista > section').first().getAttribute('aria-label'), 'Avanzamento dello spostamento su Drive');
    const testo = await barra.innerText();
    assert.match(testo, /3 di 5 spostati \(60%\)/);
    assert.match(testo, /2 da spostare/);
    assert.match(testo, /Errori: 4 · 1 fermi dopo 3 tentativi/);
    assert.match(testo, /ultimo giro/);
    assert.match(testo, /In corso: un giro ogni 5 minuti/);
    assert.equal(await barra.locator('.rr-barra span').evaluate((e) => e.style.width), '60%');
    // con lo script acceso il tasto manuale «Sposta i prossimi» non c'è
    assert.equal(await page.getByRole('button', { name: /Sposta i prossimi/ }).count(), 0);
    await barra.getByRole('button', { name: /Vedi i file fermi/ }).tap();
    assert.match(await barra.locator('.rr-fermi').innerText(), /File nel cestino di Drive/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'nessuno sforamento orizzontale');
    await page.screenshot({ path: `${out}/05-avanzamento-${nome}.jpg`, type: 'jpeg', quality: 80 });
    await barra.getByRole('button', { name: 'Pausa' }).tap();
    await page.waitForTimeout(200);
    assert.equal(script.length, 1);
    assert.equal(script[0].azione, 'riordino_pausa'); assert.equal(script[0].pausa, true); assert.equal(script[0].token, 'tok-finto');
    assert.ok(await page.evaluate(() => window.rrTest.messaggi.includes('Spostamento in pausa')));
    await page.close();
  }
  console.log('ok: avanzamento del riordino su telefono');
} finally { await browser?.close(); server.kill(); }
