// PO 2026-11-25 «deve scorrere anche verso il basso perché non scrolla»: sul telefono, col dito, una finestra di
// Personal scorre in verticale (app Auto e motori e Impostazioni) e la striscia delle schede scorre di lato.
// Prima il corpo della pagina era un secondo contenitore scorrevole con overscroll-behavior: contain e fermava il dito.
// Dati sintetici, rete finta, tocchi veri (Input.dispatchTouchEvent).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { avvia } from './esplora-dati.mjs';
const PORTA = 5192;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore' });
const C = (gruppo, etichetta, valore = '') => ({ gruppo, etichetta, valore, tipo: 'testo', avviso: false });
const campi = Array.from({ length: 18 }, (_, i) => C('veicolo', `Campo ${i}`, `valore ${i}`));
const COSE = [{ id: 'v1', ambito: 'auto', tipo: 'auto', nome: 'Auto prova', colore: 'ambra', ordine: 0, campi, registro: [], persone: [] }, { id: 'v2', ambito: 'auto', tipo: 'auto', nome: 'Altra', colore: 'blu', ordine: 1, campi: campi.slice(0, 3), registro: [], persone: [] }];
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const T = await avvia(browser, { width: 390, height: 844, touch: true, scala: 2, porta: PORTA, url: 'personal-dock.html', attendi: 'nav.pb-barra',
    prepara: (S) => { S.extra = async (route, { p }) => { if (p.includes('/auth/')) { await route.fulfill({ json: {} }); return true; } if (p.endsWith('/mie_cose')) { await route.fulfill({ json: COSE }); return true; } return undefined; }; } });
  const { page, cdp } = T;
  const trascina = async (x, y1, y2, dx = 0) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y1 }] });
    for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 12, y: y1 + ((y2 - y1) * i) / 12 }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(500);
  };
  const tocca = async (loc) => { const b = await loc.boundingBox(); const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 }; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  await tocca(page.locator('.pps-app-voce').first());
  await page.locator('.pf-finestra.pf-attiva .pp-ac-scheda h3').first().waitFor();
  const scorre = page.locator('.pf-finestra.pf-attiva .pf-scorre');
  await trascina(200, 300, 100); assert.ok(await scorre.evaluate((e) => e.scrollTop) > 100, 'la finestra dell’app scorre (dito sulla testata)');
  await scorre.evaluate((e) => { e.scrollTop = 0; }); await page.waitForTimeout(200);
  await trascina(200, 700, 300); assert.ok(await scorre.evaluate((e) => e.scrollTop) > 200, 'la finestra dell’app scorre (dito sulla scheda)');
  await scorre.evaluate((e) => { e.scrollTop = 0; }); await page.waitForTimeout(200);
  await trascina(300, 600, 590, -200); assert.ok(await page.locator('.pf-finestra.pf-attiva .pp-md-striscia').evaluate((e) => e.scrollLeft) > 100, 'le schede scorrono di lato');
  await page.evaluate(() => document.querySelector('.pf-finestra.pf-attiva .pf-chiudi')?.click()); await page.waitForTimeout(800);
  await tocca(page.locator('.pps-profilo')); await page.waitForTimeout(2000);
  const imp = page.locator('.pf-finestra.pf-attiva .pf-scorre');
  await trascina(200, 700, 300); assert.ok(await imp.evaluate((e) => e.scrollTop) > 100, 'anche Impostazioni scorre');
  console.log('personal-finestre-scorre: PASS');
} finally { await browser?.close(); server.kill(); }
