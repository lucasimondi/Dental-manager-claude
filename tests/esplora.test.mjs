// PERSONAL-ESPLORA-WIN11 fase 1: logica pura di Esplora file (pallini, destinazioni, Taglia/Incolla, Annulla).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RADICE, DA_CATALOGARE, CATEGORIE, FUORI, nodoCategoria, eVirtuale, disposizione, colonneGriglia, altezzaAlbero,
  sottocartelle, padreDi, percorsoNodo, documentiDaGestire, calcolaPallini, etichettaPallino, testoStato,
  motivoNonValido, destinazioneValida, vociSpostaIn, operazioneSposta, inversa, applica, chiamate, eseguiOperazione,
  taglia, incolla, nomeNuovaCartella, vociMenu, posizioneMenu, tipoFile, paginaDaCatalogare, documentiNelNodo,
} from '../personal/src/lib/esplora.js';
import { avvisoCartella, scadenzaDaGestire } from '../personal/src/lib/revisioneArchivio.js';

const cartelle = [
  { id: 'casa', nome: 'Casa', padre_id: null, posizione: 0 },
  { id: 'utenze', nome: 'Utenze', padre_id: 'casa', posizione: 0 },
  { id: 'luce', nome: 'Luce', padre_id: 'utenze', posizione: 0 },
  { id: 'auto', nome: 'Auto', padre_id: null, posizione: 1 },
  { id: 'vecchia', nome: 'Vecchia', padre_id: null, posizione: 2, archiviata_il: '2026-01-01' },
];
const posizioni = [
  { doc: 'd1', nodo: 'luce' }, { doc: 'd2', nodo: 'utenze' }, { doc: 'd3', nodo: 'casa' },
  { doc: 'd4', nodo: 'auto' }, { doc: 'd5', nodo: RADICE }, { doc: 'd1', nodo: 'auto' },
];
const fascicoli = [{ codice: 'utenze', nome: 'Utenze', ordine: 2 }, { codice: 'veicoli', nome: 'Veicoli', ordine: 1 }, { codice: 'clinico_pazienti', nome: 'Pazienti', ordine: 0 }];
const opz = { cartelle, posizioni };

test('disposizione decisa dall’orientamento; colonne e altezza albero', () => {
  assert.equal(disposizione(844, 390), 'orizzontale');
  assert.equal(disposizione(390, 844), 'verticale');
  assert.equal(colonneGriglia('orizzontale'), 6);
  assert.equal(colonneGriglia('verticale'), 4);
  assert.equal(altezzaAlbero(300, 844), 300);
  assert.equal(altezzaAlbero(900, 844), Math.round(844 * 0.55));
  assert.equal(altezzaAlbero(10, 844), 120);
});

test('albero: sottocartelle vive, padre, percorso, virtuali', () => {
  assert.deepEqual(sottocartelle(cartelle, RADICE).map((c) => c.id), ['casa', 'auto']);
  assert.deepEqual(sottocartelle(cartelle, 'casa').map((c) => c.id), ['utenze']);
  assert.equal(padreDi(cartelle, 'luce'), 'utenze');
  assert.equal(padreDi(cartelle, 'casa'), RADICE);
  assert.equal(padreDi(cartelle, nodoCategoria('utenze')), CATEGORIE);
  assert.deepEqual(percorsoNodo('luce', { cartelle }).map((p) => p.nome), ['Personale', 'Casa', 'Utenze', 'Luce']);
  assert.ok(eVirtuale(DA_CATALOGARE) && eVirtuale(CATEGORIE) && eVirtuale(nodoCategoria('x')) && !eVirtuale('casa') && !eVirtuale(RADICE));
});

test('regola condivisa delle scadenze: passata o entro 14 giorni, non opportunità', () => {
  const oggi = '2026-11-21';
  const s = (data, extra = {}) => ({ id: 's', data, completata: false, storica: false, importo: null, documento: { fascicolo: 'utenze', titolo: 'Avviso', tipo_documento: 'avviso' }, ...extra });
  assert.equal(scadenzaDaGestire(s('2026-11-01'), oggi), true);
  assert.equal(scadenzaDaGestire(s('2026-12-05'), oggi), true);
  assert.equal(scadenzaDaGestire(s('2026-12-06'), oggi), false);
  assert.equal(scadenzaDaGestire(s('2026-11-01', { completata: true }), oggi), false);
  assert.equal(scadenzaDaGestire(s('2026-11-01', { documento: { fascicolo: 'pubblicita', titolo: 'Invito' } }), oggi), false);
  // avvisoCartella usa la stessa regola
  assert.equal(avvisoCartella([s('2026-11-01'), s('2026-12-30')], oggi).n, 1);
});

