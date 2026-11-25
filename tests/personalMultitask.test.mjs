// PERSONAL-MULTITASK (PO 2026-11-25): Snap ai bordi, schemi di affiancamento, divisore comune,
// scrivanie virtuali — come Windows 11, anche sul telefono.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apriFinestra } from '../personal/src/lib/finestre.js';
import { rettangoloZona, zonaDaPunto, zoneLibere, schemi, aggancia, stacca, coppiaAgganciata, spostaDivisore, riadattaAgganciate, SCRIVANIE_INIZIALI, nuovaScrivania, rinominaScrivania, vaiAScrivania, chiudiScrivania, spostaInScrivania, nellaScrivania } from '../personal/src/lib/multitasking.js';

const PC = { w: 1200, h: 720 }, TEL = { w: 390, h: 780 };
const due = (area) => [1, 2].reduce((l, k) => apriFinestra(l, { chiave: k, tipo: 'esplora', scrivania: 1 }, area, 'normale'), []);

test('snap: zone dai bordi (computer: metà e quarti, in alto ingrandita; telefono: sopra/sotto)', () => {
  assert.equal(zonaDaPunto(2, 300, PC), 'sinistra'); assert.equal(zonaDaPunto(1199, 300, PC), 'destra');
  assert.equal(zonaDaPunto(3, 20, PC), 'alto-sx'); assert.equal(zonaDaPunto(1198, 700, PC), 'basso-dx');
  assert.equal(zonaDaPunto(600, 4, PC), 'massimo'); assert.equal(zonaDaPunto(600, 300, PC), null);
  assert.equal(zonaDaPunto(200, 4, TEL), 'massimo'); assert.equal(zonaDaPunto(200, 80, TEL), 'sopra'); assert.equal(zonaDaPunto(200, 760, TEL), 'sotto'); assert.equal(zonaDaPunto(200, 400, TEL), null);
  assert.deepEqual(rettangoloZona('destra', PC), { x: 600, y: 0, w: 600, h: 720 });
  assert.deepEqual(rettangoloZona('sotto', TEL), { x: 0, y: 390, w: 390, h: 390 });
  assert.deepEqual(rettangoloZona('due-terzi-sx', PC), { x: 0, y: 0, w: 800, h: 720 });
  assert.equal(schemi(TEL).length, 2); assert.deepEqual(schemi(PC)[0], ['sinistra', 'destra']);
});

test('snap: aggancia ricorda la misura libera; staccando torna della sua misura sotto il dito', () => {
  let l = due(PC); const prima = { x: l[0].x, y: l[0].y, w: l[0].w, h: l[0].h };
  l = aggancia(l, 1, 'sinistra', PC);
  assert.equal(l[0].aggancio, 'sinistra'); assert.deepEqual({ x: l[0].x, w: l[0].w, h: l[0].h }, { x: 0, w: 600, h: 720 }); assert.deepEqual(l[0].libera, prima);
  l = aggancia(l, 1, 'massimo', PC); assert.equal(l[0].stato, 'ingrandita'); assert.equal(l[0].aggancio, null); assert.deepEqual(l[0].libera, prima);
  l = stacca(l, 1, { x: 500, y: 20 }, PC);
  assert.equal(l[0].stato, 'normale'); assert.equal(l[0].w, prima.w); assert.equal(Math.round(l[0].x + l[0].w / 2), 500, 'centrata sotto il dito');
});

