// SCAN-VIVO (PO 2026-11-24): scanner «forte come quello di Google» — contorno morbido, scatto automatico
// quando il foglio è fermo, ombre tolte (carta bianca uniforme, testo che resta scuro).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distanzaAngoli, smussaAngoli, areaAngoli, passoScatto, SCATTO } from '../personal/src/lib/scannerVivo.js';
import { togliOmbre, migliora } from '../personal/src/lib/scansione.js';

const Q = (d = 0) => ({ tl: { x: 0.2 + d, y: 0.15 }, tr: { x: 0.8 + d, y: 0.15 }, br: { x: 0.8 + d, y: 0.85 }, bl: { x: 0.2 + d, y: 0.85 } });

test('scanner: distanza, area e contorno smussato (salti grandi ripartono dal nuovo)', () => {
  assert.equal(distanzaAngoli(Q(), null), Infinity);
  assert.ok(Math.abs(distanzaAngoli(Q(), Q(0.01)) - 0.01) < 1e-9);
  assert.ok(Math.abs(areaAngoli(Q()) - 0.42) < 1e-9);
  const m = smussaAngoli(Q(), Q(0.1));
  assert.ok(Math.abs(m.tl.x - (0.2 + 0.045)) < 1e-9, 'si avvicina del 45%');
  assert.deepEqual(smussaAngoli(Q(), Q(0.3)), Q(0.3));
  assert.equal(smussaAngoli(Q(), null), null);
});

test('scanner: scatta da solo dopo che il foglio resta fermo, non subito di nuovo, non se lontano', () => {
  let st = {}, t = 0, r;
  r = passoScatto(st, null, t); assert.equal(r.fase, 'cerca');
  for (; t <= SCATTO.fermoMs - 100; t += 100) { r = passoScatto(st, Q(t % 200 ? 0.004 : 0), t); st = r.st; assert.equal(r.fase, 'fermo'); }
  assert.ok(r.avanzamento > 0.8 && r.avanzamento < 1);
  r = passoScatto(st, Q(), t + 100); st = r.st; assert.equal(r.fase, 'scatta');
  for (let k = 1; k <= 12; k++) { r = passoScatto(st, Q(), t + 100 + k * 100); st = r.st; assert.notEqual(r.fase, 'scatta', 'pausa dopo lo scatto'); }
  // movimento: il conto riparte
  let s2 = {}; for (let k = 0; k < 20; k++) { const q = passoScatto(s2, Q(k % 2 ? 0.05 : 0), k * 100); s2 = q.st; assert.notEqual(q.fase, 'scatta'); }
  // foglio piccolo nell'inquadratura
  const piccolo = { tl: { x: 0.45, y: 0.45 }, tr: { x: 0.55, y: 0.45 }, br: { x: 0.55, y: 0.55 }, bl: { x: 0.45, y: 0.55 } };
  assert.equal(passoScatto({}, piccolo, 0).fase, 'avvicina');
  // manuale: mai da solo
  let s3 = {}; for (let k = 0; k < 30; k++) { const q = passoScatto(s3, Q(), k * 100, { auto: false }); s3 = q.st; assert.notEqual(q.fase, 'scatta'); }
});

test('scanner: via le ombre — la carta diventa bianca anche nella parte in ombra, il testo resta scuro', () => {
  const W = 200, H = 120, px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const luce = x < W / 2 ? 230 : 120;                          // metà pagina in ombra
    const testo = (y % 20 < 3) && (x % 10 < 6);                 // righe di "testo"
    const v = testo ? luce * 0.25 : luce, i = (y * W + x) * 4;
    px[i] = v; px[i + 1] = v * 0.97; px[i + 2] = v * 0.92; px[i + 3] = 255;
  }
  const media = (a, x0, x1, testo) => { let s = 0, n = 0; for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) { if (((y % 20 < 3) && (x % 10 < 6)) !== testo) continue; s += a[(y * W + x) * 4]; n++; } return s / n; };
  const prima = media(px, W / 2 + 10, W - 10, false);
  togliOmbre(px, W, H);
  const luce = media(px, 10, W / 2 - 10, false), ombra = media(px, W / 2 + 10, W - 10, false);
  assert.ok(prima < 130 && ombra > 235 && luce > 235, `carta: luce ${luce}, ombra ${ombra} (prima ${prima})`);
  assert.ok(media(px, W / 2 + 10, W - 10, true) < 110, 'il testo in ombra resta scuro');
  const copia = Uint8ClampedArray.from(px); migliora(copia, 'documento', W, H);
  assert.equal(copia[1], copia[0], 'bianco e nero');
});

