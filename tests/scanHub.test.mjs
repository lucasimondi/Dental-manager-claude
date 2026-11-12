// SCAN-HUB (PO 2026-11-12) — Home di Scan come lo scanner di riferimento: carta d'identità fronte/retro
// su A4, Recenti solo sul telefono, Estrai testo. Solo dati sintetici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { A4, TESSERA, DIMENSIONI, adatta, riquadriFacce, daGirare, pdfFronteRetro } from '../personal/src/lib/fronteRetro.js';
import { gruppoData, formatoPeso, nomeAutomatico, nomeUnico, nuovoNome, filtraDocumenti, elencoCartelle, pulisciNome, CARTELLA_BASE } from '../personal/src/lib/libreria.js';
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
  assert.equal(file.type, 'application/pdf'); assert.equal(file.name, "Carta d'identità.pdf");
  const pdf = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
  assert.equal(pdf.getPageCount(), 1);
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1);
});
test('I miei documenti: automatic names, unique names, rename keeps extension, search in name and text, folders', () => {
  assert.equal(nomeAutomatico(new Date(2026, 10, 12, 13, 42)), 'Scansione 12-11-2026 13.42');
  assert.equal(nomeUnico('Referto.pdf', ['referto.pdf', 'Referto (2).pdf']), 'Referto (3).pdf');
  assert.equal(nomeUnico('Nuovo.pdf', ['Referto.pdf']), 'Nuovo.pdf');
  assert.equal(nuovoNome('Scansione 1.pdf', '  Ecografia/marzo  '), 'Ecografia marzo.pdf');
  assert.throws(() => nuovoNome('a.pdf', '   '));
  assert.equal(pulisciNome('a:b*c'), 'a b c');
  const docs = [
    { id: 1, nome: 'Ecografia.pdf', testo: 'Referto ECOGRAFIA addome', cartella: 'Salute', modificato: 3, dimensione: 10 },
    { id: 2, nome: 'Bolletta luce.pdf', testo: 'importo da pagare', cartella: CARTELLA_BASE, modificato: 5, dimensione: 30 },
    { id: 3, nome: 'Carta identità.pdf', testo: '', cartella: 'Salute', modificato: 1, dimensione: 20 },
  ];
  assert.deepEqual(filtraDocumenti(docs).map((d) => d.id), [2, 1, 3]);
  assert.deepEqual(filtraDocumenti(docs, { cerca: 'addome' }).map((d) => d.id), [1], 'search finds OCR text');
  assert.deepEqual(filtraDocumenti(docs, { cerca: 'identita' }).map((d) => d.id), [3], 'accents ignored');
  assert.deepEqual(filtraDocumenti(docs, { cartella: 'Salute', ordine: 'nome' }).map((d) => d.id), [3, 1]);
  assert.deepEqual(filtraDocumenti(docs, { ordine: 'peso' }).map((d) => d.id), [2, 3, 1]);
  assert.deepEqual(elencoCartelle(docs, ['Lavoro']), [{ nome: 'Generale', quanti: 1 }, { nome: 'Lavoro', quanti: 0 }, { nome: 'Salute', quanti: 2 }]);
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
  assert.match(scan, /<ScanHome /); assert.match(scan, /salvaDocumenti/); assert.match(scan, /<Documenti /);
  for (const t of ['scanner', 'tessera', 'testo', 'pdfStrumento']) assert.match(scan, new RegExp(`${t}: \\{`));
  const home = readFileSync('personal/src/scan/ScanHome.jsx', 'utf8');
  for (const n of ['Estrai testo', "Carta d'identità", 'Firma PDF', 'Comprimi PDF', 'Da album', 'Da file', 'Recenti', 'Tutti i documenti']) assert.ok(home.includes(n), n);
  assert.match(home, /capture="environment"/);
  const libreria = readFileSync('personal/src/lib/libreria.js', 'utf8');
  assert.match(libreria, /indexedDB/); assert.doesNotMatch(libreria, /fetch\(|supabase|archivioDb/);
  assert.match(libreria, /objectStoreNames\.contains\('recenti'\)/, 'old Recenti migrated, not lost');
  const tessera = readFileSync('personal/src/scan/CartaIdentita.jsx', 'utf8');
  assert.match(tessera, /fascicolo: 'identita', portafoglio: true/);
  assert.doesNotMatch(tessera + readFileSync('personal/src/scan/EstraiTesto.jsx', 'utf8'), /fetch\(|archivioDb|anthropic|openai/i);
  assert.match(readFileSync('personal/src/pdf/GestorePdf.jsx', 'utf8'), /strumento === 'comprimi'/);
});

// SCAN-MLKIT (PO 2026-11-12: «Ml kit») — app Android «Poliedra Scan» con lo scanner documenti di Google.
test('ponte Android: share and download go through the app, incoming files become File objects', async () => {
  const { ponte, inAppAndroid, daScannerNativo, installaPonte, daBase64 } = await import('../personal/src/lib/nativo.js');
  assert.equal(inAppAndroid({}), false); assert.equal(ponte({ PoliedraScan: {} }), null);
  const inviati = []; let ascolto = null;
  const p = { postMessage: (m) => inviati.push(JSON.parse(m)), addEventListener: (t, fn) => { ascolto = fn; } };
  const w = { PoliedraScan: p, navigator: {} };
  const ricevuti = [];
  assert.equal(installaPonte((files) => ricevuti.push(...files), w), true);
  assert.deepEqual(inviati[0], { azione: 'pronto' });
  assert.equal(w.navigator.canShare({ files: [new File(['x'], 'a.pdf')] }), true);
  await w.navigator.share({ files: [new File(['ciao'], 'Referto.pdf', { type: 'application/pdf' })], title: 'Referto' });
  assert.equal(inviati[1].azione, 'condividi'); assert.equal(inviati[1].files[0].nome, 'Referto.pdf');
  assert.equal(Buffer.from(inviati[1].files[0].dati, 'base64').toString(), 'ciao');
  await w.navigator.share({ title: 'Testo', text: 'riga' });
  assert.deepEqual(inviati[2], { azione: 'testo', testo: 'Testo\n\nriga' });
  ascolto({ data: JSON.stringify({ tipo: 'file', files: [{ nome: 'doc.pdf', mime: 'application/pdf', dati: Buffer.from('%PDF').toString('base64') }] }) });
  assert.equal(ricevuti[0].name, 'doc.pdf'); assert.equal(await ricevuti[0].text(), '%PDF');
  ascolto({ data: 'non json' });
  assert.equal(daBase64({ nome: 'x.jpg', mime: 'image/jpeg', dati: 'AA==' }).size, 1);
  assert.equal(daScannerNativo({ name: 'scan-mlkit-1-1.jpg' }), true); assert.equal(daScannerNativo({ name: 'foto.jpg' }), false);
});
test('Android app: ML Kit scanner for every capture input, origin-locked bridge, private cache, no extra permissions', () => {
  const java = readFileSync('android/scan/app/src/main/java/it/poliedrasoft/scan/MainActivity.java', 'utf8');
  assert.match(java, /GmsDocumentScanning\.getClient/); assert.match(java, /isCaptureEnabled\(\)/);
  assert.match(java, /scan-mlkit-/); assert.match(java, /Collections\.singleton\(ORIGIN\)/);
  assert.match(java, /"https:\/\/personal\.poliedrasoft\.it"/); assert.doesNotMatch(java, /addJavascriptInterface/);
  assert.match(java, /handler\.cancel\(\)/); assert.match(java, /setAllowFileAccess\(false\)/);
  const manifest = readFileSync('android/scan/app/src/main/AndroidManifest.xml', 'utf8');
  assert.deepEqual([...manifest.matchAll(/uses-permission android:name="([^"]+)"/g)].map((m) => m[1]), ['android.permission.INTERNET']);
  assert.match(manifest, /allowBackup="false"/); assert.match(manifest, /FileProvider[^>]*exported="false"/);
  assert.match(readFileSync('android/scan/app/build.gradle', 'utf8'), /play-services-mlkit-document-scanner/);
  assert.match(readFileSync('personal/src/Aggiungi.jsx', 'utf8'), /capture="environment" multiple/);
});
