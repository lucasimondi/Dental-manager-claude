// ICONE-START (PO 2026-11-26): icone a colori stile Esplora per ogni app; Start con «Tutte le app» a gruppi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DISEGNI_COLORE, idIconaColore, svgIconaColore } from '../personal/src/lib/iconeColore.js';
import { AGGIUNTE, CARTELLE_START, DOCK_PREDEFINITO, gruppiStart, vociBarra } from '../personal/src/lib/barra.js';

test('ogni app di Start e del dock ha la sua icona a colori', () => {
  for (const a of AGGIUNTE) assert.ok(idIconaColore(a.id), `manca l'icona di ${a.id}`);
  for (const v of vociBarra(DOCK_PREDEFINITO).filter((x) => x.id !== 'start' && x.id !== 'cerca')) assert.ok(idIconaColore(v.id), `manca l'icona di ${v.id}`);
  assert.equal(idIconaColore('poliedron'), 'assistente');
  assert.equal(idIconaColore('altro'), 'personale');
  assert.equal(idIconaColore('nessuna'), null);
});

test('i disegni sono SVG statici (niente script, eventi, link o immagini esterne)', () => {
  for (const [id, d] of Object.entries(DISEGNI_COLORE)) {
    assert.doesNotMatch(d, /<script|<foreignObject|<image|\son\w+=|href|url\(/i, id);
    assert.match(svgIconaColore(id), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 48 48"/);
  }
});

test('«Tutte le app»: ogni app una volta sola, gruppi nell’ordine del telefono, Google e Office con le loro app', () => {
  const g = gruppiStart({ urgenti: 3 });
  assert.deepEqual(g.map((x) => x.id), ['app', 'cose', 'lavoro', 'google', 'office', 'sistema']);
  const ids = g.filter((x) => x.id !== 'google' && x.id !== 'office').flatMap((x) => x.voci.map((v) => v.id));
  assert.equal(new Set(ids).size, ids.length, 'nessun doppione');
  for (const a of AGGIUNTE) {
    if (['google', 'office', 'pratiche'].includes(a.id)) assert.ok(!ids.includes(a.id), a.id);
    else assert.ok(ids.includes(a.id), `${a.id} manca in Tutte le app`);
  }
  assert.ok(ids.includes('poliedron') && ids.includes('altro'), 'anche Assistente e Personale');
  assert.deepEqual(g.find((x) => x.id === 'cose').voci.map((v) => v.id), ['dati', 'personali', 'conti', 'auto', 'casa', 'salute', 'rubrica'].filter((id) => AGGIUNTE.some((a) => a.id === id)).sort((a, b) => AGGIUNTE.findIndex((x) => x.id === a) - AGGIUNTE.findIndex((x) => x.id === b)));
  assert.deepEqual(g.find((x) => x.id === 'sistema').voci.map((v) => v.id), ['impostazioni']);
  assert.equal(g.find((x) => x.id === 'google').voci.length, CARTELLE_START.google.voci.length);
  assert.ok(g.find((x) => x.id === 'office').voci.every((v) => v.inCartella));
  assert.equal(g[0].voci.find((v) => v.id === 'oggi').n, 3, 'pallino di Oggi');
});

test('un’app nuova senza gruppo entra da sola in «Le tue app»', () => {
  AGGIUNTE.push({ id: 'prova-nuova', nome: 'Prova', azione: { vai: 'prova' } });
  try { assert.ok(gruppiStart()[0].voci.some((v) => v.id === 'prova-nuova')); } finally { AGGIUNTE.pop(); }
});
