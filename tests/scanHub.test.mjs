// SCAN-HUB (PO 2026-11-12) — Home di Scan come lo scanner di riferimento: carta d'identità fronte/retro
// su A4, Recenti solo sul telefono, Estrai testo. Solo dati sintetici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { A4, TESSERA, DIMENSIONI, adatta, riquadriFacce, daGirare, pdfFronteRetro } from '../personal/src/lib/fronteRetro.js';
import { daTogliere, gruppoData, formatoPeso, MAX_RECENTI } from '../personal/src/lib/recenti.js';
import { testoDaBlocchi } from '../personal/src/pdf/testo.js';

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmaKKK8g/RD//Z';

test('fronte e retro: real ID-1 size, centred, upper and lower half of A4, no overlap', () => {
  const [f, r] = riquadriFacce(2);
  assert.ok(Math.abs(f.w - TESSERA.w) < 1e-9 && Math.abs(f.h - TESSERA.h) < 1e-9);
  assert.ok(Math.abs(f.x - (A4.w - TESSERA.w) / 2) < 1e-9);
  assert.ok(f.y > 0 && f.y + f.h < A4.h / 2 && r.y > A4.h / 2 - 20 && r.y + r.h < A4.h);
  assert.ok(f.y + f.h < r.y, 'faces do not overlap');
  const [g] = riquadriFacce(1, { larghezza: DIMENSIONI.grande });
  assert.equal(g.w, 150); assert.ok(g.x >= 15);
  assert.equal(riquadriFacce(2, { larghezza: 999 })[0].w, A4.w - 30, 'never wider than the sheet margin');
  assert.throws(() => riquadriFacce(3));
});
test('adatta keeps proportions inside the box', () => {
  const r = adatta(1000, 500, { x: 10, y: 20, w: 85.6, h: 54 });
  assert.ok(Math.abs(r.w / r.h - 2) < 1e-9 && r.w <= 85.6 && r.h <= 54 && r.x >= 10 && r.y >= 20);
  assert.throws(() => adatta(0, 10, { x: 0, y: 0, w: 1, h: 1 }));
  assert.equal(daGirare(600, 950), true); assert.equal(daGirare(950, 600), false);
});
test('pdfFronteRetro makes one A4 portrait page', async () => {
  const facce = [{ url: JPEG, larghezza: 856, altezza: 540 }, { url: JPEG, larghezza: 856, altezza: 540 }];
  const file = await pdfFronteRetro(facce, { nome: "Carta d'identità" });
  assert.equal(file.type, 'application/pdf'); assert.match(file.name, /^Carta d identit/);
  const pdf = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
  assert.equal(pdf.getPageCount(), 1);
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1);
});
test('Recenti: oldest leave beyond the count or size limit, the newest always stays', () => {
  const el = Array.from({ length: MAX_RECENTI + 3 }, (_, i) => ({ id: `r${i}`, data: 1000 + i, dimensione: 10 }));
  assert.deepEqual(daTogliere(el).sort(), ['r0', 'r1', 'r2']);
  assert.deepEqual(daTogliere([{ id: 'a', data: 2, dimensione: 90 }, { id: 'b', data: 1, dimensione: 20 }], { maxBytes: 100 }), ['b']);
  assert.deepEqual(daTogliere([{ id: 'grande', data: 2, dimensione: 500 }], { maxBytes: 100 }), []);
  const ora = new Date(2026, 10, 12, 13, 42).getTime();
  assert.equal(gruppoData(ora - 3600e3, ora), 'Oggi');
  assert.equal(gruppoData(ora - 86400e3, ora), 'Ieri');
  assert.equal(gruppoData(ora - 4 * 86400e3, ora), 'Entro 7 giorni');
  assert.equal(gruppoData(ora - 30 * 86400e3, ora), 'Precedenti');
  assert.equal(formatoPeso(31 * 1024), '31 KB'); assert.equal(formatoPeso(2.5 * 1024 * 1024), '2,5 MB');
});
test('Estrai testo: paragraphs and lines kept, low-confidence words dropped', () => {
  const w = (text, confidence = 90) => ({ text, confidence });
  const blocks = [{ paragraphs: [
    { lines: [{ words: [w('REFERTO'), w('ECOGRAFIA')] }, { words: [w('Paziente'), w('di'), w('prova'), w('~~', 5)] }] },
    { lines: [{ words: [w('Conclusioni:'), w('nella'), w('norma.')] }] },
  ] }];
  assert.equal(testoDaBlocchi(blocks), 'REFERTO ECOGRAFIA\nPaziente di prova\n\nConclusioni: nella norma.');
  assert.equal(testoDaBlocchi([]), '');
});
test('Scan opens on its Home with tools, recents and camera; everything stays on the device', () => {
  const scan = readFileSync('personal/src/scan/Scan.jsx', 'utf8');
  assert.match(scan, /<ScanHome /); assert.match(scan, /ricordaFile/);
  for (const t of ['scanner', 'tessera', 'testo', 'pdfStrumento']) assert.match(scan, new RegExp(`${t}: \\{`));
  const home = readFileSync('personal/src/scan/ScanHome.jsx', 'utf8');
  for (const n of ['Estrai testo', "Carta d'identità", 'Firma PDF', 'Comprimi PDF', 'Da album', 'Da file', 'Recenti']) assert.ok(home.includes(n), n);
  assert.match(home, /capture="environment"/);
  const recenti = readFileSync('personal/src/lib/recenti.js', 'utf8');
  assert.match(recenti, /indexedDB/); assert.doesNotMatch(recenti, /fetch\(|supabase|archivioDb/);
  const tessera = readFileSync('personal/src/scan/CartaIdentita.jsx', 'utf8');
  assert.match(tessera, /fascicolo: 'identita', portafoglio: true/);
  assert.doesNotMatch(tessera + readFileSync('personal/src/scan/EstraiTesto.jsx', 'utf8'), /fetch\(|archivioDb|anthropic|openai/i);
  assert.match(readFileSync('personal/src/pdf/GestorePdf.jsx', 'utf8'), /strumento === 'comprimi'/);
});
