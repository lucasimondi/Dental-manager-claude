// PR #337 §2–§9 — Esplora file stile Windows 11: logica pura di schede, cronologia, percorso, ricerca, Recenti,
// pannello di navigazione (dati sintetici).
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME, RADICE, CESTINO, PREFERITI, RECENTI, nodoCerca, datiCerca, eVirtuale, nomeNodo, percorsoNodo, padreDi } from '../personal/src/lib/esplora.js';
import {
  nuovaScheda, nodoScheda, vaiInScheda, indietroScheda, avantiScheda, puoIndietro, puoAvanti, sostituisciInScheda, chiudiScheda, spostaScheda, posizioneDaX,
  nodoDaTesto, testoPercorso, documentiNelSottoalbero, cartelleNelSottoalbero, filtraRisultati, cartelleTrovate, nelNome, evidenzia,
  leggiRecenti, ricordaRecente, larghezzaPannello, leggiPannello, salvaPannello, swipeApre, testoSelezione, nodoValido,
} from '../personal/src/lib/esploraNav.js';

const cart = (id, nome, padre_id = null, extra = {}) => ({ id, nome, padre_id, archiviata_il: null, ...extra });
const cartelle = [cart('docs', 'Documenti'), cart('catasto', 'Catasto', 'docs'), cart('visure', 'Visure', 'catasto'), cart('auto', 'Auto'), cart('vecchia', 'Vecchia', null, { archiviata_il: '2026-01-01' })];
const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('schede: cronologia Indietro/Avanti come nel browser, stesso nodo = nessuna voce', () => {
  let s = nuovaScheda(HOME, 'a');
  assert.equal(nodoScheda(s), HOME);
  s = vaiInScheda(s, RADICE); s = vaiInScheda(s, 'docs'); s = vaiInScheda(s, 'docs');
  assert.deepEqual(s.storia, [HOME, RADICE, 'docs']);
  s = indietroScheda(s); assert.equal(nodoScheda(s), RADICE); assert.ok(puoAvanti(s));
  s = vaiInScheda(s, 'auto'); // tronca «avanti»
  assert.deepEqual(s.storia, [HOME, RADICE, 'auto']); assert.ok(!puoAvanti(s)); assert.ok(puoIndietro(s));
  assert.equal(nodoScheda(avantiScheda(s)), 'auto');
  assert.deepEqual(sostituisciInScheda(s, 'docs').storia, [HOME, RADICE, 'docs']);
});

test('schede: chiudi (l’ultima diventa Home, l’attiva passa alla vicina), riordina trascinando', () => {
  const [a, b, c] = ['a', 'b', 'c'].map((id) => nuovaScheda(RADICE, id));
  assert.deepEqual(chiudiScheda([a, b, c], 'b', 'b').attiva, 'c');
  assert.deepEqual(chiudiScheda([a, b, c], 'c', 'c').attiva, 'b');
  assert.deepEqual(chiudiScheda([a, b, c], 'a', 'c').attiva, 'a');
  const sola = chiudiScheda([a], 'a', 'a');
  assert.equal(sola.schede.length, 1); assert.equal(nodoScheda(sola.schede[0]), HOME);
  assert.deepEqual(spostaScheda([a, b, c], 'a', 2).map((s) => s.id), ['b', 'c', 'a']);
  assert.deepEqual(spostaScheda([a, b, c], 'c', 0).map((s) => s.id), ['c', 'a', 'b']);
  assert.equal(posizioneDaX([{ left: 0, width: 100 }, { left: 100, width: 100 }], 160), 2);
  assert.equal(posizioneDaX([{ left: 0, width: 100 }, { left: 100, width: 100 }], 40), 0);
});

test('nodi del pannello: Home in cima, Personale sotto Home, ricerca con la sua base', () => {
  for (const n of [HOME, CESTINO, PREFERITI, RECENTI, nodoCerca('docs', 'imu')]) assert.ok(eVirtuale(n), n);
  assert.equal(padreDi(cartelle, RADICE), HOME);
  assert.equal(padreDi(cartelle, HOME), null);
  const n = nodoCerca('catasto', 'visura 2026');
  assert.deepEqual(datiCerca(n), { base: 'catasto', testo: 'visura 2026' });
  assert.equal(nomeNodo(n, { cartelle }), 'Risultati per «visura 2026»');
  assert.deepEqual(percorsoNodo(n, { cartelle }).map((p) => p.nome), ['Personale', 'Documenti', 'Catasto', 'Risultati per «visura 2026»']);
  assert.equal(padreDi(cartelle, n), 'catasto');
  assert.ok(nodoValido(CESTINO, cartelle)); assert.ok(!nodoValido('vecchia', cartelle)); assert.ok(nodoValido('visure', cartelle));
});

