// APP-AUTO-CASA-SALUTE (e RUBRICA): icone PNG e manifest delle app a sé Auto, Casa, Salute, Rubrica (Home del telefono).
// Uso: node scripts/icone-app-cose.mjs  → public/{auto,casa,salute,rubrica}-{180,192,512,maskable-512}.png e i manifest.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { DISEGNI, SFONDI } from './icone-app-cose-dati.mjs';

const APP = {
  auto: { nome: 'Poliedron Auto', breve: 'Auto', descrizione: 'Auto e motori: foto, assicurazione, bollo, revisione, tagliandi' },
  casa: { nome: 'Poliedron Casa', breve: 'Casa', descrizione: 'Casa: utenze, catasto, assicurazione, manutenzioni e contatti' },
  salute: { nome: 'Poliedron Salute', breve: 'Salute', descrizione: 'Salute: medico, tessera sanitaria, allergie, controlli, visite ed esami' },
  rubrica: { nome: 'Poliedron Rubrica', breve: 'Rubrica', descrizione: 'Rubrica: professionisti da chiamare, note e promemoria (gomme, stufa, caldaia)' },
};
const svg = (id, maskable) => {
  const [a, b] = SFONDI[id];
  const k = maskable ? 0.52 : 0.64, o = (24 - 24 * k) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    + `<rect width="24" height="24" ${maskable ? '' : 'rx="5.4"'} fill="url(#g)"/><g transform="translate(${o} ${o}) scale(${k})"><path d="${DISEGNI[id]}" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
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
