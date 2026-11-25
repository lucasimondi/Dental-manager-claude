// PR #337 §10 — verifica su TELEFONO (PO 2026-11-22: «A me interessa solo da cellulare»): app Personal intera
// con barra, dati sintetici, tocchi reali (CDP). 375×812 e 768×1024, tema chiaro e scuro, nessuno sforamento.
// Screenshot (deviceScaleFactor 2, JPEG) in docs/screenshots/pr337/: dock, Start, Centro notifiche, schede +
// breadcrumb, pannello di navigazione, Dettagli, Elenco, menu dal basso con Apri con e Condividi, riquadro di
// anteprima, trascinamento su un'icona del dock.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { avvia } from './esplora-dati.mjs';

const out = 'docs/screenshots/pr337'; await mkdir(out, { recursive: true });
const PORTA = 5184;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore' });
const centro = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const tocca = async ({ cdp, page }, p) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(250); };
const premi = async ({ cdp, page }, loc) => {
  const a = await centro(loc);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  await page.waitForTimeout(650);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(550);
};
const tessera = (page, nome) => page.locator(`.esp-contenuto [data-elemento][aria-label="${nome}"]`);
const voce = (page, nome) => page.locator('.esp-foglio-menu .esp-menu-voce', { hasText: new RegExp(`^${nome}`) }).first();
const dentro = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return !!r && r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; }, sel);
const largo = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [width, height] of [[375, 812], [768, 1024]]) {
    for (const colore of ['light', 'dark']) {
      const nome = `${width}-${colore === 'light' ? 'chiaro' : 'scuro'}`;
      const foto = async (page, cosa) => page.screenshot({ path: `${out}/${cosa}-${nome}.jpg`, type: 'jpeg', quality: 78 });
      const T = await avvia(browser, {
        width, height, touch: true, colore, scala: 2, porta: PORTA, url: 'personal-dock.html', attendi: 'nav.pb-barra',
        prepara: (S) => { S.extra = async (route, { p }) => (p.includes('/auth/') ? route.fulfill({ json: {} }) : undefined); },
      });
      const { page } = T;
      await page.locator('.pb-voce[aria-label^="Esplora file"]').waitFor();
      await page.waitForTimeout(1600); // pallini dopo il primo disegno

      // dock
      assert.equal(await page.locator('.pb-barra').evaluate((e) => Math.round(e.getBoundingClientRect().height)), 56, 'barra da 56 px su telefono');
      assert.ok(await page.locator('.pb-campanella').isVisible(), 'campanella');
      await foto(page, '01-dock');

      // Start
      await tocca(T, await centro(page.locator('.pb-voce[aria-label="Start"]')));
      await page.getByRole('dialog', { name: 'Start' }).waitFor(); await page.waitForTimeout(300);
      assert.ok(await dentro(page, '.pb-start'));
      await foto(page, '02-start');
      await page.mouse.click(4, 4); await page.getByRole('dialog', { name: 'Start' }).waitFor({ state: 'detached' });

      // Centro notifiche
      await tocca(T, await centro(page.locator('.pb-area')));
      await page.getByRole('dialog', { name: 'Centro notifiche' }).waitFor(); await page.waitForTimeout(400);
      assert.ok(await dentro(page, '.pn-centro'));
      await page.getByText('Contratto gas').first().waitFor();
      await foto(page, '03-centro-notifiche');
      await page.keyboard.press('Escape');

      // Esplora dal dock: schede (tendina) + breadcrumb con la freccia delle sottocartelle
      await tocca(T, await centro(page.locator('.pb-voce[aria-label^="Esplora file"]')));
      await tessera(page, 'Cartella Casa').waitFor();
      await tocca(T, await centro(tessera(page, 'Cartella Casa')));
      await tessera(page, 'Rogito casa').waitFor();
      await page.getByRole('button', { name: 'Nuova scheda' }).tap();
      await page.locator('.esp-schede-tendina').selectOption({ index: 0 });
      await tessera(page, 'Rogito casa').waitFor();
      await page.getByRole('button', { name: 'Sottocartelle di Casa' }).tap();
      await page.locator('.esp-tendina').waitFor(); await page.waitForTimeout(200);
      await foto(page, '04-schede-breadcrumb');
      await page.locator('.esp-tendina .esp-menu-voce', { hasText: 'Utenze' }).tap();
      await tessera(page, 'Contratto gas').waitFor();

      // pannello di navigazione (cassetto)
      await page.getByRole('button', { name: 'Pannello di navigazione' }).tap();
      await page.locator('.esp-cassetto').waitFor(); await page.waitForTimeout(300);
      assert.ok(await dentro(page, '.esp-cassetto'));
      await foto(page, '05-pannello-navigazione');
      await page.locator('.esp-cassetto .esp-albero-nome', { hasText: /^Casa/ }).tap();
      await tessera(page, 'Rogito casa').waitFor();

      // Dettagli ed Elenco
      await page.locator('.esp').getByRole('button', { name: /^Visualizza/ }).tap();
      await page.waitForTimeout(500); await voce(page, 'Dettagli').tap();
      await page.locator('.esp-dettagli').waitFor();
      await foto(page, '06-dettagli');
      await page.locator('.esp').getByRole('button', { name: /^Visualizza/ }).tap();
      await page.waitForTimeout(500); await voce(page, 'Elenco').tap();
      await page.locator('.esp-elenco').waitFor();
      const h = await page.locator('.esp-riga-bottone').first().evaluate((e) => e.getBoundingClientRect().height);
      assert.ok(h >= 48 && h < 50, `righe da 48 px (${h})`);
      await foto(page, '07-elenco');

      // menu dal basso (pressione prolungata) con Apri con e Condividi
      await premi(T, tessera(page, 'Rogito casa'));
      await page.locator('.esp-foglio-menu').waitFor(); await page.waitForTimeout(300);
      const fr = await page.locator('.esp-foglio-menu').boundingBox();
      const larghezzaFinestra = await page.locator('.pf-corpo:has(.esp)').evaluate((e) => e.getBoundingClientRect().width); // PERSONAL-FINESTRE: dentro la finestra
      assert.ok(Math.abs(fr.width - larghezzaFinestra) < 1, 'foglio a tutta larghezza della finestra');
      assert.ok(await page.locator('.esp-barra-selezione').isVisible(), 'selezione con barra azioni in alto');
      await foto(page, '08-menu-foglio');
      await voce(page, 'Apri con').tap(); await page.waitForTimeout(250);
      await page.locator('.esp-foglio-menu .esp-menu-nome', { hasText: 'Scegli app predefinita…' }).waitFor();
      await foto(page, '09-menu-apri-con');
      await page.locator('.esp-menu-indietro').tap(); await page.waitForTimeout(200);
      await voce(page, 'Condividi').tap(); await page.waitForTimeout(250);
      await page.locator('.esp-foglio-menu .esp-menu-nome', { hasText: 'Gestisci accesso Drive' }).waitFor();
      await foto(page, '10-menu-condividi');
      await page.locator('.esp-velo-foglio').tap({ position: { x: width / 2, y: 40 } });
      await page.locator('.esp-foglio-menu').waitFor({ state: 'detached' });

      // riquadro di anteprima (bottom sheet) sul file selezionato
      await page.locator('.esp').getByRole('button', { name: /^Visualizza/ }).tap();
      await page.waitForTimeout(500); await voce(page, 'Riquadro di anteprima').tap();
      await page.locator('.esp-riquadro-foglio').waitFor(); await page.waitForTimeout(600);
      assert.ok(await dentro(page, '.esp-riquadro-foglio'));
      await foto(page, '11-riquadro-anteprima');
      await page.locator('.esp-riquadro-chiudi').tap();
      await page.locator('.esp-barra-selezione button', { hasText: 'Fine' }).tap().catch(() => {});

      // trascinamento di un file su un'icona del dock (Assistente): l'icona si accende
      const a = await centro(tessera(page, 'Rogito casa'));
      const b = await centro(page.locator('.pb-voce[aria-label="Assistente"]'));
      await T.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
      await page.waitForTimeout(650);
      for (let i = 1; i <= 12; i++) await T.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 12, y: a.y + ((b.y - a.y) * i) / 12 }] });
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.pb-voce.pb-sopra').getAttribute('aria-label'), 'Assistente', 'icona del dock accesa');
      assert.match(await page.locator('.esp-fantasma').textContent(), /assistente/i);
      await foto(page, '12-trascina-sul-dock');
      await T.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.locator('.pb-voce.attiva[aria-label="Assistente"]').waitFor();

      assert.equal(await largo(page), false, `nessuno scorrimento orizzontale (${nome})`);
      assert.deepEqual(T.errors, [], nome);
      await T.context.close();
      console.log(`  ${nome} ok`);
    }
  }
  console.log('personal-esplora-win11 PASS');
} finally { await browser?.close(); server.kill(); }