test('percorso scritto a mano (clic sullo spazio vuoto del breadcrumb)', () => {
  assert.equal(nodoDaTesto('Personale / Documenti / Catasto', cartelle), 'catasto');
  assert.equal(nodoDaTesto('Home › Documenti › Catasto › visure', cartelle), 'visure');
  assert.equal(nodoDaTesto('documenti\\catasto', cartelle), 'catasto');
  assert.equal(nodoDaTesto('Home', cartelle), HOME);
  assert.equal(nodoDaTesto('Personale', cartelle), RADICE);
  assert.equal(nodoDaTesto('Documenti / Nessuna', cartelle), null);
  assert.equal(nodoDaTesto('Vecchia', cartelle), null, 'archiviata');
  assert.equal(testoPercorso([{ nome: 'Personale' }, { nome: 'Documenti' }]), 'Personale › Documenti');
});

test('ricerca: cartella corrente e sottocartelle, per nome e contenuto, filtri tipo/data/categoria, mai i clinici', () => {
  const posizioni = [{ doc: 'd1', nodo: 'docs' }, { doc: 'd2', nodo: 'visure' }, { doc: 'd3', nodo: 'auto' }];
  assert.deepEqual([...documentiNelSottoalbero('docs', { cartelle, posizioni })].sort(), ['d1', 'd2']);
  assert.equal(documentiNelSottoalbero(HOME, { cartelle, posizioni }), null);
  assert.deepEqual(cartelleNelSottoalbero('docs', cartelle).map((c) => c.id), ['catasto', 'visure']);
  assert.deepEqual(cartelleTrovate(cartelleNelSottoalbero(HOME, cartelle), 'vis').map((c) => c.id), ['visure']);
  const adesso = Date.parse('2026-11-22T12:00:00Z');
  const docs = [
    { id: 'd1', fascicolo: 'immobili', mime_type: 'application/pdf', data_documento: '2026-11-20' },
    { id: 'd2', fascicolo: 'immobili', mime_type: 'image/jpeg', data_documento: '2025-01-01' },
    { id: 'd3', fascicolo: 'veicoli', mime_type: 'application/pdf', data_documento: '2026-11-21' },
    { id: 'd4', fascicolo: 'clinico_pazienti', mime_type: 'application/pdf', data_documento: '2026-11-21' },
  ];
  assert.deepEqual(filtraRisultati(docs, {}, adesso).map((d) => d.id), ['d1', 'd2', 'd3']);
  assert.deepEqual(filtraRisultati(docs, { dentro: new Set(['d1', 'd2', 'd4']) }, adesso).map((d) => d.id), ['d1', 'd2']);
  assert.deepEqual(filtraRisultati(docs, { tipo: 'pdf' }, adesso).map((d) => d.id), ['d1', 'd3']);
  assert.deepEqual(filtraRisultati(docs, { data: 'settimana' }, adesso).map((d) => d.id), ['d1', 'd3']);
  assert.deepEqual(filtraRisultati(docs, { categoria: 'veicoli' }, adesso).map((d) => d.id), ['d3']);
  assert.ok(nelNome('Visura catastale 2026', 'visura')); assert.ok(!nelNome('Rogito', 'visura'));
  assert.deepEqual(evidenzia('Visura Catastale', 'catast'), [{ t: 'Visura ', m: false }, { t: 'Catast', m: true }, { t: 'ale', m: false }]);
  assert.deepEqual(evidenzia('a.b', 'x'), [{ t: 'a.b', m: false }]);
  assert.deepEqual(evidenzia('IMU (acconto)', '(acconto)'), [{ t: 'IMU ', m: false }, { t: '(acconto)', m: true }]);
});

test('Recenti e pannello: localStorage dentro try/catch, limiti', () => {
  const m = memoria();
  ricordaRecente('a', m, 1); ricordaRecente('b', m, 2); ricordaRecente('a', m, 3);
  assert.deepEqual(leggiRecenti(m).map((r) => r.id), ['a', 'b']);
  assert.deepEqual(leggiRecenti({ getItem: () => { throw new Error('bloccato'); } }), []);
  assert.doesNotThrow(() => ricordaRecente('x', { getItem: () => null, setItem: () => { throw new Error('pieno'); } }));
  assert.equal(larghezzaPannello(50), 160); assert.equal(larghezzaPannello(900), 420);
  salvaPannello({ larghezza: 300, chiuso: true }, m);
  assert.deepEqual(leggiPannello(m), { larghezza: 300, chiuso: true });
  assert.ok(swipeApre({ x: 10, y: 300 }, { x: 120, y: 310 }));
  assert.ok(!swipeApre({ x: 60, y: 300 }, { x: 200, y: 300 }), 'non parte dal bordo');
  assert.ok(!swipeApre({ x: 10, y: 300 }, { x: 120, y: 420 }), 'troppo in verticale');
  assert.equal(testoSelezione(0, 0), '');
  assert.equal(testoSelezione(2, 2_400_000), '2 elementi selezionati, 2,3 MB');
  assert.equal(testoSelezione(1, 0), '1 elemento selezionato');
});

/* ---------- §3 viste ---------- */
import { VISTE_ESPLORA, vistaConRotella, righeDettagli, ordinaRighe, COLONNE_DETTAGLI, cambiaColonna, raggruppa, gruppoDi, leggiCartelle, salvaCartella, impostazioniDi, conMiniatura, salvaVista, leggiViste, vistaDi } from '../personal/src/lib/esplora.js';

