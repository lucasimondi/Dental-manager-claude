import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nomePratica, arricchisci, filtraPratiche, contaFiltri } from '../personal/src/lib/praticheCartelle.js';

test('il nome è sempre «Pratica …», senza ripeterlo', () => {
  assert.equal(nomePratica({ titolo: 'Mondino – esecuzione 36/2023' }), 'Pratica Mondino – esecuzione 36/2023');
  assert.equal(nomePratica({ titolo: 'pratica UnoEnergy' }), 'pratica UnoEnergy');
  assert.equal(nomePratica({}), 'Pratica senza nome');
});

test('cartelle: fino a 4 anteprime, passi aperti, prossima data, urgente; ordine per nome; filtri', () => {
  const pratiche = [{ id: 'b', titolo: 'Zeta', stato: 'aperta' }, { id: 'a', titolo: 'Alfa', stato: 'in_corso' }, { id: 'c', titolo: 'Beta', stato: 'risolta' }];
  const docs = ['1', '2', '3', '4', '5'].map((n) => ({ id: n, pratica_id: 'a' }));
  const passi = [{ pratica_id: 'a', scadenza: '2026-12-10', priorita: 'media' }, { pratica_id: 'a', scadenza: '2026-11-30', priorita: 'alta' }];
  const e = arricchisci(pratiche, docs, passi);
  assert.deepEqual(e.map((p) => p.nome), ['Pratica Alfa', 'Pratica Beta', 'Pratica Zeta']);
  const a = e[0];
  assert.equal(a.anteprime.length, 4); assert.equal(a.passiAperti, 2); assert.equal(a.prossimo, '2026-11-30'); assert.equal(a.urgente, true);
  assert.deepEqual(filtraPratiche(e, 'gestire').map((p) => p.id), ['a']);
  assert.deepEqual(filtraPratiche(e, 'tutte').map((p) => p.id), ['a', 'b']);
  assert.deepEqual(filtraPratiche(e, 'chiuse').map((p) => p.id), ['c']);
  assert.deepEqual(contaFiltri(e), { gestire: 1, tutte: 2, chiuse: 1 });
});
