// SFONDI (PO 2026-11-27): sfondi delle Home del telefono, scelta salvata sul dispositivo, separata per Studio e Personale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SFONDI, COLORI, PREDEFINITO, leggiSfondo, salvaSfondo, sfondo, chiaveSfondo } from '../shared/spazio/sfondi.js';

const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('the current wallpapers are kept and are the defaults', () => {
  assert.equal(PREDEFINITO.studio, 'petrolio');
  assert.equal(PREDEFINITO.personale, 'blu');
  assert.ok(SFONDI.find((s) => s.id === 'petrolio') && SFONDI.find((s) => s.id === 'blu'));
  assert.ok(SFONDI.length >= 6 && COLORI.length >= 6, 'alcuni sfondi e alcuni colori');
});

test('choice is saved per space and unknown ids fall back to the default', () => {
  const st = memoria();
  assert.equal(leggiSfondo('studio', st), 'petrolio');
  assert.equal(salvaSfondo('studio', 'aurora', st), 'aurora');
  assert.equal(leggiSfondo('studio', st), 'aurora');
  assert.equal(leggiSfondo('personale', st), 'blu', 'Personale non cambia');
  assert.equal(salvaSfondo('studio', 'inventato', st), 'aurora', 'id sconosciuto ignorato');
  st.setItem(chiaveSfondo('personale'), '<script>');
  assert.equal(leggiSfondo('personale', st), 'blu');
  assert.equal(leggiSfondo('studio', { getItem() { throw new Error('bloccato'); } }), 'petrolio', 'storage bloccato');
});

test('every wallpaper is dark (white text readable) and is static CSS only', () => {
  const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const s of [...SFONDI, ...COLORI]) {
    assert.ok((1.05) / (lum(s.base) + 0.05) >= 7, `${s.id}: testo bianco leggibile`);
    assert.doesNotMatch(s.css, /https?:|javascript:|<script|expression\(/i, `${s.id}: niente risorse esterne`);
  }
  assert.equal(sfondo('nessuno', 'personale').id, 'blu');
});
