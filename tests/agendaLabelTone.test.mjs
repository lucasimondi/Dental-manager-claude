import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LABEL_PALETTE, LABEL_HEXES, labelColor, labelOn } from '../shared/agenda/labelPalette.js';
import { COLORI_DISPONIBILI } from '../src/lib/utils.js';

const lum = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// PO 2026-11-04: restyling agenda Studio e Personal, palette curata e griglia leggera.
test('label palette: 15 distinct colors, readable text on every filled block', () => {
  assert.equal(LABEL_PALETTE.length, 15);
  assert.equal(new Set(LABEL_HEXES).size, 15);
  for (const p of LABEL_PALETTE) assert.ok(contrast(p.hex, labelOn(p.hex)) >= 4.5, `${p.nome} contrast`);
  assert.deepEqual(COLORI_DISPONIBILI, [...LABEL_HEXES], 'Studio offers the same palette');
});

test('saved colors are only displayed through the palette, never rewritten', () => {
  for (const h of LABEL_HEXES) assert.equal(labelColor(h), h);
  assert.equal(labelColor(null), '#5D6979');
  assert.equal(labelColor('red;x'), '#5D6979');
  assert.equal(labelColor('', ''), '');
  // The 15 colors Studio offered before stay distinct, except the two near-identical teals.
  const old = ['#1A6B8A', '#2EC4B6', '#2D9E61', '#7C3AED', '#E63946', '#F4A261', '#EC4899', '#DC2626', '#0EA5E9', '#84CC16', '#F59E0B', '#6366F1', '#14B8A6', '#A855F7', '#64748B'];
  assert.equal(new Set(old.map(c => labelColor(c))).size, 14);
  // Personal default labels keep distinct colors.
  assert.equal(new Set(['#64748b', '#db2777', '#059669', '#0284c7', '#f59e0b'].map(c => labelColor(c))).size, 5);
  // Any custom color maps by hue.
  assert.equal(labelColor('#ff0000'), '#D1453B');
  assert.equal(labelColor('#999999'), '#5D6979');
});

test('shared blocks: tonal events without dashed borders, filled appointments, light grid', () => {
  const shared = readFileSync('shared/agenda/AgendaPresentation.jsx', 'utf8');
  const css = readFileSync('shared/agenda/agenda.css', 'utf8');
  assert.match(shared, /export function eventTone\(co\)/);
  assert.match(shared, /const c = labelColor\(co\)/);
  assert.doesNotMatch(shared, /dashed/, 'no dashed event borders');
  assert.doesNotMatch(shared, /1\.5px solid \$\{C\.brd\}/, 'no heavy grid borders');
  assert.match(shared, /background: fill, borderRadius: 6/);
  assert.match(shared, /agenda-now-line/);
  assert.match(css, /var\(--event-color\) 18%, var\(--agenda-tint-anchor, #fff\)\)/);
  assert.doesNotMatch(shared, /co \+ '35'|\$\{co\}AA/, 'no washed-out alpha tints');
});