test('pallini: ricorsivi sulle sottocartelle, un documento contato una volta, clinici esclusi', () => {
  const oggi = '2026-11-21';
  const daGestire = documentiDaGestire({
    oggi,
    scadenze: [
      { id: 'a', documento_id: 'd1', data: '2026-11-25', completata: false, storica: false, documento: { fascicolo: 'utenze', titolo: 'Bolletta' } },
      { id: 'b', documento_id: 'd9', data: '2026-11-20', completata: false, storica: false, documento: { fascicolo: 'clinico_pazienti' } },
      { id: 'c', documento_id: 'd3', data: '2027-03-01', completata: false, storica: false, documento: { fascicolo: 'utenze' } },
    ],
    azioni: [{ id: 'd2', azione_richiesta: true, fascicolo: 'utenze' }, { id: 'd4', azione_richiesta: true, fascicolo: 'veicoli' }, { id: 'd1', azione_richiesta: true, fascicolo: 'utenze' }],
  });
  assert.deepEqual([...daGestire.keys()].sort(), ['d1', 'd2', 'd4']);
  const n = calcolaPallini({ cartelle, posizioni, daGestire, nDaCatalogare: 7432, fascicoli });
  assert.equal(n.get('luce'), 1);
  assert.equal(n.get('utenze'), 2); // d1 (dalla sottocartella) + d2
  assert.equal(n.get('casa'), 2);
  assert.equal(n.get('auto'), 2); // d1 e d4
  assert.equal(n.get(RADICE), 3); // d1 una volta sola
  assert.equal(n.get(DA_CATALOGARE), 7432);
  assert.equal(n.get(nodoCategoria('utenze')), 2);
  assert.equal(n.get(nodoCategoria('veicoli')), 1);
  assert.equal(n.has(nodoCategoria('clinico_pazienti')), false);
  assert.equal(n.get(CATEGORIE), 3);
  // si ricalcolano dopo uno spostamento
  const op = operazioneSposta([{ tipo: 'doc', id: 'd2', da: 'utenze' }], 'auto', opz);
  const dopo = applica({ cartelle, posizioni }, op);
  const n2 = calcolaPallini({ ...dopo, daGestire, fascicoli });
  assert.equal(n2.get('utenze'), 1);
  assert.equal(n2.get('auto'), 3);
  assert.equal(etichettaPallino(0), null);
  assert.equal(etichettaPallino(12), '12');
  assert.equal(etichettaPallino(7432), '999+');
  assert.equal(testoStato(1, 0), '1 elemento · 0 da gestire');
  assert.equal(testoStato(5, 2), '5 elementi · 2 da gestire');
});

test('destinazioni: mai dentro sé stessa o una sottocartella, mai dove sta già, mai nelle virtuali', () => {
  const casa = [{ tipo: 'cartella', id: 'casa', da: RADICE }];
  assert.equal(destinazioneValida(casa, 'luce', opz), false);
  assert.equal(destinazioneValida(casa, 'casa', opz), false);
  assert.equal(destinazioneValida(casa, RADICE, opz), false); // ci sta già
  assert.equal(destinazioneValida(casa, 'auto', opz), true);
  assert.equal(destinazioneValida(casa, DA_CATALOGARE, opz), false);
  assert.equal(destinazioneValida(casa, nodoCategoria('utenze'), opz), false);
  assert.equal(destinazioneValida(casa, 'vecchia', opz), false); // archiviata
  const d1 = [{ tipo: 'doc', id: 'd1', da: 'luce' }];
  assert.equal(destinazioneValida(d1, 'luce', opz), false);
  assert.equal(destinazioneValida(d1, 'auto', opz), false); // ci sta già (altra posizione)
  assert.equal(destinazioneValida(d1, 'casa', opz), true);
  assert.equal(motivoNonValido(d1, CATEGORIE, opz), 'le cartelle virtuali sono solo di partenza');
  // tutte le sorgenti devono poter andare lì
  assert.equal(destinazioneValida([...casa, { tipo: 'cartella', id: 'auto', da: RADICE }], 'luce', opz), false);
  const voci = vociSpostaIn([{ tipo: 'cartella', id: 'utenze', da: 'casa' }], opz);
  assert.deepEqual(voci.map((v) => [v.id, v.livello, v.vietata, v.attuale]), [
    [RADICE, 0, false, false], ['casa', 1, true, true], ['utenze', 2, true, false], ['luce', 3, true, false], ['auto', 1, false, false],
  ]);
});