test('viste: sei viste Win11, Ctrl+rotella dalla più grande alla più piccola, ai bordi ferma', () => {
  assert.deepEqual(VISTE_ESPLORA.map(([, n]) => n), ['Icone grandi', 'Icone medie', 'Icone piccole', 'Elenco', 'Dettagli', 'Riquadri']);
  assert.equal(vistaConRotella('grandi', 100), 'medie');
  assert.equal(vistaConRotella('medie', -100), 'grandi');
  assert.equal(vistaConRotella('grandi', -100), 'grandi');
  assert.equal(vistaConRotella('riquadri', 100), 'riquadri');
  const m = memoria();
  salvaVista('casa', 'piccole', m);
  assert.equal(vistaDi(leggiViste(m), 'casa'), 'piccole');
  assert.equal(vistaDi(leggiViste(m), 'altra'), 'grandi');
});

test('Dettagli: colonna Categoria, scelta colonne (Nome resta), ordinamento con cartelle prima', () => {
  assert.deepEqual(COLONNE_DETTAGLI.map(([k]) => k), ['nome', 'data', 'tipo', 'dimensione', 'categoria']);
  const r = righeDettagli([{ id: 'c', nome: 'Zeta' }], [{ id: 'a', titolo: 'Bolletta', fascicolo: 'utenze', mime_type: 'application/pdf', creato_il: '2026-11-01' }, { id: 'b', titolo: 'Auto', fascicolo: 'veicoli', mime_type: 'image/png', creato_il: '2026-10-01' }], {}, [{ codice: 'utenze', nome: 'Utenze' }]);
  assert.deepEqual(r.map((x) => x.categoria), ['', 'Utenze', 'veicoli']);
  assert.deepEqual(ordinaRighe(r, { chiave: 'categoria', verso: 'su' }).map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(ordinaRighe(r, { chiave: 'nome', verso: 'giu' }).map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(cambiaColonna(['nome', 'data', 'tipo'], 'nome'), ['nome', 'data', 'tipo']);
  assert.deepEqual(cambiaColonna(['nome', 'data', 'tipo'], 'data'), ['nome', 'tipo']);
  assert.deepEqual(cambiaColonna(['nome', 'tipo'], 'data'), ['nome', 'data', 'tipo'], 'torna al suo posto');
});

test('Raggruppa per nome / data / tipo / categoria; impostazioni salvate per cartella', () => {
  const adesso = Date.parse('2026-11-22T10:00:00Z');
  const righe = [
    { cosa: 'cartella', nome: 'Auto', data: '2026-11-22T08:00:00Z', tipo: 'Cartella di file', categoria: '' },
    { cosa: 'file', nome: 'Bolletta', data: '2026-11-21T08:00:00Z', tipo: 'Documento PDF', categoria: 'Utenze' },
    { cosa: 'file', nome: 'rogito', data: '2025-01-01T08:00:00Z', tipo: 'Documento PDF', categoria: 'Immobili' },
    { cosa: 'file', nome: '730', data: null, tipo: 'Foglio Excel', categoria: '' },
  ];
  assert.deepEqual(raggruppa(righe, 'nome', adesso).map((g) => g.titolo), ['0 – 9', 'A – H', 'Q – Z']);
  assert.deepEqual(raggruppa(righe, 'data', adesso).map((g) => [g.titolo, g.righe.length]), [['Oggi', 1], ['Ieri', 1], ['Tempo fa', 1], ['Senza data', 1]]);
  assert.deepEqual(raggruppa(righe, 'categoria', adesso).map((g) => g.titolo), ['Cartelle', 'Immobili', 'Senza categoria', 'Utenze']);
  assert.deepEqual(raggruppa(righe, '', adesso), [{ titolo: '', righe }]);
  assert.equal(gruppoDi(righe[1], 'tipo'), 'Documento PDF');
  const m = memoria();
  salvaCartella('casa', { ordine: { chiave: 'data', verso: 'giu' } }, m);
  salvaCartella('casa', { gruppo: 'tipo' }, m);
  salvaCartella('*', { colonne: ['nome', 'tipo'] }, m);
  assert.deepEqual(impostazioniDi(leggiCartelle(m), 'casa'), { ordine: { chiave: 'data', verso: 'giu' }, gruppo: 'tipo', colonne: ['nome', 'tipo'] });
  assert.deepEqual(impostazioniDi(leggiCartelle(m), 'altra').ordine, { chiave: 'nome', verso: 'su' });
  assert.deepEqual(leggiCartelle({ getItem: () => '{rotto' }), {});
  assert.ok(conMiniatura({ drive_file_id: 'x', mime_type: 'image/jpeg' }));
  assert.ok(conMiniatura({ drive_file_id: 'x', mime_type: 'application/pdf' }));
  assert.ok(!conMiniatura({ drive_file_id: 'x', mime_type: 'application/pdf', fascicolo: 'clinico_pazienti' }), 'mai miniature dei pazienti');
  assert.ok(!conMiniatura({ mime_type: 'image/jpeg' }));
});
