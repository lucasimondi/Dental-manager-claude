// APP-AUTO-CASA-SALUTE (e RUBRICA): icone PNG e manifest delle app a sé Auto, Casa, Salute, Rubrica (Home del telefono).
// Uso: node scripts/icone-app-cose.mjs  → public/{auto,casa,salute,rubrica}-{180,192,512,maskable-512}.png e i manifest.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { SFONDI } from './icone-app-cose-dati.mjs';
import { DISEGNI_COLORE } from '../personal/src/lib/iconeColore.js';

const APP = {
  auto: { nome: 'Poliedron Auto', breve: 'Auto', descrizione: 'Auto e motori: foto, assicurazione, bollo, revisione, tagliandi' },
  casa: { nome: 'Poliedron Casa', breve: 'Casa', descrizione: 'Casa: utenze, catasto, assicurazione, manutenzioni e contatti' },
  salute: { nome: 'Poliedron Salute', breve: 'Salute', descrizione: 'Salute: medico, tessera sanitaria, allergie, controlli, visite ed esami' },
  rubrica: { nome: 'Poliedron Rubrica', breve: 'Rubrica', descrizione: 'Rubrica: professionisti da chiamare, note e promemoria (gomme, stufa, caldaia)' },
};
// ICONE-START (PO 2026-11-26): l'icona a colori di Personal (stile Esplora file) su fondo bianco.
const svg = (id, maskable) => {
  const k = maskable ? 0.6 : 0.74, o = (48 - 48 * k) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="512" height="512">`
    + `<rect width="48" height="48" ${maskable ? '' : 'rx="10.8"'} fill="#FFFFFF"/><g transform="translate(${o} ${o}) scale(${k})">${DISEGNI_COLORE[id]}</g></svg>`;
};
const manifest = (id, base) => ({
  name: APP[id].nome, short_name: APP[id].breve, description: APP[id].descrizione,
  id: `${base}${id}/`, start_url: `${base}${id}/`, scope: `${base}${id}/`, display: 'standalone', orientation: 'portrait',
  background_color: '#f2f4f7', theme_color: SFONDI[id][1],
  icons: [{ src: `/${id}-192.png`, sizes: '192x192', type: 'image/png' }, { src: `/${id}-512.png`, sizes: '512x512', type: 'image/png' }, { src: `/${id}-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
});

const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const id of Object.keys(APP)) {
  for (const [nome, lato, maskable] of [['180', 180, false], ['192', 192, false], ['512', 512, false], ['maskable-512', 512, true]]) {
    await page.setViewportSize({ width: lato, height: lato });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(id, maskable).replace('width="512" height="512"', `width="${lato}" height="${lato}"`)}</body></html>`);
    await page.locator('svg').screenshot({ path: `public/${id}-${nome}.png`, omitBackground: true });
  }
  await writeFile(`public/${id}.webmanifest`, `${JSON.stringify(manifest(id, '/poliedron/'), null, 2)}\n`);
  await writeFile(`public/${id}-dominio.webmanifest`, `${JSON.stringify(manifest(id, '/'), null, 2)}\n`);
}
await browser.close();
console.log('icone e manifest scritti in public/');
