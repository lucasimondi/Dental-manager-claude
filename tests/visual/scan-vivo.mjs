// SCAN-VIVO — Pixel 7 con fotocamera finta (video sintetico: foglio bianco con righe di testo e
// un'ombra, su un tavolo scuro). Lo scanner si apre dalla Home direttamente sulla fotocamera, trova il
// foglio, lo contorna e scatta da solo; la pagina arriva raddrizzata e con la carta bianca; Fine torna
// all'elenco. Nessun dato reale, rete bloccata.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-scan-vivo'; await mkdir(out, { recursive: true });
// Video Y4M 640×480 (4:2:0): tavolo scuro, foglio inclinato, righe di testo, ombra a destra.
const W = 640, H = 480, Y = new Uint8Array(W * H), UV = new Uint8Array((W / 2) * (H / 2)).fill(128);
const foglio = [[200, 40], [450, 62], [432, 455], [182, 435]];
const dentro = (x, y) => { let c = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = foglio[i], [xj, yj] = foglio[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let v = 38 + ((x * 7 + y * 13) % 9);
  if (dentro(x, y)) { v = x > 340 ? 150 : 225; if ((y % 26) < 4 && x > 220 && x < 410 && y > 100 && y < 400) v = 40; }
  Y[y * W + x] = v;
}
const fotogramma = Buffer.concat([Buffer.from('FRAME\n'), Buffer.from(Y), Buffer.from(UV), Buffer.from(UV)]);
const video = `${out}/foglio.y4m`;
await writeFile(video, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), ...Array(20).fill(fotogramma)]));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5179')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] });
  const context = await browser.newContext({ ...devices['Pixel 7'], permissions: ['camera'] }); const page = await context.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:5179/tests/visual/personal-scan.html');
  await page.getByRole('button', { name: 'Scatta e scansiona' }).click();
  const cam = page.getByRole('dialog', { name: 'Scanner' }); await cam.waitFor();
  await page.locator('.scan-camera-contorno polygon').waitFor({ timeout: 10000 });
  const contorno = await page.locator('.scan-camera-contorno polygon').getAttribute('points');
  const p = contorno.split(' ').map((c) => c.split(',').map(Number));
  assert.ok(Math.abs(p[0][0] - 200 / W) < 0.05 && Math.abs(p[0][1] - 40 / H) < 0.05 && Math.abs(p[2][0] - 432 / W) < 0.05, `contorno del foglio ${contorno}`);
  await page.screenshot({ path: `${out}/1-inquadratura.png` });
  await page.getByRole('button', { name: /Fine, 1 pagina/ }).waitFor({ timeout: 12000 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nessuno sforamento');
  await page.screenshot({ path: `${out}/2-scattata.png` });
  // Manuale: nessuno scatto automatico, il pulsante scatta.
  await cam.getByRole('radio', { name: 'Manuale' }).click();
  await page.waitForTimeout(2500);
  assert.equal(await page.getByRole('button', { name: /Fine, 1 pagina/ }).count(), 1, 'in manuale non scatta da sola');
  await cam.getByRole('button', { name: 'Scatta', exact: true }).click();
  await page.getByRole('button', { name: /Fine, 2 pagine/ }).waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: /Fine, 2 pagine/ }).click();
  await page.locator('.pp-scansione-pagina img').nth(1).waitFor();
  assert.equal(await page.locator('.pp-scansione-pagina').count(), 2);
  assert.equal(await page.locator('.pp-scan-auto').count(), 2, 'pagine raddrizzate');
  const carta = await page.locator('.pp-scansione-pagina img').first().evaluate(async (img) => {
    await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const media = (x0, x1) => { const d = g.getImageData(Math.round(c.width * x0), Math.round(c.height * 0.05), Math.round(c.width * (x1 - x0)), Math.round(c.height * 0.08)).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]; return s / (d.length / 4); };
    return { sinistra: media(0.05, 0.3), destra: media(0.75, 0.95), w: c.width, h: c.height };
  });
  assert.ok(carta.sinistra > 225 && carta.destra > 225, `carta bianca anche nell'ombra ${JSON.stringify(carta)}`);
  assert.ok(carta.h > carta.w, 'foglio verticale raddrizzato');
  await page.screenshot({ path: `${out}/3-elenco.png` });
  assert.ok(!(await page.locator('.scan-camera').count()), 'fotocamera chiusa');
  // SCAN-LENTE: trascinando un angolo compare la lente lontana dal dito; l'angolo segue lo spostamento.
  await page.getByRole('button', { name: 'Raddrizza o ritaglia pagina 1' }).click();
  const ritaglio = page.getByRole('dialog', { name: 'Raddrizza il foglio' }); await ritaglio.waitFor();
  const angolo = await ritaglio.getByRole('button', { name: 'Angolo in basso a destra' }).boundingBox();
  const cdp = await context.newCDPSession(page);
  const tocco = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const x0 = angolo.x + angolo.width / 2 + 12, y0 = angolo.y + angolo.height / 2 + 10;   // preso di lato
  await tocco('touchStart', x0, y0); for (let i = 1; i <= 6; i++) await tocco('touchMove', x0 - i * 5, y0 - i * 4);
  const lente = page.locator('.pp-lente'); await lente.waitFor();
  const lb = await lente.boundingBox(), area = await page.locator('.pp-ritaglio-quadro').boundingBox();
  assert.ok(lb.y < area.y + area.height / 2 && lb.x < area.x + area.width / 2, 'lente in alto a sinistra, lontana dal dito in basso a destra');
  await page.screenshot({ path: `${out}/4-lente.png` });
  await tocco('touchEnd');
  assert.equal(await lente.count(), 0, 'la lente sparisce al rilascio');
  const dopo = await ritaglio.getByRole('button', { name: 'Angolo in basso a destra' }).boundingBox();
  assert.ok(Math.abs((dopo.x - angolo.x) + 30) < 4 && Math.abs((dopo.y - angolo.y) + 24) < 4, `l'angolo segue lo spostamento del dito (${dopo.x - angolo.x}, ${dopo.y - angolo.y})`);
  await page.goBack(); await ritaglio.waitFor({ state: 'detached' });
  // SCAN-POLIEDRON e SCAN-INDIETRO: finestra Poliedron, ‹ e Indietro del telefono.
  await page.locator('.pp-sorgenti-rapide').getByRole('button', { name: 'Poliedron', exact: true }).click();
  const scegli = page.getByRole('dialog', { name: 'Scegli da Poliedron' }); await scegli.waitFor();
  await scegli.getByRole('button', { name: /Recenti/ }).click();
  await scegli.locator('.scan-finestra-testa strong', { hasText: 'Recenti' }).waitFor();
  await page.screenshot({ path: `${out}/5-poliedron.png` });
  await page.goBack();
  await scegli.locator('.scan-finestra-testa strong', { hasText: 'Poliedron' }).waitFor();
  await scegli.getByRole('button', { name: 'Chiudi' }).click();
  await scegli.waitFor({ state: 'detached' });
  assert.equal(await page.locator('.pp-pagina-titolo', { hasText: 'Scanner' }).count(), 1, 'si resta nello scanner');
  // Indietro del telefono sulla fotocamera: chiude la fotocamera, non lo Scan.
  await page.locator('.pp-sorgenti-rapide').getByRole('button', { name: /Scatta/ }).click();
  await page.getByRole('dialog', { name: 'Scanner' }).waitFor();
  await page.goBack(); await page.locator('.scan-camera').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.pp-scansione-pagina').count(), 2, 'pagine ancora lì');
  assert.deepEqual(errors, []);
  console.log('PASS Pixel 7 (fotocamera finta): contorno, scatto automatico e manuale, pagine raddrizzate e senza ombra, lente nel ritaglio, finestra Poliedron, Indietro del telefono.');
} finally { await browser?.close(); server.kill(); }