test('snap assist e divisore: zone libere, coppia affiancata, confine comune', () => {
  let l = aggancia(due(PC), 1, 'sinistra', PC);
  assert.deepEqual(zoneLibere('sinistra', l, 1), ['destra']);
  l = aggancia(l, 2, 'destra', PC);
  assert.deepEqual(zoneLibere('sinistra', l, 1), []);
  const c = coppiaAgganciata(l, 1); assert.equal(c.asse, 'x'); assert.equal(c.a.chiave, 1);
  l = spostaDivisore(l, c, 0.7, PC);
  assert.equal(l[0].w, 840); assert.equal(l[1].x, 840); assert.equal(l[1].w, 360);
  assert.equal(spostaDivisore(l, c, 0.99, PC)[0].w, 960, 'mai oltre l\'80%');
  const r = riadattaAgganciate(l, { w: 1000, h: 600 }); assert.equal(r[0].w, 700); assert.equal(r[1].h, 600);
  let t = aggancia(aggancia(due(TEL), 1, 'sopra', TEL), 2, 'sotto', TEL);
  assert.equal(coppiaAgganciata(t, 1).asse, 'y', 'telefono: una sopra l\'altra');
  assert.equal(coppiaAgganciata(t, 2), null, 'solo nella scrivania attiva');
});

test('scrivanie: nuova, rinomina, vai, sposta una finestra, chiudi (le finestre passano accanto)', () => {
  let s = nuovaScrivania(SCRIVANIE_INIZIALI);
  assert.deepEqual(s.elenco.map((d) => d.nome), ['Desktop 1', 'Desktop 2']); assert.equal(s.attiva, 2); assert.notEqual(s.elenco[0].sfondo, s.elenco[1].sfondo);
  s = rinominaScrivania(s, 2, '  Studio  '); assert.equal(s.elenco[1].nome, 'Studio');
  assert.equal(rinominaScrivania(s, 2, '   ').elenco[1].nome, 'Studio', 'nome vuoto: resta quello di prima');
  s = vaiAScrivania(s, 1); assert.equal(s.attiva, 1); assert.equal(vaiAScrivania(s, 9).attiva, 1);
  let l = spostaInScrivania(aggancia(due(PC), 2, 'destra', PC), 2, 2);
  assert.deepEqual(nellaScrivania(l, 1).map((f) => f.chiave), [1]); assert.deepEqual(nellaScrivania(l, 2).map((f) => f.chiave), [2]); assert.equal(l[1].aggancio, null);
  const r = chiudiScrivania({ ...s, attiva: 2 }, l, 2);
  assert.deepEqual(r.scrivanie.elenco.map((d) => d.id), [1]); assert.equal(r.scrivanie.attiva, 1); assert.deepEqual(nellaScrivania(r.finestre, 1).map((f) => f.chiave), [1, 2]);
  assert.equal(chiudiScrivania(SCRIVANIE_INIZIALI, l, 1).scrivanie, SCRIVANIE_INIZIALI, 'l\'ultima scrivania non si chiude');
});

test('interfaccia: otto maniglie, staccare trascinando, schemi dal tasto Ingrandisci, Visualizzazione attività nella barra', () => {
  const fin = readFileSync('personal/src/Finestra.jsx', 'utf8'), desk = readFileSync('personal/src/Desktop.jsx', 'utf8'), barra = readFileSync('personal/src/Barra.jsx', 'utf8'), vista = readFileSync('personal/src/VistaAttivita.jsx', 'utf8');
  assert.match(fin, /const MANIGLIE = \['n', 's', 'e', 'o', 'ne', 'no', 'se', 'so'\]/);
  assert.match(fin, /staccare: modo === 'sposta' && \(!libera \|\| !!f\.aggancio\)/);
  assert.match(fin, /setTimeout\(\(\) => \{ timerSchemi\.current = 'aperto'; apriSchemi\(el\); \}, 450\)/);
  assert.match(desk, /aria-label="Schemi di affiancamento"/); assert.match(desk, /aria-label="Scegli la finestra da affiancare"/); assert.match(desk, /role="separator"/);
  assert.match(barra, /Visualizzazione attività/); assert.match(barra, /\{v\.id === 'cerca' && bottoneVista/);
  assert.match(vista, /aria-label="Nuovo desktop"/); assert.match(vista, /data-scrivania=\{d\.id\}/); assert.match(vista, /azioni\.inScrivania\(g\.k, id\)/);
});
