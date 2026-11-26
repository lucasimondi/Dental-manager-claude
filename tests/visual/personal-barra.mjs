// PERSONAL-ESPLORA-WIN11 fase 3 (sostituisce DOCK-UGUALE): synthetic data only, the whole Personal app.
// Taskbar 64 px in portrait / 48 px in landscape, icons from the left (ICONE-START, was centered), active line, clock + notifications,
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
        // PR #337 §8: una scadenza fra due giorni (pallino di Oggi e campanella, stessa fonte del Centro notifiche)
        if (u.pathname.endsWith('/scadenze')) { const d = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10); return route.fulfill({ json: [{ id: 's1', data: d, descrizione: 'Rata IMU', importo: 120, completata: false, storica: false, documento_id: 'a1', documento: { id: 'a1', titolo: 'IMU 2026', fascicolo: 'utenze', tipo_documento: 'avviso', tag: [] } }] }); }
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
      return { h: r.height, bottom: innerHeight - r.bottom, w: r.width, vw: innerWidth, icSinistra: ic.left, icDestra: ic.right, sisSinistra: sis.left, sisVisibile: sis.width > 0, voci, filtro: stile.backdropFilter || stile.webkitBackdropFilter, gap: getComputedStyle(document.querySelector('.pb-icone')).columnGap };
    });
    assert.equal(g.h, altezza, `altezza ${g.h}`);
    assert.equal(Math.round(g.bottom), 0);
    assert.equal(g.w, g.vw);
    assert.equal(g.filtro, 'blur(30px) saturate(1.5)');
    assert.equal(g.gap, g.vw <= 440 ? '2px' : '4px');
    assert.deepEqual(g.voci.map((v) => v.label), ['Start', 'Cerca', 'Oggi, 1 urgenti', 'Agenda', 'Esplora file, 2 da gestire', 'Scan', 'Assistente', 'Personale']);
    for (const v of g.voci) { assert.equal(v.w, g.vw <= 440 ? 36 : 40); assert.equal(v.h, 40); assert.equal(v.raggio, '6px'); }
    assert.ok(g.icSinistra <= 10, `ICONE-START: Start e icone partono da sinistra (${g.icSinistra})`);
    assert.equal(await page.locator('.pb-voce').first().getAttribute('aria-label'), 'Start');
    assert.equal(await page.locator('.pb-voce[aria-label="Agenda"] svg.pp-icona-colore').count(), 1, 'icone a colori nel dock');
    assert.equal(g.sisVisibile, true, 'area di sistema (su mobile solo la campanella)');
    assert.equal(await page.locator('.pb-campanella').isVisible(), !desktop, 'campanella solo su mobile');
    assert.equal(await page.locator('.pb-ora').isVisible(), desktop, 'ora e data solo su desktop');
    assert.ok(g.icDestra <= g.sisSinistra, 'l’area di sistema non copre le icone');
    if (desktop) {
      assert.ok(g.icDestra <= g.sisSinistra, 'l’area di sistema non copre le icone');
      assert.equal(await page.locator('.pb-ora').evaluate((e) => getComputedStyle(e).fontSize), '12px');
      assert.equal(await page.locator('.pb-notifiche').textContent(), '1');
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
    await page.locator('.esp-contenuto').waitFor();
    await page.waitForTimeout(350); // fine dell'animazione d'ingresso della pagina
    assert.equal(await page.locator('.pb-voce.attiva').getAttribute('aria-label'), 'Esplora file, 2 da gestire');
    // Oggi resta aperta sotto Esplora: trattino corto da 6 px
    assert.equal(await page.locator('.pb-voce.aperta').getAttribute('aria-label'), 'Oggi, 1 urgenti');
    assert.equal(await page.locator('.pb-voce.aperta').evaluate((e) => getComputedStyle(e, '::after').width), '6px');
    // PERSONAL-FINESTRE: Esplora è una finestra; finisce sopra la barra (ingrandita sul telefono: appoggiata alla barra).
    const pagina = await page.evaluate(() => innerHeight - document.querySelector('.pf-finestra:not([hidden])').getBoundingClientRect().bottom);
    assert.ok(Math.round(pagina) >= altezza, 'la finestra finisce sopra la barra');
    if (!desktop) assert.equal(Math.round(pagina), altezza, 'sul telefono ingrandita fino alla barra');
    await page.screenshot({ path: `${out}/${nome}-esplora.png` });

    // SCAN-APP: Scan dalla barra, aperto come app dentro Personal (Home di Scan con gli strumenti)
    await barra.getByRole('button', { name: 'Scan' }).click();
    await page.locator('.pp-scan-in-personal .scan-hero-grande').waitFor();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.pb-voce.attiva').getAttribute('aria-label'), 'Scan');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Scan senza scorrimento orizzontale');
    await page.screenshot({ path: `${out}/${nome}-scan.png` });
    await page.locator('.pf-finestra.pf-attiva .pf-titolo').getByRole('button', { name: /^Chiudi/ }).click(); // PERSONAL-FINESTRE
    await page.waitForTimeout(350);

    // Start: apre, dentro lo schermo, 4 colonne; si chiude con un tocco fuori, con Indietro e col logo
    const start = barra.getByRole('button', { name: 'Start' });
    await start.click();
    await page.getByRole('dialog', { name: 'Start' }).waitFor();
    await page.waitForTimeout(250);
    assert.ok(await dentro(page, '.pb-start'), 'Start dentro lo schermo');
    // ICONE-START: sul computer Start in basso a sinistra su «Aggiunte» (6 colonne); sul telefono a tutto schermo su «Tutte le app» (4 colonne)
    const rs = await page.locator('.pb-start').evaluate((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width }; });
    if (desktop) assert.ok(rs.l <= 10, `Start a sinistra (${rs.l})`); else assert.deepEqual([Math.round(rs.l), Math.round(rs.t), Math.round(rs.w)], [0, 0, viewport.width], 'Start a tutto schermo');
    assert.equal(await page.locator('.pb-aggiunte').first().evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length), desktop ? 6 : 4);
    if (!desktop) {
      assert.deepEqual(await page.locator('.pb-gruppo h3').allInnerTexts(), ['Le tue app', 'Le mie cose', 'Studio e lavoro', 'Google', 'Office', 'Sistema']);
      assert.equal(await page.locator('.pb-gruppo[aria-label="Sistema"] .pb-app-nome').innerText(), 'Impostazioni');
      assert.equal(await page.locator('.pb-gruppo[aria-label="Office"] .pb-app').count(), 4);
      await page.screenshot({ path: `${out}/${nome}-start-tutte.png` });
      await page.getByRole('button', { name: /^Aggiunte/ }).click();
    } else {
      await page.screenshot({ path: `${out}/${nome}-start-aggiunte.png` });
    }
    assert.equal(await page.locator('.pb-voce.attiva').getAttribute('aria-label'), 'Start');
    assert.equal(await page.locator('.pb-app[aria-label="Esplora, 2"] .pb-pallino').textContent(), '2');
    assert.equal(await page.locator('.pb-app[aria-label="Oggi, 1"] .pb-pallino').textContent(), '1');
    await page.screenshot({ path: `${out}/${nome}-start.png` });
    // SCAN-GOOGLE-OFFICE: cartelle «Google» e «Office» in Start, aperte dentro Start
    await page.locator('.pb-app[aria-label="Google"]').scrollIntoViewIfNeeded();
    await page.locator('.pb-app[aria-label="Google"]').click();
    await page.getByRole('group', { name: 'Cartella Google' }).waitFor();
    assert.deepEqual(await page.locator('.pb-cartella-app .pb-app-nome').allInnerTexts(), ['Documenti', 'Fogli', 'Presentazioni', 'Moduli', 'Drive', 'Gmail', 'Calendar', 'Nuovo documento', 'Nuovo foglio', 'Nuova presentazione', 'Nuovo modulo']);
    assert.ok(await dentro(page, '.pb-start'), 'Start con la cartella dentro lo schermo');
    await page.screenshot({ path: `${out}/${nome}-start-google.png` });
    await page.getByRole('button', { name: 'Torna ad Aggiunte' }).click();
    await page.locator('.pb-app[aria-label="Office"]').click();
    assert.deepEqual(await page.locator('.pb-cartella-app .pb-app-nome').allInnerTexts(), ['Nuovo Word', 'Nuovo Excel', 'Nuovo PowerPoint', 'File Office']);
    await page.screenshot({ path: `${out}/${nome}-start-office.png` });
    await page.getByRole('button', { name: 'Torna ad Aggiunte' }).click();
    // ICONE-START: «Tutte le app» sul computer (6 colonne, gruppi)
    if (desktop) {
      await page.getByRole('button', { name: /^Tutte le app/ }).click();
      await page.locator('.pb-gruppo[aria-label="Le mie cose"]').waitFor();
      await page.screenshot({ path: `${out}/${nome}-start-tutte.png` });
    }
    if (desktop) await page.mouse.click(1200, 5); else await start.click(); // sul telefono Start copre lo schermo: si chiude dal logo
    await page.getByRole('dialog', { name: 'Start' }).waitFor({ state: 'detached' });
    // un'app da «Tutte le app» si apre come finestra (a tutto schermo sul telefono)
    await start.click(); await page.getByRole('dialog', { name: 'Start' }).waitFor();
    if (desktop) await page.getByRole('button', { name: /^Tutte le app/ }).click();
    await page.locator('.pb-gruppo .pb-app[aria-label="Rubrica"]').click();
    await page.getByRole('dialog', { name: 'Start' }).waitFor({ state: 'detached' });
    await page.locator('.pf-finestra.pf-attiva').waitFor(); await page.waitForTimeout(350);
    assert.match(await page.locator('.pf-finestra.pf-attiva .pf-titolo').innerText(), /Rubrica/);
    // ICONE-START: «App aperte» tenendo premuto Start (tasto destro sul computer); × chiude l'app
    if (desktop) await start.click({ button: 'right' });
    else { await start.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 20, clientY: viewport.height - 20 }] }); await page.waitForTimeout(650); await start.dispatchEvent('touchend', {}); }
    const rec = page.getByRole('dialog', { name: 'App aperte' });
    await rec.waitFor();
    await rec.getByRole('button', { name: /^Rubrica.*apri$/ }).waitFor();
    await page.screenshot({ path: `${out}/${nome}-app-aperte.png` });
    await rec.getByRole('button', { name: /^Chiudi Rubrica/ }).click();
    await rec.getByRole('button', { name: /^Rubrica.*apri$/ }).waitFor({ state: 'detached' });
    assert.equal(await rec.getByRole('button', { name: /^Esplora file.*apri$/ }).count(), 1, 'Esplora resta aperta');
    await page.keyboard.press('Escape');
    await rec.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.pf-finestra .pf-titolo', { hasText: 'Rubrica' }).count(), 0, 'Rubrica chiusa');
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
    assert.equal(await page.locator('.pf-finestra.pf-attiva input').first().inputValue(), 'bolletta');
    // ora e data (campanella su mobile) → Centro notifiche: notifica con azioni rapide, calendario con il giorno segnato
    await page.locator('.pb-area').click();
    const cn = page.getByRole('dialog', { name: 'Centro notifiche' });
    await cn.waitFor();
    await cn.getByText('Rata IMU').waitFor();
    assert.ok(await cn.getByRole('button', { name: 'Apri documento' }).count());
    assert.ok(await cn.getByRole('button', { name: 'Segna come fatto' }).count());
    assert.ok(await page.locator('.pn-giorno.con').count() >= 1, 'giorno con scadenza nel calendario');
    await page.waitForTimeout(350); // fine dell'animazione di entrata
    assert.ok(await dentro(page, '.pn-centro'), 'Centro notifiche dentro lo schermo');
    await page.screenshot({ path: `${out}/${nome}-centro.png` });
    await page.keyboard.press('Escape');
    await cn.waitFor({ state: 'detached' });

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