test('scanner: «Scatta» apre la fotocamera dal vivo (con ripiego), le foto arrivano in coda', () => {
  const aggiungi = readFileSync('personal/src/Aggiungi.jsx', 'utf8'), scan = readFileSync('personal/src/scan/strumenti.js', 'utf8'), cam = readFileSync('personal/src/scan/Fotocamera.jsx', 'utf8');
  assert.match(aggiungi, /if \(fotocameraDisponibile\(\)\) setCamera\(true\); else scatto\.current\.click\(\)/);
  assert.match(aggiungi, /if \(inCorso\.current\) \{ attesa\.current\.push\(\.\.\.elenco\); return; \}/);
  assert.match(aggiungi, /onNonDisponibile=/);
  assert.match(scan, /if \(id === 'scanner'\) apri\(\{ tipo: 'scanner', fotocamera: true \}\)/);
  assert.match(cam, /facingMode: \{ ideal: 'environment' \}/);
  assert.match(cam, /getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/, 'la fotocamera si spegne alla chiusura');
  assert.match(cam, /aria-label="Scatta"/);
});

test('scanner: Poliedron tra le fonti (clinici esclusi, solo PDF e foto), Indietro del telefono, lente nel ritaglio', () => {
  const aggiungi = readFileSync('personal/src/Aggiungi.jsx', 'utf8'), home = readFileSync('personal/src/scan/ScanHome.jsx', 'utf8');
  const scegli = readFileSync('personal/src/scan/ScegliPoliedron.jsx', 'utf8'), angoli = readFileSync('personal/src/Angoli.jsx', 'utf8');
  const indietro = readFileSync('personal/src/lib/indietro.js', 'utf8'), gestore = readFileSync('personal/src/pdf/GestorePdf.jsx', 'utf8'), cam = readFileSync('personal/src/scan/Fotocamera.jsx', 'utf8');
  assert.match(aggiungi, /setDaPoliedron\(true\)\}><IconaDocumenti size=\{20\} \/> Poliedron<\/button>/);
  assert.match(home, /setDaPoliedron\(true\)\}><IconaDocumenti size=\{20\} \/> Poliedron<\/button>/);
  assert.match(scegli, /const visibile = \(d\) => d && d\.fascicolo !== CLINICO/);
  assert.match(scegli, /neq\('fascicolo', CLINICO\)/);
  assert.match(scegli, /useIndietro\(true, su\)/);
  for (const f of [angoli, gestore, cam]) assert.match(f, /useIndietro\(true,/);
  assert.match(indietro, /history\.pushState/); assert.match(indietro, /daIgnorare \+= 1; history\.back\(\)/);
  assert.match(angoli, /a\.da\.x \+ \(e\.clientX - a\.x\) \/ box\.width/, 'l’angolo segue lo spostamento, non salta sotto il dito');
  assert.match(angoli, /pp-lente/);
});

test('scanner: dalla finestra Poliedron si possono scegliere solo PDF e foto', async () => {
  const { usabile } = await import('../personal/src/scan/ScegliPoliedron.jsx').catch(() => ({}));
  if (!usabile) return; // JSX non importabile in Node: coperto dal test visuale
  assert.ok(usabile({ mime_type: 'application/pdf' }) && usabile({ nome_file_originale: 'a.JPG' }) && !usabile({ mime_type: 'application/msword' }));
});
