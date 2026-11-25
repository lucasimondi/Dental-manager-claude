// PERSONAL-FINESTRE (PO 2026-11-24): più finestre come su Windows — aprire, portare avanti, ridurre a
// icona, ingrandire/ripristinare, chiudere, spostare, «Mostra desktop»; sul telefono a scelta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apriFinestra, attiva, inPrimoPiano, riduci, chiudi, ingrandisciRipristina, mostraDesktop, sposta, toccaIcona, sostituisciIn, riadatta, limitaRiquadro, cascata, telefono, MIN_W, BARRA_TITOLO } from '../personal/src/lib/finestre.js';

const PC = { w: 1280, h: 740 }, TEL = { w: 390, h: 760 };
const tre = (area = PC) => [1, 2, 3].reduce((l, k) => apriFinestra(l, { chiave: k, tipo: k === 1 ? 'esplora' : 'scan' }, area), []);

test('finestre: sul telefono si aprono ingrandite, sul computer libere a cascata, sempre in primo piano', () => {
  assert.ok(telefono(TEL) && !telefono(PC));
  assert.equal(apriFinestra([], { chiave: 1 }, TEL)[0].stato, 'ingrandita');
  assert.equal(apriFinestra([], { chiave: 1 }, TEL, 'normale')[0].stato, 'normale', 'la scelta per quel tipo vale anche sul telefono');
  const l = tre();
  assert.deepEqual(l.map((f) => f.stato), ['normale', 'normale', 'normale']);
  assert.equal(attiva(l).chiave, 3);
  assert.equal(l[1].x - l[0].x, 28); assert.equal(l[1].y - l[0].y, 28);
  for (const f of l) assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= PC.w && f.y + f.h <= PC.h);
  const c = cascata([], TEL); assert.ok(c.w <= TEL.w && c.w >= MIN_W);
});

test('finestre: primo piano, riduci a icona, tocco sull\'icona, chiudi', () => {
  let l = tre();
  l = inPrimoPiano(l, 1); assert.equal(attiva(l).chiave, 1);
  l = riduci(l, 1); assert.equal(l.find((f) => f.chiave === 1).stato, 'ridotta'); assert.equal(attiva(l).chiave, 3, 'viene avanti la successiva');
  l = toccaIcona(l, 1); assert.equal(attiva(l).chiave, 1); assert.equal(l.find((f) => f.chiave === 1).stato, 'normale', 'torna come era');
  l = toccaIcona(l, 1); assert.equal(l.find((f) => f.chiave === 1).stato, 'ridotta', 'secondo tocco sulla finestra attiva = riduci');
  l = chiudi(l, 3); assert.deepEqual(l.map((f) => f.chiave), [1, 2]);
  assert.equal(attiva(riduci(riduci(l, 1), 2)), null);
});

test('finestre: ingrandisci/ripristina, ridotta da ingrandita torna ingrandita', () => {
  let l = tre();
  l = ingrandisciRipristina(l, 2); assert.equal(l[1].stato, 'ingrandita');
  l = riduci(l, 2); l = inPrimoPiano(l, 2); assert.equal(l[1].stato, 'ingrandita');
  l = ingrandisciRipristina(l, 2); assert.equal(l[1].stato, 'normale');
});

test('finestre: «Mostra desktop» riduce tutto e, ripetuto, rimette com\'era', () => {
  let l = ingrandisciRipristina(tre(), 3); l = riduci(l, 1);
  const d = mostraDesktop(l);
  assert.ok(d.every((f) => f.stato === 'ridotta'));
  const r = mostraDesktop(d);
  assert.deepEqual(r.map((f) => f.stato), ['ridotta', 'normale', 'ingrandita'], 'quella già ridotta resta ridotta');
});

