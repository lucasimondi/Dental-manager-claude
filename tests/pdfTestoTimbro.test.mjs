// PDF-TESTO e PDF-TIMBRO (PO 2026-11-24): testo spostabile con carattere/colore/grandezza scritto come
// testo vero; timbro configurabile con impronta d'inchiostro irregolare e ripetibile col seme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import { CARATTERI, normalizzaStile, caratterePdf, righe, riquadroTesto, limitaPosizione, grandezzaDaLarghezza, coloreRgb, posizioniRighe, testoScrivibile } from '../personal/src/pdf/testoPdf.js';
import { incorporaFirme, posizioniInserimento } from '../personal/src/pdf/operazioni.js';
import { normalizzaTimbro, righeUsate, timbroVuoto, misureTimbro, rumore, impronta, inclinazione, dataOggi, MAX_RIGHE } from '../personal/src/pdf/timbro.js';

const gestore = readFileSync('personal/src/pdf/GestorePdf.jsx', 'utf8');
const timbroJsx = readFileSync('personal/src/pdf/Timbro.jsx', 'utf8');
const mono = (riga) => riga.length * 0.6; // ogni carattere largo 0,6 della grandezza

test('testo: stile normalizzato, caratteri standard del PDF, righe', () => {
  assert.deepEqual(normalizzaStile({ carattere: 'xx', colore: 'fucsia', grandezza: 500 }), { carattere: 'moderno', colore: 'nero', grandezza: 72, grassetto: false, corsivo: false });
  assert.equal(normalizzaStile({ grandezza: 2 }).grandezza, 6);
  assert.equal(caratterePdf({ carattere: 'classico', grassetto: true, corsivo: true }), 'TimesRomanBoldItalic');
  assert.equal(caratterePdf({ carattere: 'macchina', grassetto: false, corsivo: true }), 'CourierOblique');
  assert.equal(caratterePdf({ carattere: 'moderno', grassetto: true, corsivo: false }), 'HelveticaBold');
  assert.deepEqual(righe('a  \r\nb\n'), ['a', 'b', '']);
  assert.deepEqual(coloreRgb('#ff8000'), { r: 1, g: 128 / 255, b: 0 });
  assert.equal(testoScrivibile('ciao 😀 è', (ch) => { if (ch.codePointAt(0) > 255) throw new Error('no'); }), 'ciao ? è');
});

test('testo: riquadro dalle misure, grandezza con ↘, sempre dentro la pagina', () => {
  const stile = normalizzaStile({ grandezza: 10 });
  const r = riquadroTesto('abcde\nab', stile, { w: 600, h: 800 }, mono);
  assert.ok(Math.abs(r.width - (5 * 0.6 * 10 + 2) / 600) < 1e-9);
  assert.ok(Math.abs(r.height - 2 * 10 * 1.2 / 800) < 1e-9);
  assert.equal(grandezzaDaLarghezza(stile, 0.1, 0.2), 20);
  assert.equal(grandezzaDaLarghezza(stile, 0.1, 10), 72);
  assert.deepEqual(limitaPosizione({ x: 0.95, y: -1, width: 0.2, height: 0.1 }), { x: 0.8, y: 0, width: 0.2, height: 0.1 });
});

test('testo: righe nel PDF dalla posizione, anche con la pagina ruotata', () => {
  const [a, b] = posizioniRighe({ x: 100, y: 200, width: 300, height: 48, rotation: 0 }, 2, 0.9);
  assert.equal(a.size, 20);
  assert.ok(Math.abs(a.y - (200 + 48 - 18)) < 1e-9 && Math.abs(b.y - (a.y - 24)) < 1e-9 && Math.abs(a.x - 102) < 1e-9);
  const [r] = posizioniRighe({ x: 100, y: 200, width: 300, height: 24, rotation: 90 }, 1, 0.9);
  assert.ok(Math.abs(r.x - (100 - 6)) < 1e-9 && Math.abs(r.y - 202) < 1e-9, 'ruotato di 90°: la base si sposta a sinistra');
});

test('testo: incorporato come testo vero con il carattere scelto (non immagine)', async () => {
  const d = await PDFDocument.create(); d.addPage([595, 842]);
  const out = await PDFDocument.load(await incorporaFirme(await d.save(), [{ page: 1, testo: 'Ciao è €', stile: { carattere: 'macchina', grassetto: true, colore: 'rosso', grandezza: 12 }, position: { x: 50, y: 700, width: 100, height: 14.4, rotation: 0 } }]));
  const fonts = out.getPage(0).node.Resources().lookup(PDFName.of('Font'));
  assert.deepEqual(fonts.keys().map((k) => fonts.lookup(k).get(PDFName.of('BaseFont')).toString()), ['/Courier-Bold']);
  const xo = out.getPage(0).node.Resources().lookup(PDFName.of('XObject'));
  assert.equal(xo ? xo.keys().length : 0, 0, 'nessuna immagine');
});

