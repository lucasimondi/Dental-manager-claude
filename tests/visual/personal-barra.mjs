// PERSONAL-ESPLORA-WIN11 fase 3 (sostituisce DOCK-UGUALE): synthetic data only, the whole Personal app.
// Taskbar 64 px in portrait / 48 px in landscape, centered 44×44 icons, active line, clock + notifications,
// Esplora from the bar, Start (inside the screen, closes with tap outside / Back / logo), real archive search.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-barra'; await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5183', '--strictPort'], { stdio: 'ignore' });
let browser;
const dentro = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return !!r && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; }, sel);
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5183')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  // PR #337: 56 px sul telefono (verticale e orizzontale, area di sistema nascosta), 48 px su desktop con ora, data e Drive.
  for (const [nome, viewport, altezza, touch] of [['verticale', { width: 390, height: 844 }, 56, true], ['orizzontale', { width: 844, height: 390 }, 56, true], ['desktop', { width: 1280, height: 800 }, 48, false]]) {
    const desktop = !touch;
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('supabase.co')) {
        if (u.pathname.includes('/auth/')) return route.fulfill({ json: {} });
        if (u.pathname.endsWith('/promemoria_azioni')) return route.fulfill({ json: [{ id: 'p1', priorita: 'alta', rimanda_al: null }, { id: 'p2', priorita: 'media', rimanda_al: null }, { id: 'p3', priorita: 'bassa', rimanda_al: null }] });
        if (u.pathname.endsWith('/documenti') && u.searchParams.get('azione_richiesta')) return route.fulfill({ json: [{ id: 'a1', fascicolo: 'utenze', azione_richiesta: true }, { id: 'a2', fascicolo: 'conti', azione_richiesta: true }] });
        if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range' }, body: '' });
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5183/tests/visual/personal-dock.html');
    const barra = page.locator('nav.pb-barra');
    await barra.waitFor();
    await page.getByRole('heading', { name: 'Personale' }).waitFor();
    await page.locator('.pb-voce[aria-label^="Esplora file, 2"]').waitFor(); // conteggi caricati dopo il primo disegno
    const g = await page.evaluate(() => {
      const r = document.querySelector('nav.pb-barra').getBoundingClientRect();
      const ic = document.querySelector('.pb-icone').getBoundingClientRect();
      const sis = document.querySelector('.pb-sistema').getBoundingClientRect();
      const voci = [...document.querySelectorAll('.pb-voce')].map((e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, label: e.getAttribute('aria-label'), raggio: getComputedStyle(e).borderRadius }; });
      const stile = getComputedStyle(document.querySelector('nav.pb-barra'));
      return { h: r.height, bottom: innerHeight - r.bottom, w: r.width, vw: innerWidth, centro: ic.left + ic.width / 2, icDestra: ic.right, sisSinistra: sis.left, sisVisibile: sis.width > 0, voci, filtro: stile.backdropFilter || stile.webkitBackdropFilter, gap: getComputedStyle(document.querySelector('.pb-icone')).columnGap };
    });
    assert.equal(g.h, altezza, `altezza ${g.h}`);
    assert.equal(Math.round(g.bottom), 0);
    assert.equal(g.w, g.vw);
    assert.equal(g.filtro, 'blur(30px) saturate(1.5)');
    assert.equal(g.gap, '4px');
    assert.deepEqual(g.voci.map((v) => v.label), ['Start', 'Oggi, 1 urgenti', 'Agenda', 'Esplora file, 2 da gestire', 'Assistente', 'Personale']);
    for (const v of g.voci) { assert.equal(v.w, 40); assert.equal(v.h, 40); assert.equal(v.raggio, '6px'); }
    assert.ok(Math.abs(g.centro - g.vw / 2) < 2, `icone centrate (${g.centro} su ${g.vw})`);
    assert.equal(g.sisVisibile, desktop, desktop ? 'area di sistema su desktop' : 'area di sistema nascosta su mobile');
    if (desktop) {
      assert.ok(g.icDestra <= g.sisSinistra, 'l’area di sistema non copre le icone');
      assert.equal(await page.locator('.pb-ora').evaluate((e) => getComputedStyle(e).fontSize), '12px');
      assert.equal(await page.locator('.pb-notifiche').textContent(), '3');
      assert.equal(await page.locator('.pb-drive').getAttribute('aria-label'), 'Drive sincronizzato');
      assert.ok(await dentro(page, '.pb-sistema'));
    }
    assert.equal(await page.locator('.pb-voce.attiva').getAttribute('aria-label'), 'Personale');
    assert.equal(await page.locator('.pb-voce.attiva').evaluate((e) => { const s = getComputedStyle(e, '::after'); return [s.width, s.height, s.backgroundColor].join(' '); }), '16px 3px rgb(0, 95, 184)');
    assert.equal(await page.locator('.pb-voce[aria-label^="Oggi"] .pb-pallino').textContent(), '1');
    await page.screenshot({ path: `${out}/${nome}-barra.png` });

    // Oggi dalla barra
    await barra.getByRole('button', { name: /^Oggi/ }).click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.pb-voce.attiva').getAttribute('aria-label'), 'Oggi, 1 urgenti');
    // Esplora file dalla barra
    await barra.getByRole('button', { name: /^Esplora file/ }).click();
    await page.locator('.esp-albero').waitFor();
    await page.waitForTimeout(350); // fine dell'animazione d'ingresso della pagina
    assert.equal(await page.locator('.pb-voce.attiva').getAttribute('aria-label'), 'Esplora file, 2 da gestire');
    // Oggi resta aperta sotto Esplora: trattino corto da 6 px
    assert.equal(await page.locator('.pb-voce.aperta').getAttribute('aria-label'), 'Oggi, 1 urgenti');
    assert.equal(await page.locator('.pb-voce.aperta').evaluate((e) => getComputedStyle(e, '::after').width), '6px');
    const pagina = await page.evaluate(() => innerHeight - document.querySelector('.pp-pagina:not([hidden])').getBoundingClientRect().bottom);
    assert.equal(Math.round(pagina), altezza, 'la pagina finisce sopra la barra');
    await page.screenshot({ path: `${out}/${nome}-esplora.png` });

    // Start: apre, dentro lo schermo, 4 colonne; si chiude con un tocco fuori, con Indietro e col logo
    const start = barra.getByRole('button', { name: 'Start' });
    await start.click();
    await page.getByRole('dialog', { name: 'Start' }).waitFor();
    await page.waitForTimeout(250);
    assert.ok(await dentro(page, '.pb-start'), 'Start dentro lo schermo');
    assert.equal(await page.locator('.pb-aggiunte').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length), 4);
    assert.equal(await page.locator('.pb-voce.attiva').getAttribute('aria-label'), 'Start');
    assert.equal(await page.locator('.pb-app[aria-label="Esplora, 2"] .pb-pallino').textContent(), '2');
    assert.equal(await page.locator('.pb-app[aria-label="Oggi, 1"] .pb-pallino').textContent(), '1');
    await page.screenshot({ path: `${out}/${nome}-start.png` });
    await page.mouse.click(5, 5);
    await page.getByRole('dialog', { name: 'Start' }).waitFor({ state: 'detached' });
    await start.click(); await page.getByRole('dialog', { name: 'Start' }).waitFor();
    await page.goBack();
    await page.getByRole('dialog', { name: 'Start' }).waitFor({ state: 'detached' });
    await start.click(); await page.getByRole('dialog', { name: 'Start' }).waitFor();
    await start.click();
    await page.getByRole('dialog', { name: 'Start' }).waitFor({ state: 'detached' });
    // ricerca reale dell'archivio
    await start.click();
    await page.getByRole('searchbox', { name: 'Cerca nel tuo archivio' }).or(page.getByLabel('Cerca nel tuo archivio')).first().fill('bolletta');
    await page.keyboard.press('Enter');
    await page.getByText('Cerca nel tuo archivio').last().waitFor();
    assert.equal(await page.locator('.pp-pagina:not([hidden]) input').first().inputValue(), 'bolletta');
    // ora, data e notifiche → Da fare (solo desktop; su mobile Da fare è in Start)
    if (desktop) {
      await page.locator('.pb-area').click();
      await page.getByRole('heading', { name: 'Da fare' }).waitFor();
    }

    const larga = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(larga, false, 'nessuno scorrimento orizzontale');
    if (nome === 'verticale' || nome === 'desktop') {
      await page.emulateMedia({ colorScheme: 'dark' });
      await start.click(); await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/${nome}-start-scura.png` });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('personal-barra PASS');
} finally { await browser?.close(); server.kill(); }
