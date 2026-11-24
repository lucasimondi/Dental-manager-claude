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

/* ---------- §4 apertura diretta e App predefinite ---------- */
import { estensioneDi, comeAprireCon, appAutomatica, cambiaApp, snapDa, vicina, zoom, APP_APERTURA } from '../personal/src/lib/apertura.js';

test('apertura: regola automatica, app predefinita per estensione, mai senza file', () => {
  const pdf = { id: 'a', drive_file_id: 'f1', mime_type: 'application/pdf', nome_file_originale: 'atto.PDF' };
  const docx = { id: 'b', drive_file_id: 'f2', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', nome_file_originale: 'lettera.docx' };
  const zip = { id: 'c', drive_file_id: 'f3', mime_type: 'application/zip', nome_file_originale: 'x.zip' };
  assert.deepEqual([estensioneDi(pdf), estensioneDi(docx), estensioneDi({ mime_type: 'image/jpeg' }), estensioneDi({ nome_file_originale: 'a.JPEG' })], ['pdf', 'docx', 'jpg', 'jpg']);
  assert.deepEqual(comeAprireCon(pdf), { modo: 'anteprima', tipo: 'pdf' });
  assert.equal(comeAprireCon(docx).modo, 'link');
  assert.equal(comeAprireCon(zip).modo, 'scarica');
  assert.deepEqual(comeAprireCon(pdf, { pdf: 'drive' }), { modo: 'link', url: 'https://drive.google.com/file/d/f1/view' });
  assert.deepEqual(comeAprireCon(pdf, { pdf: 'browser' }), { modo: 'browser' });
  assert.match(comeAprireCon(docx, { docx: 'docs' }).url, /^https:\/\/docs\.google\.com\/document\/d\/f2/);
  assert.deepEqual(comeAprireCon(zip, { zip: 'anteprima' }), { modo: 'scheda' }, 'non visualizzabile → scheda del documento');
  assert.deepEqual(comeAprireCon({ id: 'e', mime_type: 'message/rfc822', drive_url: 'https://mail' }, { eml: 'scarica' }), { modo: 'link', url: 'https://mail' }, 'email senza file: resta il link');
  assert.equal(appAutomatica(pdf), 'anteprima'); assert.equal(appAutomatica(docx), 'drive'); assert.equal(appAutomatica(zip), 'scarica');
  assert.deepEqual(cambiaApp({ pdf: 'drive' }, 'pdf', ''), {});
  assert.deepEqual(cambiaApp({}, 'xml', 'browser'), { xml: 'browser' });
  assert.equal(APP_APERTURA.length, 6);
});

test('finestra: snap ai bordi, immagini vicine, zoom 25%–400%', () => {
  assert.equal(snapDa(2, 300, 1440), 'sinistra');
  assert.equal(snapDa(1438, 300, 1440), 'destra');
  assert.equal(snapDa(700, 2, 1440), 'ingrandita');
  assert.equal(snapDa(700, 300, 1440), null);
  const el = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(vicina(el, 'b', 1).id, 'c'); assert.equal(vicina(el, 'a', -1), null); assert.equal(vicina(el, 'x', 1), null);
  assert.equal(zoom(1, 1), 1.25); assert.equal(zoom(0.25, -1), 0.25); assert.equal(zoom(4, 1), 4);
});

/* ---------- §5 Cestino dell'app e coda dei trasferimenti ---------- */
import { conCestino, nelCestino, eZip } from '../personal/src/lib/esplora.js';
import { eseguiInCoda, trasferimenti, annullaTrasferimento, testoAvanzamento, togliFiniti } from '../personal/src/lib/trasferimenti.js';

test('Cestino: etichetta «cestino» aggiunta e tolta senza toccare le altre; ZIP riconosciuti', () => {
  assert.deepEqual(conCestino(['imu'], true), ['imu', 'cestino']);
  assert.deepEqual(conCestino(['imu', 'cestino'], true), ['imu', 'cestino']);
  assert.deepEqual(conCestino(['imu', 'cestino'], false), ['imu']);
  assert.ok(nelCestino({ tag: ['cestino'] })); assert.ok(!nelCestino({ tag: null }));
  assert.ok(eZip({ mime_type: 'application/zip' })); assert.ok(eZip({ nome_file_originale: 'a.ZIP' })); assert.ok(!eZip({ mime_type: 'application/pdf' }));
});

test('trasferimenti: uno alla volta con avanzamento, errori per file, Annulla ferma al prossimo', async () => {
  togliFiniti();
  const r = await eseguiInCoda('Caricamento', [{ name: 'a' }, { name: 'b' }, { name: 'c' }], async (f) => { if (f.name === 'b') throw new Error('troppo grande'); return f.name; });
  assert.deepEqual(r.fatti, ['a', 'c']); assert.deepEqual(r.errori, ['b: troppo grande']);
  const t = trasferimenti().find((x) => x.id === r.id);
  assert.equal(t.stato, 'parziale'); assert.equal(testoAvanzamento(t), 'Completato con 1 errore');
  let id = null;
  const r2 = await eseguiInCoda('Copia', [1, 2, 3, 4], async (x) => { id ??= trasferimenti().at(-1).id; if (x === 2) annullaTrasferimento(id); return x; }, { nomeDi: String });
  assert.deepEqual(r2.fatti, [1, 2]); assert.ok(r2.annullato);
  assert.equal(trasferimenti().find((x) => x.id === r2.id).stato, 'annullato');
  assert.equal(testoAvanzamento({ stato: 'in_corso', fatti: 3, totale: 10, errori: [] }), '3 di 10 · 30%');
});

/* ---------- §7 Start ---------- */
import { normalizzaStart, spostaAggiunta, togliAggiunta, cambiaDock, vociBarra, appTrovate, scadenzeImminenti, voceAttiva as attivaBarra, DOCK_PREDEFINITO } from '../personal/src/lib/barra.js';

test('Start: aggiunte riordinabili, Rimuovi, Aggiungi al dock; dock di sempre come predefinito', () => {
  const v = normalizzaStart();
  assert.deepEqual(v.dock, DOCK_PREDEFINITO);
  assert.ok(v.aggiunte.length > 10 && v.aggiunte.every((x) => x.tipo === 'app'));
  assert.deepEqual(normalizzaStart({ aggiunte: [{ tipo: 'app', id: 'conti' }, { tipo: 'app', id: 'conti' }, { tipo: 'app', id: 'inventata' }, { tipo: 'cartella', id: 'casa' }], dock: ['agenda', 'conti', 'agenda', 'boh'] }),
    { aggiunte: [{ tipo: 'app', id: 'conti' }, { tipo: 'cartella', id: 'casa' }, { tipo: 'app', id: 'scan' }], dock: ['agenda', 'conti', 'scan'], versione: 2 });
  // SCAN-APP: impostazioni già salvate con la versione nuova restano come sono (Scan tolto resta tolto)
  assert.deepEqual(normalizzaStart({ aggiunte: [{ tipo: 'app', id: 'conti' }], dock: ['agenda'], versione: 2 }),
    { aggiunte: [{ tipo: 'app', id: 'conti' }], dock: ['agenda'], versione: 2 });
  // impostazioni di prima: Scan entra una volta, dopo Esplora
  assert.deepEqual(normalizzaStart({ aggiunte: [{ tipo: 'app', id: 'esplora' }, { tipo: 'app', id: 'conti' }], dock: ['oggi', 'esplora', 'altro'] }).dock, ['oggi', 'esplora', 'scan', 'altro']);
  assert.deepEqual(normalizzaStart({ aggiunte: [{ tipo: 'app', id: 'esplora' }, { tipo: 'app', id: 'conti' }], dock: [] }).aggiunte.map((x) => x.id), ['esplora', 'scan', 'conti']);
  assert.deepEqual(vociBarra(['scan'])[2], { id: 'scan', nome: 'Scan', azione: { apri: { tipo: 'scan' } } });
  assert.equal(attivaBarra({ vista: 'agenda', pagine: [{ tipo: 'scan' }, { tipo: 'tessera' }] }), 'scan');
  assert.equal(attivaBarra({ vista: 'agenda', pagine: [{ tipo: 'scan' }], dock: ['agenda'] }), 'agenda', 'Scan tolto dal dock: resta accesa la sezione');
  const l = [{ tipo: 'app', id: 'a' }, { tipo: 'app', id: 'b' }, { tipo: 'app', id: 'c' }];
  assert.deepEqual(spostaAggiunta(l, 0, 2).map((x) => x.id), ['b', 'c', 'a']);
  assert.deepEqual(spostaAggiunta(l, 2, 0).map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(togliAggiunta(l, { tipo: 'app', id: 'b' }).map((x) => x.id), ['a', 'c']);
  assert.deepEqual(cambiaDock(['oggi'], 'conti'), ['oggi', 'conti']);
  assert.deepEqual(cambiaDock(['oggi', 'conti'], 'conti'), ['oggi']);
  assert.deepEqual(vociBarra(['agenda', 'conti']).map((x) => x.nome), ['Start', 'Cerca', 'Agenda', 'Conti']);
  assert.deepEqual(vociBarra(['conti'])[2].azione, { vai: 'conti' });
  assert.equal(attivaBarra({ vista: 'conti', dock: ['conti'] }), 'conti');
  assert.equal(attivaBarra({ vista: 'conti' }), 'altro', 'come prima se non è nel dock');
  assert.deepEqual(appTrovate('cont').map((a) => a.id), ['conti']);
  assert.deepEqual(appTrovate(''), []);
});

test('Start: Consigliati con le scadenze imminenti dal catalogo (scadute prima), mai i pazienti', () => {
  const sc = [
    { id: 1, data: '2026-11-30', descrizione: 'IMU', importo: 100, documento_id: 'd1' },
    { id: 2, data: '2026-11-20', descrizione: 'Bollo', documento_id: 'd2' },
    { id: 3, data: '2027-01-30', descrizione: 'Lontana' },
    { id: 4, data: '2026-11-25', descrizione: 'Paziente', documento: { fascicolo: 'clinico_pazienti' } },
    { id: 5, data: '2026-11-24', descrizione: 'Fatta', completata: true },
  ];
  const r = scadenzeImminenti(sc, '2026-11-22', 14);
  assert.deepEqual(r.map((x) => [x.nome, x.scaduta]), [['Bollo', true], ['IMU', false]]);
  assert.equal(r[1].documento_id, 'd1'); assert.equal(r[1].importo, 100);
});

/* ---------- §8 Centro notifiche: una sola fonte per notifiche e pallini ---------- */
import { notificheDa, raggruppaNotifiche, conteggiCentro, daGestireDa, posticipa, leggiPosticipate, posticipata, nuoveDaAvvisare, calendarioMese, giorniConScadenze, impostaCentro, statoCentro } from '../personal/src/lib/centroNotifiche.js';

test('Centro notifiche: scadenze, pratiche aperte, documenti nuovi; stessi numeri per dock, cartelle e campanella', () => {
  const st = {
    scadenze: [
      { id: 1, data: '2026-11-20', descrizione: 'Bollo auto', importo: 80, documento_id: 'd1', documento: { id: 'd1', titolo: 'Bollo', fascicolo: 'veicoli', tipo_documento: 'avviso', tag: [] } },
      { id: 2, data: '2026-11-30', descrizione: 'IMU', documento_id: 'd2', documento: { id: 'd2', titolo: 'IMU', fascicolo: 'fiscale', tipo_documento: 'avviso', tag: [] } },
      { id: 3, data: '2027-03-01', descrizione: 'Lontana', documento_id: 'd3', documento: { id: 'd3', fascicolo: 'fiscale', tag: [] } },
    ],
    azioni: [{ id: 'd9', fascicolo: 'utenze', azione_richiesta: true }],
    pratiche: [{ id: 'p1', titolo: 'Condominio', stato: 'aperta', urgenza: 'alta', n_documenti: 4 }, { id: 'p2', titolo: 'Tranquilla', stato: 'aperta', urgenza: 'bassa' }],
    nuovi: [{ id: 'n1', titolo: 'Ricevuta', creato_il: '2026-11-21T10:00:00Z', ente: 'Banca' }],
  };
  const n = notificheDa(st, { oggi: '2026-11-22' });
  assert.deepEqual(n.map((x) => x.chiave), ['scadenza:1', 'scadenza:2', 'pratica:p1', 'nuovo:n1']);
  assert.match(n[0].testo, /Scaduta il 20 nov/); assert.ok(n[0].urgente);
  assert.deepEqual(raggruppaNotifiche(n).map((g) => [g.nome, g.voci.length]), [['Scadenze', 2], ['Pratiche aperte', 1], ['Documenti nuovi', 1]]);
  assert.deepEqual(conteggiCentro(st, { oggi: '2026-11-22' }), { notifiche: 4, scadenze: 2, esplora: 3 });
  assert.deepEqual([...daGestireDa(st, '2026-11-22').keys()].sort(), ['d1', 'd2', 'd9']);
  // Posticipa: la notifica sparisce fino al giorno scelto e i numeri scendono insieme
  const m = memoria();
  posticipa('scadenza:2', 3, m, '2026-11-22');
  const post = leggiPosticipate(m);
  assert.ok(posticipata(post, 'scadenza:2', '2026-11-22')); assert.ok(!posticipata(post, 'scadenza:2', '2026-11-25'));
  assert.equal(conteggiCentro(st, { posticipate: post, oggi: '2026-11-22' }).scadenze, 1);
});

test('Centro notifiche: toast solo per le novità (mai la prima volta), calendario del mese da lunedì, giorni con scadenze', () => {
  const n = [{ chiave: 'a' }, { chiave: 'b' }];
  assert.deepEqual(nuoveDaAvvisare(n, null), []);
  assert.deepEqual(nuoveDaAvvisare(n, { chiavi: ['a'] }).map((x) => x.chiave), ['b']);
  const nov = calendarioMese(2026, 10);
  assert.equal(nov[0][0].giorno, '2026-10-26'); // lunedì
  assert.equal(nov[0][6].giorno, '2026-11-01'); // domenica 1
  assert.ok(nov.every((s) => s.length === 7)); assert.equal(nov.at(-1)[0].giorno, '2026-11-30');
  assert.deepEqual([...giorniConScadenze([{ data: '2026-11-24' }, { data: '2026-11-24' }, { data: '2026-11-25', completata: true }])], [['2026-11-24', 2]]);
  impostaCentro({ scadenze: [], azioni: [], pratiche: [], nuovi: [] });
  assert.ok(statoCentro().pronto);
});

/* ---------- §9 regole generali ---------- */
import { finestraVirtuale, indiceConTasto, SOGLIA_VIRTUALE } from '../personal/src/lib/esploraNav.js';

test('virtualizzazione sopra i 200 elementi: solo le righe visibili ± margine, spazi sopra e sotto', () => {
  assert.equal(SOGLIA_VIRTUALE, 200);
  const v = finestraVirtuale({ n: 1000, colonne: 1, altezza: 32, scrollTop: 3200, viewport: 640, inizio: 0, margine: 5 });
  assert.deepEqual(v, { da: 95, a: 125, sopra: 95 * 32, sotto: (1000 - 125) * 32 });
  const g = finestraVirtuale({ n: 301, colonne: 6, altezza: 100, scrollTop: 0, viewport: 500, inizio: 40, margine: 2 });
  assert.equal(g.da, 0); assert.equal(g.a, 6 * 7); assert.equal(g.sopra, 0); assert.equal(g.sotto, (51 - 7) * 100);
  const fine = finestraVirtuale({ n: 250, colonne: 1, altezza: 48, scrollTop: 250 * 48, viewport: 600, margine: 3 });
  assert.equal(fine.a, 250); assert.equal(fine.sotto, 0);
});

test('tastiera: frecce nelle griglie e negli elenchi, Home/Fine, bordi', () => {
  assert.equal(indiceConTasto(-1, 'ArrowDown', { n: 10, colonne: 4 }), 0);
  assert.equal(indiceConTasto(1, 'ArrowRight', { n: 10, colonne: 4 }), 2);
  assert.equal(indiceConTasto(1, 'ArrowDown', { n: 10, colonne: 4 }), 5);
  assert.equal(indiceConTasto(8, 'ArrowDown', { n: 10, colonne: 4 }), 9);
  assert.equal(indiceConTasto(2, 'ArrowUp', { n: 10, colonne: 4 }), 0);
  assert.equal(indiceConTasto(3, 'ArrowRight', { n: 10, colonne: 1 }), 3, 'negli elenchi ← → non spostano');
  assert.equal(indiceConTasto(3, 'Home', { n: 10 }), 0); assert.equal(indiceConTasto(3, 'End', { n: 10 }), 9);
  assert.equal(indiceConTasto(0, 'PageDown', { n: 30, colonne: 1 }), 10);
  assert.equal(indiceConTasto(0, 'ArrowDown', { n: 0 }), -1);
});