test('gestore: «Testo» apre il pannello (niente editor PDF.js), elemento trascinabile e modificabile; «Timbro»', () => {
  assert.doesNotMatch(gestore, /\['Testo', pdfjs\.AnnotationEditorType\.FREETEXT\]/);
  assert.match(gestore, /setTestoAperto\(\{\}\); \}\}>Testo<\/button>/);
  assert.match(gestore, /strumento === 'modifica'\) setTestoAperto\(\{\}\)/);
  assert.match(gestore, /onEdit=\{\(\) => setTestoAperto\(s\)\}/);
  assert.match(gestore, /setTimbroAperto\(true\); \}\}>Timbro<\/button>/);
  assert.match(gestore, /if \(tipo === 'firma' \|\| tipo === 'sigla'\) firmatoRef\.current = true/, 'timbro e data non rendono «firmato» il documento');
  const [p] = posizioniInserimento({ tipo: 'timbro', proporzione: 0.5 });
  assert.ok(p.x > 0.5 && p.y > 0.6 && p.width === 0.3, 'timbro in basso a destra');
});

test('timbro: configurazione normalizzata, righe usate, vuoto', () => {
  const t = normalizzaTimbro({ righe: ['  Studio ', '', 'x'.repeat(60)], forma: 'esagono', inchiostro: 'oro', carico: 'tanto' });
  assert.equal(t.righe.length, MAX_RIGHE);
  assert.equal(t.righe[2].length, 40);
  assert.equal(t.forma, 'rettangolo'); assert.equal(t.inchiostro, 'blu'); assert.equal(t.carico, 'normale');
  assert.deepEqual(righeUsate(t), ['Studio', 'x'.repeat(40)]);
  assert.ok(timbroVuoto(normalizzaTimbro({ righe: [], data: false })));
  assert.ok(!timbroVuoto(normalizzaTimbro({ righe: [], data: true })));
  assert.equal(dataOggi(new Date(2026, 10, 4)), '04/11/2026');
});

test('timbro: misure secondo la forma (tondo quadrato, ovale più largo del rettangolo)', () => {
  const l = (x) => x.length * 0.5;
  const base = { righe: ['STUDIO DENTISTICO', 'ROMA', 'Dott. Rossi', ''], data: true };
  const rett = misureTimbro(normalizzaTimbro({ ...base, forma: 'rettangolo' }), l);
  const ovale = misureTimbro(normalizzaTimbro({ ...base, forma: 'ovale' }), l);
  const tondo = misureTimbro(normalizzaTimbro({ ...base, forma: 'tondo' }), l);
  assert.equal(tondo.w, tondo.h);
  assert.ok(ovale.w > rett.w && ovale.h > rett.h);
  assert.ok(rett.w > 17 * 0.5 * 1.12 && rett.h > 4 * 1.3);
});

test('timbro: impronta irregolare (gradiente, chiazze, puntini vuoti) e ripetibile col seme', () => {
  const k = impronta(42), k2 = impronta(42), altro = impronta(43);
  const valori = []; for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) valori.push(k(x / 60, y / 60));
  assert.deepEqual(valori.slice(0, 50), Array.from({ length: 50 }, (_, i) => k2((i % 60) / 60, 0)));
  assert.ok(valori.every((v) => v >= 0 && v <= 1));
  const media = valori.reduce((a, b) => a + b, 0) / valori.length;
  assert.ok(media > 0.45 && media < 0.9, `media ${media}`);
  assert.ok(valori.filter((v) => v < 0.2).length > valori.length * 0.03, 'qualche puntino senza inchiostro');
  assert.ok(Math.max(...valori) - Math.min(...valori) > 0.6, 'non uniforme');
  assert.notEqual(k(0.3, 0.3), altro(0.3, 0.3));
  const media2 = (c) => { let s = 0; for (let i = 0; i < 3600; i++) s += impronta(5, c)((i % 60) / 60, Math.floor(i / 60) / 60); return s / 3600; };
  assert.ok(media2('carico') > media2('normale') && media2('normale') > media2('leggero'), 'più inchiostro → impronta più piena');
  const r = rumore(1, 4); assert.ok(Math.abs(r(0.5, 0.5) - r(0.5001, 0.5)) < 0.01, 'rumore morbido');
  for (let s = 1; s < 50; s++) { const a = Math.abs(inclinazione(s)) * 180 / Math.PI; assert.ok(a >= 0.8 && a <= 4.01, `inclinazione ${a}`); }
});

test('timbro: configurazione ricordata, seme nuovo a ogni timbro, impronta applicata ai pixel', () => {
  assert.match(timbroJsx, /personal-pdf-timbro-v1/);
  assert.match(timbroJsx, /crypto\.getRandomValues/);
  assert.match(timbroJsx, /px\[i\] = px\[i\] \* k\(/);
  assert.match(timbroJsx, /o\.rotate\(a\)/);
});