test('sposta e Annulla: l’operazione inversa rimette tutto com’era', () => {
  const sorgenti = [{ tipo: 'doc', id: 'd2', da: 'utenze' }, { tipo: 'cartella', id: 'luce', da: 'utenze' }, { tipo: 'doc', id: 'd7', da: DA_CATALOGARE }];
  const op = operazioneSposta(sorgenti, 'auto', opz);
  assert.deepEqual(op.mosse, [
    { tipo: 'doc', id: 'd2', da: 'utenze', a: 'auto' },
    { tipo: 'cartella', id: 'luce', da: 'utenze', a: 'auto' },
    { tipo: 'doc', id: 'd7', da: FUORI, a: 'auto' },
  ]);
  const prima = { cartelle, posizioni };
  const dopo = applica(prima, op);
  assert.equal(dopo.cartelle.find((c) => c.id === 'luce').padre_id, 'auto');
  assert.deepEqual(documentiNelNodo(dopo.posizioni, 'auto').sort(), ['d1', 'd2', 'd4', 'd7']);
  assert.deepEqual(documentiNelNodo(dopo.posizioni, 'utenze'), []);
  const tornato = applica(dopo, inversa(op));
  assert.equal(tornato.cartelle.find((c) => c.id === 'luce').padre_id, 'utenze');
  assert.deepEqual(new Set(tornato.posizioni.map((p) => `${p.doc}@${p.nodo}`)), new Set(posizioni.map((p) => `${p.doc}@${p.nodo}`)));
  assert.deepEqual(chiamate(op), [
    { fn: 'spostaCartelle', ids: ['luce'], padre: 'auto' },
    { fn: 'spostaDocumenti', ids: ['d2'], da: 'utenze', a: 'auto' },
    { fn: 'aggiungiDocumenti', cartella: 'auto', ids: ['d7'] },
  ]);
  assert.deepEqual(chiamate(inversa(op)), [
    { fn: 'spostaCartelle', ids: ['luce'], padre: 'utenze' },
    { fn: 'spostaDocumenti', ids: ['d2'], da: 'auto', a: 'utenze' },
    { fn: 'togliDocumenti', cartella: 'auto', ids: ['d7'] },
  ]);
  // verso Personale = scrivania (null nel database)
  const suRadice = operazioneSposta([{ tipo: 'doc', id: 'd3', da: 'casa' }, { tipo: 'doc', id: 'd8', da: nodoCategoria('utenze') }], RADICE, opz);
  assert.deepEqual(chiamate(suRadice), [{ fn: 'spostaDocumenti', ids: ['d3'], da: 'casa', a: null }, { fn: 'aggiungiAScrivania', ids: ['d8'] }]);
  assert.deepEqual(chiamate(inversa(suRadice)), [{ fn: 'spostaDocumenti', ids: ['d3'], da: null, a: 'casa' }, { fn: 'togliDaScrivania', ids: ['d8'] }]);
});

test('archivia, rinomina e crea con il loro Annulla', () => {
  const s0 = { cartelle, posizioni };
  const arch = { tipo: 'archivia', ids: ['auto'] };
  const s1 = applica(s0, arch, 'T');
  assert.equal(s1.cartelle.find((c) => c.id === 'auto').archiviata_il, 'T');
  assert.deepEqual(sottocartelle(s1.cartelle, RADICE).map((c) => c.id), ['casa']);
  assert.equal(applica(s1, inversa(arch)).cartelle.find((c) => c.id === 'auto').archiviata_il, null);
  const rin = { tipo: 'rinomina', cosa: 'cartella', id: 'casa', da: 'Casa', a: 'Casa mia' };
  const s2 = applica(s0, rin);
  assert.equal(s2.cartelle.find((c) => c.id === 'casa').nome, 'Casa mia');
  assert.equal(applica(s2, inversa(rin)).cartelle.find((c) => c.id === 'casa').nome, 'Casa');
  const rinD = { tipo: 'rinomina', cosa: 'doc', id: 'd1', da: 'A', a: 'B' };
  assert.equal(applica(s0, rinD).titoli.d1, 'B');
  assert.deepEqual(chiamate(rinD), [{ fn: 'rinominaDocumento', id: 'd1', nome: 'B' }]);
  const crea = { tipo: 'crea', id: 'nuova', nome: 'Nuova cartella', padre: 'casa' };
  assert.deepEqual(sottocartelle(applica(s0, crea).cartelle, 'casa').map((c) => c.id), ['nuova', 'utenze']);
  assert.deepEqual(inversa(crea), { tipo: 'archivia', ids: ['nuova'] });
});

