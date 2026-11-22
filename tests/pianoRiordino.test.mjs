// POL-VITA-ORDINA fase 2: logica del «Piano di riordino» (nessuno spostamento su Drive in questa fase).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  livello, controllaNome, nomeConforme, riepilogo, filtra, raggruppa, radici, decidi, cambiaCartella, rinomina, importaPiano,
} from '../personal/src/lib/pianoRiordino.js';

const R = (o) => ({ id: o.id || Math.random().toString(36).slice(2), stato: 'proposto', confidenza: 0.9, nome_attuale: 'x.pdf', nome_nuovo: '2024-01-02_Fattura_Enel_Gennaio.pdf', percorso_nuovo: '10 Utenze/Luce – Enel/2024', motivo: 'utenza', ...o });

test('livelli di confidenza: verde ≥ 0,85, giallo 0,60–0,85, rosso sotto', () => {
  assert.equal(livello(0.85), 'alta');
  assert.equal(livello(0.84), 'media');
  assert.equal(livello(0.6), 'media');
  assert.equal(livello(0.59), 'bassa');
});

test('nome: stesse regole del vincolo sul database', () => {
  assert.equal(controllaNome('2024-01-02_Fattura_Enel.pdf'), null);
  assert.match(controllaNome(''), /vuoto/);
  assert.match(controllaNome('a'.repeat(91)), /troppo lungo/);
  assert.match(controllaNome('a/b'), /non può/);
  assert.ok(nomeConforme('2024-01-02_Fattura_Enel_Gennaio.pdf'));
  assert.ok(nomeConforme('2024_Documento_Comune-di-Cuneo'));
  assert.ok(!nomeConforme('Scansione 12.pdf'));
});

test('riepilogo: percentuale in «99 Da verificare» e nomi conformi', () => {
  const r = riepilogo([R({}), R({ percorso_nuovo: '99 Da verificare/Dubbi', confidenza: 0.4 }), R({ stato: 'approvato' }), R({ nome_nuovo: 'brutto.pdf', confidenza: 0.7 })]);
  assert.equal(r.totale, 4);
  assert.equal(r.proposto, 3);
  assert.equal(r.approvato, 1);
  assert.equal(r.percDaVerificare, 25);
  assert.equal(r.percConformi, 75);
  assert.equal(r.alte, 1); // solo le proposte ancora da decidere contano per «Approva tutto ≥ 0,85»
});

test('filtri e ricerca', () => {
  const righe = [R({ id: 'a' }), R({ id: 'b', confidenza: 0.7 }), R({ id: 'c', stato: 'rifiutato' })];
  assert.deepEqual(filtra(righe, 'da_decidere').map((x) => x.id), ['a', 'b']);
  assert.deepEqual(filtra(righe, 'gialli').map((x) => x.id), ['b']);
  assert.deepEqual(filtra(righe, 'rifiutati').map((x) => x.id), ['c']);
  assert.deepEqual(filtra(righe, 'tutti', 'ENEL').length, 3);
});

test('gruppi per cartella di destinazione, ordinati come su Drive, prima le righe meno sicure', () => {
  const g = raggruppa([R({ id: 'z', percorso_nuovo: '99 Da verificare/Dubbi', confidenza: 0.4 }), R({ id: 'a' }), R({ id: 'b', confidenza: 0.62 }), R({ id: 'c', percorso_nuovo: '02 Casa e catasto/Cuneo – via Piccona 36/Bollette' })]);
  assert.deepEqual(g.map((x) => x.radice), ['02 Casa e catasto', '10 Utenze', '99 Da verificare']);
  assert.deepEqual(g[1].voci.map((x) => x.id), ['b', 'a']);
  assert.equal(g[1].daDecidere, 2);
  assert.deepEqual(radici(g).map((x) => x.n), [1, 2, 1]);
});

function dbFinto() {
  const chiamate = [];
  const q = { update(c) { chiamate.push(['update', c]); return q; }, in(k, v) { chiamate.push(['in', v]); return q; }, neq(k, v) { chiamate.push(['neq', k, v]); return Promise.resolve({ error: null }); } };
  return { chiamate, from: (t) => { chiamate.push(['from', t]); return q; } };
}

test('decidere non tocca mai le righe già eseguite e lavora a blocchi', async () => {
  const db = dbFinto();
  const n = await decidi(db, Array.from({ length: 450 }, (_, i) => `id${i}`).concat('id0'), { stato: 'approvato' });
  assert.equal(n, 450);
  assert.equal(db.chiamate.filter((c) => c[0] === 'in').length, 3);
  assert.ok(db.chiamate.every((c) => c[0] !== 'neq' || (c[1] === 'stato' && c[2] === 'eseguito')));
});

test('cambia cartella solo verso la tassonomia; rinomina con controllo del nome', async () => {
  await assert.rejects(cambiaCartella(dbFinto(), 'x', null), /tassonomia/);
  const db = dbFinto();
  await cambiaCartella(db, 'x', { id: '10-utenze', percorso: '10 Utenze' });
  assert.deepEqual(db.chiamate[1], ['update', { categoria_id: '10-utenze', percorso_nuovo: '10 Utenze', stato: 'approvato' }]);
  await assert.rejects(rinomina(dbFinto(), 'x', 'a:b'), /non può/);
});

test('import del piano: chiede allo script, messaggio chiaro se lo script non è ancora pubblicato', async () => {
  const finto = (r) => async (url, o) => { assert.equal(JSON.parse(o.body).azione, 'importa_piano'); return { json: async () => r }; };
  assert.deepEqual(await importaPiano({ token: 't' }, finto({ ok: true, righe: 3, categorie: 2 })), { ok: true, righe: 3, categorie: 2 });
  await assert.rejects(importaPiano({ token: 't' }, finto({ ok: false, errore: 'File mancante' })), /pubblicata la versione nuova/);
  await assert.rejects(importaPiano({}, finto({ ok: true })), /Sessione scaduta/);
});

test('la schermata non sposta file e lo script importa solo dati senza sovrascrivere decisioni', () => {
  const vista = readFileSync(new URL('../personal/src/sezioni/riordino/Riordino.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(vista, /sposta_documenti|rinomina_file|cestina/);
  for (const t of ['Approva tutto il gruppo', 'Approva tutto ≥ 0,85', 'Cambia cartella', 'Rinomina', 'Rifiuta', 'Anteprima']) assert.ok(vista.includes(t), t);
  const gs = readFileSync(new URL('../poliedron/archivio/Code.gs', import.meta.url), 'utf8');
  const imp = gs.slice(gs.indexOf('function importaPianoRiordino_'));
  assert.match(imp, /resolution=ignore-duplicates/);
  assert.doesNotMatch(imp, /setTrashed|moveTo|setName|removeFile/);
});
