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
  assert.match(scan, /capture="environment"/); assert.match(scan, /Scatta e scansiona/); // SCAN-ORGANIZZA: fotocamera al centro della barra
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

// SCAN-OCR-MLKIT (PO 2026-11-12: «fai tutto tu») — OCR di Google ML Kit nell'app Android.
test('OCR nativo: request/response by id through the bridge, errors and timeouts reported', async () => {
  const { ocrNativo } = await import('../personal/src/lib/nativo.js');
  const inviati = []; let ascolto = null;
  const p = { postMessage: (m) => inviati.push(JSON.parse(m)), addEventListener: (t, fn) => { ascolto = fn; } };
  const attesa = ocrNativo(['data:image/jpeg;base64,QUJD'], p);
  assert.equal(inviati[0].azione, 'ocr'); assert.deepEqual(inviati[0].immagini, ['QUJD']);
  ascolto({ data: JSON.stringify({ tipo: 'ocr', id: 'altro', pagine: [] }) });
  ascolto({ data: JSON.stringify({ tipo: 'ocr', id: inviati[0].id, pagine: [{ testo: 'REFERTO', larghezza: 10, altezza: 10, parole: [{ testo: 'REFERTO', x0: 1, y0: 1, x1: 9, y1: 4 }] }] }) });
  const [pagina] = await attesa;
  assert.equal(pagina.testo, 'REFERTO'); assert.equal(pagina.parole[0].x1, 9);
  const fallita = ocrNativo(['QUJD'], p);
  ascolto({ data: JSON.stringify({ tipo: 'ocr', id: inviati[1].id, errore: 'modello assente' }) });
  await assert.rejects(fallita, /modello assente/);
  await assert.rejects(ocrNativo(['QUJD'], p, 5), /troppo lento/);
  await assert.rejects(ocrNativo(['QUJD'], null), /non disponibile/);
});
test('Android OCR: ML Kit text recognition bundled, words with boxes, web uses it inside the app', () => {
  assert.match(readFileSync('android/scan/app/build.gradle', 'utf8'), /com\.google\.mlkit:text-recognition/);
  const java = readFileSync('android/scan/app/src/main/java/it/poliedrasoft/scan/MainActivity.java', 'utf8');
  assert.match(java, /TextRecognition\.getClient/); assert.match(java, /getBoundingBox\(\)/); assert.match(java, /"ocr"\.equals\(azione\)/);
  const ocr = readFileSync('personal/src/pdf/ocr.js', 'utf8');
  assert.match(ocr, /inAppAndroid\(\)/); assert.match(ocr, /ocrNativo\(/); assert.match(ocr, /export async function testoPerRicerca/);
  assert.match(readFileSync('personal/src/scan/Scan.jsx', 'utf8'), /testoPerRicerca/);
});

// SCAN-ESPORTA — Word, JPG e testo dai documenti della libreria.
test('Esporta: paragraphs from OCR text and a real .docx from a text file', async () => {
  const { paragrafi, wordDa, testoTxtDa, FORMATI } = await import('../personal/src/scan/esporta.js');
  assert.deepEqual(paragrafi('REFERTO\nPaziente di prova\n\n\nConclusioni:  nella norma.\n'), [['REFERTO', 'Paziente di prova'], ['Conclusioni:  nella norma.']]);
  assert.deepEqual(FORMATI.map(([f]) => f), ['docx', 'jpg', 'txt']);
  const [docx] = await wordDa(new File(['FATTURA\nTotale 120\n\nGrazie'], 'Bolletta.txt', { type: 'text/plain' }));
  assert.equal(docx.name, 'Bolletta.docx');
  const zip = Buffer.from(await docx.arrayBuffer());
  assert.equal(zip.subarray(0, 2).toString(), 'PK', 'docx is a zip');
  assert.ok(zip.includes(Buffer.from('word/document.xml')));
  const [txt] = await testoTxtDa(new File(['ciao'], 'Nota.txt', { type: 'text/plain' }));
  assert.equal(txt.name, 'Nota.txt'); assert.equal(await txt.text(), 'ciao');
  await assert.rejects(wordDa(new File(['  '], 'Vuoto.txt', { type: 'text/plain' })), /Nessun testo/);
});

// SCAN-TRADUCI + SCAN-IMPOSTAZIONI (passo 4)
test('Traduci: request through the bridge, detected language returned, unavailable outside the app', async () => {
  const { traduciNativo } = await import('../personal/src/lib/nativo.js');
  const inviati = []; let ascolto = null;
  const p = { postMessage: (m) => inviati.push(JSON.parse(m)), addEventListener: (t, fn) => { ascolto = fn; } };
  const r = traduciNativo('Buongiorno', { a: 'en' }, p);
  assert.deepEqual({ azione: inviati[0].azione, testo: inviati[0].testo, da: inviati[0].da, a: inviati[0].a }, { azione: 'traduci', testo: 'Buongiorno', da: 'auto', a: 'en' });
  ascolto({ data: JSON.stringify({ tipo: 'traduzione', id: inviati[0].id, testo: 'Good morning', da: 'it' }) });
  assert.deepEqual(await r, { testo: 'Good morning', da: 'it' });
  const ko = traduciNativo('x', {}, p);
  ascolto({ data: JSON.stringify({ tipo: 'traduzione', id: inviati[1].id, errore: 'modello non scaricato' }) });
  await assert.rejects(ko, /modello non scaricato/);
  await assert.rejects(traduciNativo('x', {}, null), /app Poliedra Scan/);
  const java = readFileSync('android/scan/app/src/main/java/it/poliedrasoft/scan/MainActivity.java', 'utf8');
  assert.match(java, /Translation\.getClient/); assert.match(java, /LanguageIdentification\.getClient/); assert.match(java, /downloadModelIfNeeded/);
});
test('Impostazioni di Scan: defaults, booleans compatible with the scanner keys, unknown keys refused', async () => {
  const { leggiImpostazione, salvaImpostazione, PREDEFINITE, LINGUE } = await import('../personal/src/scan/impostazioniScan.js');
  const m = new Map(); const memoria = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
  assert.equal(leggiImpostazione('scan-raddrizza-auto', memoria), true);
  salvaImpostazione('scan-ocr', true, memoria); assert.equal(m.get('scan-ocr'), '1'); assert.equal(leggiImpostazione('scan-ocr', memoria), true);
  salvaImpostazione('scan-cartella', 'Salute', memoria); assert.equal(leggiImpostazione('scan-cartella', memoria), 'Salute');
  assert.throws(() => salvaImpostazione('altro', 1, memoria));
  assert.equal(PREDEFINITE['scan-prefisso'], 'Scansione'); assert.ok(LINGUE.some(([c]) => c === 'en'));
  assert.match(readFileSync('personal/src/Aggiungi.jsx', 'utf8'), /useScelta\('scan-ocr', false\)/, 'same key as the scanner checkbox');
});

// SCAN-ORGANIZZA (PO 2026-11-12: «Prova con a b d»)
test('Categorie: chosen from origin, name and OCR text; identity documents win over generic words', async () => {
  const { categoriaDa, CATEGORIE, avvisoScadenza, normalizzaEtichette } = await import('../personal/src/scan/categorie.js');
  assert.equal(CATEGORIE.length, 10);
  assert.equal(categoriaDa({ nome: "Carta d'identità.pdf" }), 'identita');
  assert.equal(categoriaDa({ nome: 'Patente di guida.pdf' }), 'patente');
  assert.equal(categoriaDa({ nome: 'Scansione 12-11-2026 13.42.pdf', testo: 'ENEL Energia — bolletta della luce, importo da pagare 120 €' }), 'bollette');
  assert.equal(categoriaDa({ nome: 'Scansione.pdf', testo: 'REFERTO ECOGRAFIA ADDOME' }), 'salute');
  assert.equal(categoriaDa({ nome: 'Scansione.pdf', testo: 'Documento commerciale — TOTALE 12,50 €' }), 'spese');
  assert.equal(categoriaDa({ nome: 'Passaporto Mario.pdf', testo: 'totale €' }), 'passaporto', 'name before text');
  assert.equal(categoriaDa({ nome: 'Appunti.txt', testo: 'lista della spesa' }), 'generali');
  const oggi = new Date(2026, 10, 12);
  assert.equal(avvisoScadenza('2026-12-27', oggi).testo, 'scade tra 45 giorni');
  assert.equal(avvisoScadenza('2026-11-01', oggi).scaduto, true);
  assert.equal(avvisoScadenza('2027-06-01', oggi), null, 'more than 90 days: no warning');
  assert.equal(avvisoScadenza('', oggi), null);
  assert.deepEqual(normalizzaEtichette(['#Ecografia', 'ecografia', 'Mutuo Casa', '  ']), ['ecografia', 'mutuo-casa']);
});
test('Libreria: filters by category, file type, favourites, archived and #tag', async () => {
  const { filtraDocumenti, tipoDi } = await import('../personal/src/lib/libreria.js');
  const docs = [
    { id: 1, nome: 'Referto.pdf', tipo: 'application/pdf', categoria: 'salute', preferito: true, archiviato: false, tag: ['ecografia'], modificato: 3, testo: '' },
    { id: 2, nome: 'Luce.pdf', tipo: 'application/pdf', categoria: 'bollette', preferito: false, archiviato: true, tag: [], modificato: 2, testo: '' },
    { id: 3, nome: 'Scontrino.jpg', tipo: 'image/jpeg', categoria: 'spese', preferito: false, archiviato: false, tag: [], modificato: 1, testo: '' },
    { id: 4, nome: 'Preventivo.docx', tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', modificato: 0, testo: '' },
  ];
  const ids = (f) => filtraDocumenti(docs, f).map((d) => d.id);
  assert.deepEqual(ids({ categoria: 'salute' }), [1]);
  assert.deepEqual(ids({ categoria: 'generali' }), [4], 'no category = Documenti generali');
  assert.deepEqual(ids({ tipo: 'foto' }), [3]); assert.deepEqual(ids({ tipo: 'word' }), [4]);
  assert.deepEqual(ids({ preferiti: true }), [1]); assert.deepEqual(ids({ archiviati: true }), [2]);
  assert.deepEqual(ids({ cerca: '#ecografia' }), [1]);
  assert.equal(tipoDi(docs[0]), 'pdf');
});
test('A + B + D: File tabs, categories with deadlines, document sheet with 10 actions, 5-item bottom bar', () => {
  const doc = readFileSync('personal/src/scan/Documenti.jsx', 'utf8');
  for (const t of ['Recenti', 'Cartelle', 'Preferiti', 'Archivio', 'PDF in Word', 'Vista a griglia', 'Telefono']) assert.ok(doc.includes(t), t);
  assert.match(doc, /CardCategorie/); assert.match(doc, /avvisoScadenza/);
  const scheda = readFileSync('personal/src/scan/Scheda.jsx', 'utf8');
  for (const t of ['Condividi', 'Firma', 'Modifica', 'Pagine', 'Testo', 'Word', 'Traduci', 'Comprimi', 'Sposta', 'Archivia', '+ etichetta', '+ scadenza']) assert.ok(scheda.includes(`'${t}'`) || scheda.includes(t), t);
  const scan = readFileSync('personal/src/scan/Scan.jsx', 'utf8');
  for (const t of ['>Home<', '>File<', '>Strumenti<', '>Impostazioni<']) assert.ok(scan.includes(t), t);
  assert.match(scan, /scheda: \{/); assert.match(scan, /categoriaDa/);
});