test('finestre: spostare e ridimensionare restano dentro (la barra del titolo raggiungibile)', () => {
  let l = tre();
  l = sposta(l, 1, { x: 5000, y: -300 }, PC);
  assert.equal(l[0].x, PC.w - 80); assert.equal(l[0].y, 0);
  l = sposta(l, 1, { y: 5000 }, PC); assert.equal(l[0].y, PC.h - BARRA_TITOLO);
  l = sposta(l, 1, { w: 10, h: 10 }, PC); assert.equal(l[0].w, MIN_W); assert.equal(l[0].h, 220);
  assert.deepEqual(limitaRiquadro({ x: 0, y: 0, w: 5000, h: 5000 }, TEL), { x: 0, y: 0, w: TEL.w, h: TEL.h });
  const ruotato = riadatta(l, { w: 400, h: 300 }); assert.ok(ruotato.every((f) => f.w <= 400 && f.h <= 300));
});

test('finestre: sostituire il contenuto tiene la stessa finestra (posto e icona)', () => {
  const l = sostituisciIn(tre(), 2, { tipo: 'carica', chiave: 99 });
  assert.equal(l[1].chiave, 2); assert.equal(l[1].tipo, 'carica'); assert.equal(l[1].nuova, 99); assert.equal(l[1].x, tre()[1].x);
});

test('desktop: App usa le finestre, barra con le finestre aperte e «Mostra desktop», Indietro riduce', () => {
  const app = readFileSync('personal/src/App.jsx', 'utf8'), desk = readFileSync('personal/src/Desktop.jsx', 'utf8');
  const barra = readFileSync('personal/src/Barra.jsx', 'utf8'), fin = readFileSync('personal/src/Finestra.jsx', 'utf8');
  assert.match(app, /<Desktop finestre=\{fs\}/); assert.doesNotMatch(app, /<Pagina /);
  assert.match(barra, /aria-label="Finestre aperte"/); assert.match(barra, /aria-label="Mostra desktop"/);
  assert.match(barra, /if \(f && onFinestra\)/, 'l\'app già aperta viene avanti invece di aprirne un\'altra');
  for (const n of ['Riduci a icona', 'Ingrandisci', 'Ripristina', 'Chiudi']) assert.match(fin, new RegExp(n));
  assert.match(fin, /data-bersaglio=\{accetta \? `finestra:\$\{f\.chiave\}`/);
  assert.match(desk, /useIndietro\(visibili\.length > 0 \|\| vista,/); assert.match(desk, /const n = riduci\(st, a\.chiave\)/, 'Indietro riduce la finestra in primo piano (o chiude la Visualizzazione attività)');
  assert.match(desk, /ACCETTANO_FILE = new Set\(\['scansione', 'pdf', 'pdfStrumento', 'carica', 'scanner'\]\)/);
});

test('desktop: lo scanner come finestra (non l\'app Scan intera), Esplora sceglie per un\'altra finestra, trascinare tra finestre', () => {
  const doc = readFileSync('personal/src/sezioni/documenti/index.jsx', 'utf8'), esp = readFileSync('personal/src/sezioni/documenti/Esplora.jsx', 'utf8');
  const scan = readFileSync('personal/src/scan/Scan.jsx', 'utf8'), port = readFileSync('personal/src/lib/portale.js', 'utf8'), bar = readFileSync('personal/src/lib/barra.js', 'utf8');
  assert.doesNotMatch(doc, /ScanNelDesktop/, 'l\'app Scan non si incorpora nel desktop');
  // dopo PR #348: Start → Scan apre la pagina `scan` (sezioni/scan), che nel desktop è una finestra
  assert.match(bar, /\{ id: 'scan', nome: 'Scan', azione: \{ apri: \{ tipo: 'scan' \} \} \}/);
  assert.doesNotMatch(scan, /esterno|incorporato|finestra=scan/);
  assert.match(esp, /if \(b\?\.tipo === 'finestra' \|\| b\?\.tipo === 'desktop'\) return documentiDa\(sorgentiPer\(s\.chiave\)\)\.length > 0/);
  assert.match(esp, /d\.fascicolo !== CLINICO/);
  assert.match(esp, /className="esp-scegli-ok"/);
  assert.match(port, /e\.detail\?\.finestra === String\(fin\.chiave\)/);
});
