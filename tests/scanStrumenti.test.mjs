// SCAN-PDF-MANAGER (PO 2026-11-11) — raddrizza automatico, OCR (testo invisibile), compressione,
// firma/sigla/data. Solo dati sintetici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { trovaAngoli, omografia, applica, raddrizza, misureRaddrizzate, angoliValidi, angoliInteri, ANGOLI_INTERI, muoviAngolo } from '../personal/src/lib/prospettiva.js';
import { aggiungiTestoOcr, pdfDaImmagini, posizioniInserimento, convieneCompresso, formatoPeso, testoOggi } from '../personal/src/pdf/operazioni.js';
import { preparaAllegatiScan } from '../personal/src/lib/pdfUnico.js';

const JPEG = Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmaKKK8g/RD//Z', 'base64'));
const dentro = (p, q) => { let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; const z = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); if (z < 0) return false; s++; } return s === 4; };
function foto(w, h, quad, fondo = 40, carta = 235) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = quad && dentro({ x: x + .5, y: y + .5 }, quad) ? carta : fondo; const i = (y * w + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
  }
  return px;
}
const QUAD = [{ x: 60, y: 40 }, { x: 330, y: 70 }, { x: 310, y: 270 }, { x: 80, y: 250 }];

test('trovaAngoli finds a tilted sheet on a dark table', () => {
  const q = trovaAngoli(foto(400, 300, QUAD), 400, 300);
  assert.ok(q, 'sheet found');
  ['tl', 'tr', 'br', 'bl'].forEach((k, i) => {
    assert.ok(Math.abs(q[k].x - QUAD[i].x / 400) < .03 && Math.abs(q[k].y - QUAD[i].y / 300) < .03, `${k} ${JSON.stringify(q[k])}`);
  });
  assert.ok(angoliValidi(q));
});
test('trovaAngoli gives up on uniform or full-frame photos', () => {
  assert.equal(trovaAngoli(foto(200, 150, null), 200, 150), null);
  assert.equal(trovaAngoli(foto(200, 150, [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }]), 200, 150), null);
});
test('homography maps the four corners and the warp returns the sheet', () => {
  const dst = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 140 }, { x: 0, y: 140 }];
  const H = omografia(dst, QUAD);
  dst.forEach((p, i) => { const r = applica(H, p); assert.ok(Math.hypot(r.x - QUAD[i].x, r.y - QUAD[i].y) < 1e-6); });
  const q = { tl: { x: 60 / 400, y: 40 / 300 }, tr: { x: 330 / 400, y: 70 / 300 }, br: { x: 310 / 400, y: 270 / 300 }, bl: { x: 80 / 400, y: 250 / 300 } };
  const { w, h } = misureRaddrizzate(q, 400, 300, 2000);
  assert.ok(w > 250 && w < 280 && h > 200 && h < 240, `${w}x${h}`);
  const out = raddrizza(foto(400, 300, QUAD), 400, 300, q, w, h);
  let chiari = 0, tot = 0;
  for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) { tot++; if (out[(y * w + x) * 4] > 200) chiari++; }
  assert.ok(chiari / tot > .97, `${chiari / tot}`);
  assert.throws(() => omografia(dst, [QUAD[0], QUAD[0], QUAD[0], QUAD[0]]));
});
test('corner editing stays inside the photo and rejects crossed corners', () => {
  assert.ok(angoliInteri(ANGOLI_INTERI));
  const m = muoviAngolo(ANGOLI_INTERI, 'tl', -1, 2); assert.deepEqual(m.tl, { x: 0, y: 1 });
  assert.equal(angoliValidi({ ...ANGOLI_INTERI, tl: { x: 1, y: 1 }, br: { x: 0, y: 0 } }), false);
});

