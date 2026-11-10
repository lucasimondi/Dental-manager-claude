// SCAN-HOME (PO 2026-11-10): app «Scan» installabile sulla Home (scanner + PDF e firma).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { eScan, indirizzoScan, indirizzoPersonal, strumentoDaIndirizzo, identitaScan } from '../personal/src/lib/scan.js';

test('Scan: riconosce i suoi indirizzi', () => {
  for (const p of ['/poliedron/scan', '/poliedron/scan/', '/scan/', '/scan']) assert.equal(eScan(p), true, p);
  for (const p of ['/poliedron/personal/', '/personal/', '/scanner', '/poliedron/', '/']) assert.equal(eScan(p), false, p);
  assert.equal(indirizzoScan({ hostname: 'personal.poliedrasoft.it' }), '/scan/');
  assert.equal(indirizzoScan({ hostname: 'example.vercel.app' }), '/poliedron/scan/');
  assert.equal(indirizzoPersonal('conti', { hostname: 'x' }), '/poliedron/personal/?sezione=conti');
  assert.equal(indirizzoPersonal(null, { hostname: 'personal.poliedrasoft.it' }), '/personal/');
});

test('Scan: ?strumento=pdf si legge una volta e si toglie', () => {
  const win = { location: { href: 'https://x.test/poliedron/scan/?strumento=pdf' }, history: { replaceState: (_, __, u) => { win.location.href = String(u); } } };
  assert.equal(strumentoDaIndirizzo(win), 'pdf');
  assert.equal(win.location.href, 'https://x.test/poliedron/scan/');
  assert.equal(strumentoDaIndirizzo(win), null);
});

test('Scan: nome, icona e manifest propri', () => {
  const el = {}; const doc = { title: '', querySelector: (s) => (el[s] ||= { setAttribute(a, v) { this[a] = v; } }) };
  identitaScan(doc, { hostname: 'example.vercel.app' });
  assert.equal(el['link[rel="manifest"]'].href, '/scan.webmanifest');
  assert.equal(el['meta[name="apple-mobile-web-app-title"]'].content, 'Scan');
  assert.equal(doc.title, 'Poliedron Scan');
  identitaScan(doc, { hostname: 'personal.poliedrasoft.it' });
  assert.equal(el['link[rel="manifest"]'].href, '/scan-dominio.webmanifest');
});

test('Scan: manifest installabili, icone e indirizzi serviti', () => {
  for (const [file, base] of [['public/scan.webmanifest', '/poliedron/scan/'], ['public/scan-dominio.webmanifest', '/scan/']]) {
    const m = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(m.short_name, 'Scan'); assert.equal(m.id, base); assert.equal(m.start_url, base); assert.equal(m.scope, base);
    assert.equal(m.display, 'standalone');
    for (const i of m.icons) assert.ok(existsSync(`public${i.src}`), i.src);
    assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
    assert.ok(m.shortcuts.some((s) => s.url === `${base}?strumento=pdf`));
  }
  const rewrites = JSON.parse(readFileSync('vercel.json', 'utf8')).rewrites;
  for (const s of ['/poliedron/scan', '/poliedron/scan/', '/scan', '/scan/']) assert.equal(rewrites.find((r) => r.source === s)?.destination, '/personal/index.html', s);
  // Le regole di Scan vengono prima di quella generale che manda tutto allo Studio.
  assert.ok(rewrites.findIndex((r) => r.source === '/scan/') < rewrites.findIndex((r) => r.source === '/(.*)'));
});

test('Scan: scorciatoie di Personal e app senza dock', () => {
  for (const [file, base] of [['public/personal.webmanifest', '/poliedron/personal/'], ['public/personal-dominio.webmanifest', '/personal/']]) {
    const urls = JSON.parse(readFileSync(file, 'utf8')).shortcuts.map((s) => s.url);
    assert.deepEqual(urls, [`${base}?aggiungi=documento`, `${base}?aggiungi=pdf`]);
  }
  const app = readFileSync('personal/src/App.jsx', 'utf8');
  assert.match(app, /eScan\(\) \? <Scan/);
  const scan = readFileSync('personal/src/scan/Scan.jsx', 'utf8');
  assert.match(scan, /PaginaScansione/); assert.match(scan, /tipo: 'pdf'/);
  assert.doesNotMatch(scan, /pp-schede|pp-fab/);
  assert.match(readFileSync('personal/index.html', 'utf8'), /scan\(/);
});
