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
  assert.deepEqual(errors, []);
  console.log('PASS Pixel 7 (fotocamera finta): contorno del foglio, scatto automatico e manuale, pagine raddrizzate e senza ombra.');
} finally { await browser?.close(); server.kill(); }