test('OCR words become invisible, extractable text and keep form fields', async () => {
  const doc = await PDFDocument.create(); const page = doc.addPage([595, 842]);
  const f = doc.getForm().createTextField('nome'); f.setText('ESEMPIO'); f.addToPage(page, { x: 20, y: 20, width: 100, height: 20 });
  const s = 2, transform = [s, 0, 0, -s, 0, 842 * s];
  const r = await aggiungiTestoOcr(await doc.save(), [{ page: 1, transform, parole: [
    { testo: 'Referto', x0: 100, y0: 100, x1: 260, y1: 140 }, { testo: 'ecografia', x0: 280, y0: 100, x1: 480, y1: 140 }, { testo: '✓', x0: 500, y0: 100, x1: 520, y1: 140 } ] }]);
  assert.equal(r.parole, 2);
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.js')).default;
  const letto = await pdfjs.getDocument({ data: new Uint8Array(r.bytes), isEvalSupported: false }).promise;
  const tc = await (await letto.getPage(1)).getTextContent();
  const testo = tc.items.map(t => t.str).join(' ');
  assert.match(testo, /Referto/); assert.match(testo, /ecografia/);
  const parola = tc.items.find(t => t.str === 'Referto');
  assert.ok(Math.abs(parola.transform[4] - 50) < 2, `x ${parola.transform[4]}`);
  assert.equal((await PDFDocument.load(r.bytes)).getForm().getTextField('nome').getText(), 'ESEMPIO');
  await letto.destroy();
});
test('compression rebuilds pages with the same size and is used only when smaller', async () => {
  const bytes = await pdfDaImmagini([{ jpeg: JPEG, larghezza: 595, altezza: 842 }, { jpeg: JPEG, larghezza: 842, altezza: 595 }], 'Prova');
  const doc = await PDFDocument.load(bytes);
  assert.deepEqual(doc.getPages().map(p => [p.getWidth(), p.getHeight()]), [[595, 842], [842, 595]]);
  assert.equal(doc.getTitle(), 'Prova');
  assert.equal(convieneCompresso(1000, 950), false); assert.equal(convieneCompresso(1000, 400), true); assert.equal(convieneCompresso(1000, 0), false);
  assert.equal(formatoPeso(2.5 * 1024 * 1024), '2,5 MB'); assert.equal(formatoPeso(300), '1 KB');
  await assert.rejects(pdfDaImmagini([]), /Nessuna pagina/);
});
test('signature, initials on every page and date land in their places', () => {
  const sigle = posizioniInserimento({ tipo: 'sigla', tutte: true, pagina: 2, pagine: 3, proporzione: .5, aspetto: () => 210 / 297 });
  assert.deepEqual(sigle.map(s => s.page), [1, 2, 3]);
  sigle.forEach(s => { assert.ok(s.x + s.width <= .95 && s.x > .7); assert.ok(s.y + s.height <= .96 && s.y > .8); });
  const [firma] = posizioniInserimento({ tipo: 'firma', pagina: 2, pagine: 3, proporzione: .3 });
  assert.equal(firma.page, 2); assert.equal(firma.x, .5);
  const [data] = posizioniInserimento({ tipo: 'data', tutte: true, pagina: 1, pagine: 1, proporzione: .2 });
  assert.equal(data.x, .08);
  assert.equal(testoOggi(new Date(2026, 10, 11)), '11/11/2026');
});
test('Scan OCR option reads every prepared file and reports progress', async () => {
  const doc = await PDFDocument.create(); doc.addPage([300, 300]);
  const file = new File([await doc.save()], 'a.pdf', { type: 'application/pdf' });
  const visti = [], messaggi = [];
  const fileRicercabile = async (f, { onAvanzamento }) => { visti.push(f.name); onAvanzamento('Leggo il testo… pagina 1 di 1'); return f; };
  const out = await preparaAllegatiScan([{ tipo: 'pdf', file }, { tipo: 'pdf', file }], 'X', true, { ocr: true, fileRicercabile, onAvanzamento: m => messaggi.push(m) });
  assert.equal(out.length, 2); assert.deepEqual(visti, ['a.pdf', 'a - 2.pdf']);
  assert.match(messaggi[1], /a - 2\.pdf \(2\/2\) · Leggo il testo/);
  const senza = await preparaAllegatiScan([{ tipo: 'pdf', file }], 'X', false, { ocr: false, fileRicercabile: () => assert.fail('no OCR') });
  assert.equal(senza.length, 1);
});
