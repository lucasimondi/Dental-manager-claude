// PERSONAL-MULTITASK (PO 2026-11-25) — Windows 11 per il telefono, dati sintetici, rete finta.
// Telefono 390×844 (tocchi reali): due finestre una sopra l'altra trascinando il titolo in basso
// (anteprima, Snap assist), divisore comune, Visualizzazione attività con una nuova scrivania.
// Computer 1280×800 (mouse): Snap a sinistra + assist, schemi dal tasto Ingrandisci, ridimensionamento
// da bordo sinistro e bordo alto, scrivanie. Screenshot in tests/visual/results-personal-multitask/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { avvia } from './esplora-dati.mjs';

const out = 'tests/visual/results-personal-multitask'; await mkdir(out, { recursive: true });
const PORTA = 5187;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore' });
const centro = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const finestra = (page, nome) => page.locator(`.pf-finestra[aria-label^="${nome}"]`);
const largo = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const prepara = (S) => { S.extra = async (route, { p }) => (p.includes('/auth/') ? route.fulfill({ json: {} }) : undefined); };
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  /* ---------- telefono ---------- */
  {
    const T = await avvia(browser, { width: 390, height: 844, touch: true, scala: 2, porta: PORTA, url: 'personal-dock.html', attendi: 'nav.pb-barra', prepara });
    const { page, cdp } = T;
    const tocco = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [p] });
    const tocca = async (loc) => { const p = await centro(loc); await tocco('touchStart', p); await tocco('touchEnd'); await page.waitForTimeout(250); };
    const trascina = async (da, a, passi = 12, foto = null) => { await tocco('touchStart', da); for (let i = 1; i <= passi; i++) await tocco('touchMove', { x: da.x + (a.x - da.x) * i / passi, y: da.y + (a.y - da.y) * i / passi }); if (foto) await foto(); await tocco('touchEnd'); await page.waitForTimeout(300); };
    const barra = page.locator('nav.pb-barra');
    await tocca(barra.getByRole('button', { name: /^Esplora file/ }));
    const esp = finestra(page, 'Esplora file'); await esp.locator('.esp-contenuto').waitFor();
    await tocca(barra.getByRole('button', { name: 'Start' }));
    await page.getByRole('dialog', { name: 'Start' }).locator('.pb-app[aria-label^="Scan"]').click();
    const scan = finestra(page, 'Poliedron Scan'); await scan.locator('.scan-hero-grande').waitFor();
    // trascina il titolo dello Scan in basso: anteprima, poi aggancio sotto
    const t = await scan.locator('.pf-nome').boundingBox();
    await trascina({ x: t.x + 30, y: t.y + 20 }, { x: 195, y: 760 }, 14, async () => {
      await page.locator('.pf-anteprima-snap').waitFor(); await page.screenshot({ path: `${out}/tel-1-anteprima.png` });
    });
    assert.equal(await scan.evaluate((e) => e.classList.contains('pf-z-sotto')), true, 'Scan agganciato sotto');
    const assist = page.getByRole('dialog', { name: 'Scegli la finestra da affiancare' }); await assist.waitFor();
    await page.screenshot({ path: `${out}/tel-2-assist.png` });
    await tocca(assist.getByRole('button', { name: /Esplora file/ }));
    assert.equal(await esp.evaluate((e) => e.classList.contains('pf-z-sopra')), true, 'Esplora sopra');
    const e1 = await esp.boundingBox(), s1 = await scan.boundingBox();
    assert.ok(Math.abs(e1.y + e1.height - s1.y) < 2 && Math.abs(e1.height - s1.height) < 2, 'due metà uguali');
    // divisore: su di 120 px
    const div = page.getByRole('separator', { name: 'Divisore tra le finestre' });
    const dc = await centro(div);
    await trascina(dc, { x: dc.x, y: dc.y - 120 }, 8);
    const e2 = await esp.boundingBox(), s2 = await scan.boundingBox();
    assert.ok(e2.height < e1.height - 100 && s2.height > s1.height + 100, `divisore spostato (${e1.height}→${e2.height})`);
    assert.ok(!(await largo(page)));
    await page.screenshot({ path: `${out}/tel-3-divise.png` });
    // Visualizzazione attività: nuova scrivania, sposta Esplora lì, vai
    await tocca(barra.getByRole('button', { name: /^Visualizzazione attività/ }));
    const vista = page.getByRole('dialog', { name: 'Visualizzazione attività' }); await vista.waitFor(); await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/tel-4-attivita.png` });
    await tocca(vista.getByRole('button', { name: 'Nuovo desktop' }));
    assert.equal(await vista.locator('.pv-scrivania').count(), 2);
    await tocca(vista.getByRole('button', { name: /^Desktop 1/ }));
    await tocca(vista.getByRole('button', { name: /^Sposta Esplora file/ }));
    await tocca(vista.locator('.pv-menu').getByRole('menuitem', { name: 'Desktop 2' }));
    assert.equal(await vista.locator('.pv-scheda').count(), 1, 'in Desktop 1 resta lo Scan');
    await tocca(vista.getByRole('button', { name: /^Desktop 2/ }));
    await page.screenshot({ path: `${out}/tel-5-desktop2.png` });
    await tocca(vista.getByRole('button', { name: /^Apri Esplora file/ }));
    await vista.waitFor({ state: 'detached' });
    assert.ok(await esp.isVisible() && !(await scan.isVisible()), 'in Desktop 2 si vede solo Esplora');
    assert.match(await barra.getByRole('button', { name: /^Visualizzazione attività/ }).getAttribute('aria-label'), /2 scrivanie/);
    await page.screenshot({ path: `${out}/tel-6-in-desktop2.png` });
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }

  /* ---------- computer ---------- */
  {
    const T = await avvia(browser, { width: 1280, height: 800, touch: false, porta: PORTA, url: 'personal-dock.html', attendi: 'nav.pb-barra', prepara });
    const { page } = T;
    const barra = page.locator('nav.pb-barra');
    await barra.getByRole('button', { name: /^Esplora file/ }).click();
    const esp = finestra(page, 'Esplora file'); await esp.locator('.esp-contenuto').waitFor();
    await barra.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('dialog', { name: 'Start' }).locator('.pb-app[aria-label^="Scan"]').click();
    const scan = finestra(page, 'Poliedron Scan'); await scan.locator('.scan-hero-grande').waitFor();
    // Esplora sul bordo sinistro → metà sinistra; assist → Scan a destra
    const t = await esp.locator('.pf-titolo').boundingBox(); // in alto: lo Scan copre la parte bassa del titolo
    await page.mouse.move(t.x + 120, t.y + 8); await page.mouse.down(); await page.mouse.move(400, 300, { steps: 5 }); await page.mouse.move(2, 400, { steps: 10 });
    await page.locator('.pf-anteprima-snap').waitFor(); await page.screenshot({ path: `${out}/pc-1-anteprima.png` });
    await page.mouse.up(); await page.waitForTimeout(200);
    const assist = page.getByRole('dialog', { name: 'Scegli la finestra da affiancare' }); await assist.waitFor();
    await page.screenshot({ path: `${out}/pc-2-assist.png` });
    await assist.getByRole('button', { name: /Poliedron Scan/ }).click();
    const eb = await esp.boundingBox(), sb = await scan.boundingBox();
    assert.ok(eb.x < 2 && Math.abs(eb.width - 640) < 3 && Math.abs(sb.x - 640) < 3, 'affiancate a metà');
    await page.screenshot({ path: `${out}/pc-3-affiancate.png` });
    // schemi di affiancamento dal tasto Ingrandisci dello Scan: due terzi a sinistra
    const ing = scan.locator('.pf-titolo').getByRole('button', { name: /^Ingrandisci/ });
    await ing.hover(); await page.getByRole('menu', { name: 'Schemi di affiancamento' }).waitFor({ timeout: 3000 });
    await page.screenshot({ path: `${out}/pc-4-schemi.png` });
    await page.getByRole('menuitem', { name: 'Due terzi a sinistra' }).click();
    const s2 = await scan.boundingBox(); assert.ok(s2.x < 2 && Math.abs(s2.width - 1280 * 2 / 3) < 3, 'Scan su due terzi');
    // ridimensiona Esplora (libera) dal bordo sinistro e dal bordo alto
    await barra.getByRole('button', { name: /^Esplora file/ }).click(); // avanti (era coperta dallo Scan)
    await esp.locator('.pf-titolo').getByRole('button', { name: /^Ingrandisci/ }).click(); // agganciata → libera
    await page.mouse.move(640, 700); await page.waitForTimeout(600); // via dal tasto (niente schemi)
    const r0 = await esp.boundingBox();
    const o = await esp.locator('.pf-bordo-o').boundingBox();
    await page.mouse.move(o.x + o.width / 2, o.y + 40); await page.mouse.down(); await page.mouse.move(o.x + o.width / 2 + 80, o.y + 40, { steps: 6 }); await page.mouse.up();
    const n = await esp.locator('.pf-bordo-n').boundingBox();
    await page.mouse.move(n.x + 40, n.y + n.height / 2); await page.mouse.down(); await page.mouse.move(n.x + 40, n.y + n.height / 2 + 60, { steps: 6 }); await page.mouse.up();
    const r1 = await esp.boundingBox();
    assert.ok(Math.abs(r1.x - (r0.x + 80)) < 3 && Math.abs(r1.width - (r0.width - 80)) < 3, `bordo sinistro (${r0.x},${r0.width} → ${r1.x},${r1.width})`);
    assert.ok(Math.abs(r1.y - (r0.y + 60)) < 3 && Math.abs(r1.height - (r0.height - 60)) < 3, 'bordo alto');
    // scrivanie
    await barra.getByRole('button', { name: /^Visualizzazione attività/ }).click();
    const vista = page.getByRole('dialog', { name: 'Visualizzazione attività' }); await vista.waitFor();
    await vista.getByRole('button', { name: 'Nuovo desktop' }).click(); await vista.getByRole('button', { name: 'Nuovo desktop' }).click();
    await vista.getByRole('button', { name: /^Desktop 1/ }).click(); await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/pc-5-attivita.png` });
    // trascina la scheda dello Scan su Desktop 3
    const sch = await centro(vista.locator('.pv-scheda', { hasText: 'Poliedron Scan' }).locator('.pv-scheda-corpo')), d3 = await centro(vista.getByRole('button', { name: /^Desktop 3/ }));
    await page.mouse.move(sch.x, sch.y); await page.mouse.down(); await page.mouse.move(sch.x + 20, sch.y + 20, { steps: 3 }); await page.mouse.move(d3.x, d3.y, { steps: 12 }); await page.mouse.up();
    assert.equal(await vista.locator('.pv-scheda', { hasText: 'Poliedron Scan' }).count(), 0, 'Scan spostato in Desktop 3');
    assert.match(await vista.getByRole('button', { name: /^Desktop 3/ }).getAttribute('aria-label'), /1 finestre/);
    await page.keyboard.press('Escape'); await vista.locator('.pv-scrivanie').click({ position: { x: 5, y: 5 } }).catch(() => {});
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }
  console.log('personal-multitask PASS (telefono e computer)');
} finally { await browser?.close(); server.kill(); }
