// PO 2026-10-17: "aggiungiamo funzione di ingrandimenti con le dita, il pinch to zoom".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PINCH_MIN, PINCH_MAX, distanza, fattorePinch, scrollAncorato } from '../personal/src/lib/pinchZoom.js';

test('pinch: the factor follows the fingers and stays between 1 and 4', () => {
  assert.equal(distanza({ clientX: 0, clientY: 0 }, { clientX: 30, clientY: 40 }), 50);
  assert.equal(fattorePinch(1, 100, 200), 2);
  assert.equal(fattorePinch(2, 100, 150), 3);
  assert.equal(fattorePinch(2, 200, 100), 1);
  assert.equal(fattorePinch(1, 100, 50), PINCH_MIN, 'never smaller than the original grid');
  assert.equal(fattorePinch(3, 100, 1000), PINCH_MAX);
  assert.equal(fattorePinch(1.5, 0, 100), 1.5, 'no distance yet → unchanged');
});

test('pinch: the time under the fingers stays where it is', () => {
  // 9:00 (slot 18 di 30 min, 24 px) sotto le dita a 100 px dal bordo, griglia a 40 px dall'inizio.
  const oldSlotH = 24, newSlotH = 48, gridTop = 40, y = 100;
  const scrollTop = gridTop + 18 * oldSlotH - y;
  const nuovo = scrollAncorato({ scrollTop, y, gridTop, oldSlotH, newSlotH });
  assert.equal((nuovo + y - gridTop) / newSlotH, 18);
  assert.equal(scrollAncorato({ scrollTop: 0, y: 10, gridTop: 0, oldSlotH: 24, newSlotH: 24 }), 0);
  assert.equal(scrollAncorato({ scrollTop: 0, y: 300, gridTop: 0, oldSlotH: 48, newSlotH: 24 }), 0, 'never above the top');
});

test('pinch: two fingers zoom the grid, one finger still swipes', () => {
  const src = readFileSync(new URL('../shared/agenda/pinchZoom.js', import.meta.url), 'utf8');
  assert.match(src, /addEventListener\('touchmove', move, \{ passive: false \}\)/);
  assert.match(src, /e\.touches\.length !== 2/);
  assert.match(src, /gesturestart/);
  assert.match(src, /try \{ localStorage\.setItem/);
  const swipe = readFileSync(new URL('../shared/agenda/swipeAgenda.js', import.meta.url), 'utf8');
  assert.match(swipe, /if \(g\.current\?\.dx\) sposta\(colonne\(\), 0, 180\);/);
});
