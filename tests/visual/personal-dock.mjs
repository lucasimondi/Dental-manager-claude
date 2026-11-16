// DOCK-UGUALE: synthetic data only. Personal dock = Studio dock (geometry, icon-only, gem in the centre).
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-dock'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5183', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5183')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [nome, dev] of [['pixel7', devices['Pixel 7']], ['iphone-se', devices['iPhone SE']]]) {
    const context = await browser.newContext({ ...dev }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) return route.fulfill({ json: u.pathname.includes('/auth/') ? {} : [] });
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5183/tests/visual/personal-dock.html');
    const dock = page.locator('nav.pp-dock');
    await dock.waitFor();
    await page.getByRole('heading', { name: 'Personale' }).waitFor();
    const g = await page.evaluate(() => {
      const r = document.querySelector('nav.pp-dock').getBoundingClientRect();
      const voci = [...document.querySelectorAll('nav.pp-dock .pp-scheda')].map((e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, cy: b.top + b.height / 2, label: e.getAttribute('aria-label') }; });
      return { w: r.width, h: r.height, bottom: innerHeight - r.bottom, left: r.left, right: innerWidth - r.right, vw: innerWidth, radius: getComputedStyle(document.querySelector('nav.pp-dock')).borderRadius, voci, testoVisibile: [...document.querySelectorAll('nav.pp-dock .pp-dock-nome')].some((s) => s.getBoundingClientRect().width > 1) };
    });
    assert.equal(g.h, 64); assert.equal(Math.round(g.bottom), 16);
    assert.ok(Math.abs(g.w - Math.min(g.vw * 0.84, 390)) < 1, `larghezza ${g.w}`);
    assert.ok(Math.abs(g.left - g.right) < 1, 'centrato');
    assert.deepEqual(g.voci.map((v) => v.label), ['Agenda', 'Documenti', 'Apri Poliedron', 'Studio', 'Personale']);
    for (const v of g.voci.filter((x) => x.label !== 'Apri Poliedron')) { assert.equal(v.w, 44); assert.equal(v.h, 44); }
    const gemma = g.voci[2]; assert.ok(gemma.w >= 58 && gemma.w <= 72, `gemma ${gemma.w}`);
    assert.ok(g.voci[0].cy - gemma.cy > 15, 'gemma alzata sopra il dock');
    assert.equal(g.testoVisibile, false, 'solo icone');
    assert.equal(await page.locator('nav.pp-dock .pp-scheda.attiva').getAttribute('aria-label'), 'Personale');
    await page.screenshot({ path: `${out}/${nome}.png` });
    await page.getByRole('button', { name: 'Documenti', exact: true }).click();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('nav.pp-dock .pp-scheda.attiva').getAttribute('aria-label'), 'Documenti');
    const larga = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(larga, false, 'nessuno scorrimento orizzontale');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('personal-dock PASS');
} finally { await browser?.close(); server.kill(); }