test('Taglia / Incolla', () => {
  const app = taglia([{ tipo: 'doc', id: 'd3', da: 'casa' }], 'Contratto');
  assert.equal(app.nome, 'Contratto');
  assert.equal(incolla(app, 'casa', opz), null); // già lì
  assert.equal(incolla(app, DA_CATALOGARE, opz), null);
  assert.deepEqual(incolla(app, 'auto', opz).mosse, [{ tipo: 'doc', id: 'd3', da: 'casa', a: 'auto' }]);
  assert.equal(incolla(null, 'auto', opz), null);
  assert.equal(taglia([]), null);
  const menu = vociMenu('vuoto', { nodo: 'auto', appunti: app, opz });
  assert.deepEqual(menu.map((v) => [v.nome, v.attiva]), [['Nuova cartella', true], ['Incolla «Contratto»', true], ['Aggiorna', true]]);
  assert.equal(vociMenu('vuoto', { nodo: 'casa', appunti: app, opz })[1].attiva, false);
  assert.equal(vociMenu('vuoto', { nodo: DA_CATALOGARE, appunti: app, opz })[0].attiva, false);
});

test('menu: voci non applicabili disattivate per Personale e virtuali; clinici non si eliminano', () => {
  const att = (cosa, o) => Object.fromEntries(vociMenu(cosa, o).map((v) => [v.id, v.attiva]));
  assert.deepEqual(att('cartella', { nodo: 'casa' }), { apri: true, nuova: true, taglia: true, sposta: true, rinomina: true, elimina: true });
  assert.deepEqual(att('cartella', { nodo: RADICE }), { apri: true, nuova: true, taglia: false, sposta: false, rinomina: false, elimina: false });
  assert.deepEqual(att('cartella', { nodo: DA_CATALOGARE }), { apri: true, nuova: false, taglia: false, sposta: false, rinomina: false, elimina: false });
  assert.equal(att('file', { clinico: true }).elimina, false);
  assert.deepEqual(vociMenu('file', {}).map((v) => v.nome), ['Apri', 'Taglia', 'Sposta in…', 'Rinomina', 'Elimina']);
});

test('nuova cartella, menu dentro lo schermo, tipo di file', () => {
  assert.equal(nomeNuovaCartella(['Casa']), 'Nuova cartella');
  assert.equal(nomeNuovaCartella(['Nuova cartella', 'nuova cartella (2)']), 'Nuova cartella (3)');
  assert.deepEqual(posizioneMenu(380, 800, 220, 240, 390, 844), { left: 162, top: 596 });
  assert.deepEqual(posizioneMenu(-5, -5, 220, 240, 390, 844), { left: 8, top: 8 });
  assert.equal(tipoFile({ mime_type: 'application/pdf' }), 'pdf');
  assert.equal(tipoFile({ nome_file_originale: 'foto.JPG' }), 'immagine');
  assert.equal(tipoFile({ nome_file_originale: 'conto.xlsx' }), 'office');
  assert.equal(tipoFile({ mime_type: 'message/rfc822' }), 'email');
});

test('esegue le chiamate con le funzioni date, in ordine', async () => {
  const log = [];
  const api = new Proxy({}, { get: (_, fn) => async (...a) => { log.push([fn, ...a.slice(1)]); } });
  await eseguiOperazione('db', operazioneSposta([{ tipo: 'doc', id: 'd3', da: 'casa' }], 'auto', opz), api);
  await eseguiOperazione('db', { tipo: 'ripristina', ids: ['x'] }, api);
  assert.deepEqual(log, [['spostaDocumenti', ['d3'], 'casa', 'auto'], ['archiviaCartelle', ['x'], false]]);
});

test('Da catalogare: pagine che saltano i documenti già in una cartella', async () => {
  const tutti = Array.from({ length: 13 }, (_, i) => ({ id: `d${i}` }));
  const db = { from: () => {
    const q = { _r: null, select() { return q; }, neq() { return q; }, order() { return q; }, range(a, b) { q._r = [a, b]; return q; },
      then(ok, ko) { return Promise.resolve({ data: tutti.slice(q._r[0], q._r[1] + 1), error: null }).then(ok, ko); } };
    return q;
  } };
  const esclusi = new Set(['d1', 'd2', 'd5']);
  const p1 = await paginaDaCatalogare(db, { esclusi, quanti: 4, blocco: 5 });
  assert.deepEqual(p1.documenti.map((d) => d.id), ['d0', 'd3', 'd4', 'd6']);
  assert.equal(p1.finito, false);
  const p2 = await paginaDaCatalogare(db, { esclusi, da: p1.prossimo, quanti: 4, blocco: 5 });
  assert.deepEqual(p2.documenti.map((d) => d.id), ['d7', 'd8', 'd9', 'd10']);
  const p3 = await paginaDaCatalogare(db, { esclusi, da: p2.prossimo, quanti: 4, blocco: 5 });
  assert.deepEqual(p3.documenti.map((d) => d.id), ['d11', 'd12']);
  assert.equal(p3.finito, true);
});
