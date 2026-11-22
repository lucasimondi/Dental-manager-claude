// PERSONAL-ESPLORA-WIN11 fase 1: logica pura di Esplora file (pallini, destinazioni, Taglia/Incolla, Annulla).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RADICE, DA_CATALOGARE, CATEGORIE, FUORI, nodoCategoria, eVirtuale, disposizione, colonneGriglia, altezzaAlbero,
  sottocartelle, padreDi, percorsoNodo, documentiDaGestire, calcolaPallini, etichettaPallino, testoStato,
  motivoNonValido, destinazioneValida, vociSpostaIn, operazioneSposta, inversa, applica, chiamate, eseguiOperazione,
  taglia, incolla, nomeNuovaCartella, vociMenu, posizioneMenu, tipoFile, paginaDaCatalogare, documentiNelNodo, menuContestuale,
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
  assert.deepEqual(menu.map((v) => [v.nome, v.attiva]), [['Nuova cartella', true], ['Incolla «Contratto»', true], ['Visualizza', true], ['Aggiorna', true], ['Seleziona tutto', true]]);
  assert.equal(vociMenu('vuoto', { nodo: 'casa', appunti: app, opz })[1].attiva, false);
  assert.equal(vociMenu('vuoto', { nodo: DA_CATALOGARE, appunti: app, opz })[0].attiva, false);
});

test('menu Win11: riga rapida, sottomenu, scorciatoie; voci non applicabili disattivate; pazienti non si eliminano', () => {
  const att = (cosa, o) => Object.fromEntries(vociMenu(cosa, o).map((v) => [v.id, v.attiva]));
  const c = att('cartella', { nodo: 'casa' });
  for (const k of ['apri', 'nuova', 'taglia', 'sposta', 'rinomina', 'elimina', 'proprieta', 'zip', 'preferito']) assert.equal(c[k], true, k);
  const r = att('cartella', { nodo: RADICE });
  assert.deepEqual([r.apri, r.nuova, r.taglia, r.sposta, r.rinomina, r.elimina, r.preferito], [true, true, false, false, false, false, true]);
  const v = att('cartella', { nodo: DA_CATALOGARE });
  assert.deepEqual([v.apri, v.nuova, v.taglia, v.rinomina, v.elimina], [true, false, false, false, false]);
  assert.equal(att('file', { clinico: true }).elimina, false);
  const m = menuContestuale('file', { selezione: [{ tipo: 'doc', id: 'd1', da: 'casa' }], ambiente: 'condividi', convertibile: true });
  assert.deepEqual(m.rapide.map((x) => x.nome), ['Taglia', 'Copia', 'Rinomina', 'Condividi', 'Elimina']);
  assert.deepEqual(m.voci.filter((x) => !x.separatore).map((x) => x.nome), ['Apri', 'Apri con', 'Condividi', 'Taglia', 'Copia', 'Duplica in…', 'Rinomina', 'Sposta in…', 'Aggiungi ad Accesso rapido', 'Comprimi in ZIP', 'Scarica', 'Proprietà', 'Elimina']);
  assert.deepEqual(m.voci.find((x) => x.id === 'apri-con').sotto.map((x) => x.nome), ['Anteprima Poliedra', 'Google Drive (visualizzatore)', 'Google Documenti / Fogli', 'Nuova scheda del browser', 'Scarica', 'Altra app… (condividi)']);
  assert.deepEqual(m.voci.find((x) => x.id === 'condividi').sotto.map((x) => x.nome), ['Condivisione di sistema', 'Copia link Drive', 'Email', 'WhatsApp', 'Gestisci accesso Drive']);
  assert.equal(m.voci.find((x) => x.id === 'rinomina').tasto, 'F2');
  assert.equal(m.voci.find((x) => x.id === 'elimina').tasto, 'Canc');
  assert.ok(m.voci.some((x) => x.separatore));
  // più elementi: niente Rinomina, Apri, Proprietà; cartelle: niente Copia
  const piu = menuContestuale('file', { selezione: [{ tipo: 'doc', id: 'a' }, { tipo: 'doc', id: 'b' }] });
  assert.deepEqual(['apri', 'rinomina', 'proprieta'].map((k) => piu.voci.find((x) => x.id === k).attiva), [false, false, false]);
  assert.equal(menuContestuale('cartella', { selezione: [{ tipo: 'cartella', id: 'casa' }] }).rapide.find((x) => x.id === 'copia').attiva, false);
  // Altra app: senza condivisione né Capacitor è disattivata
  assert.equal(menuContestuale('file', { selezione: [{ tipo: 'doc', id: 'd1' }], ambiente: 'scarica' }).voci.find((x) => x.id === 'apri-con').sotto.at(-1).attiva, false);
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

/* ---------- fase 2: Drive allineato subito ---------- */
import {
  chiamateDrive, eseguiCompleto, copia, operazioneAggiungi, leggiViste, salvaVista, vistaDi, righeDettagli, ordinaRighe, ordinaSuColonna,
  tipoLeggibile, dimensioneLeggibile, dataLeggibile, comeAprire, linkDocs, linkDrive, linkEmail, linkWhatsApp, ambienteApertura, seleziona,
  cambiaPreferito, ePreferito, ACCESSO_RAPIDO,
} from '../personal/src/lib/esplora.js';

test('Drive: chiamate per sposta, crea, rinomina; archiviare non tocca Drive', () => {
  const op = operazioneSposta([
    { tipo: 'doc', id: 'd2', da: 'utenze' }, { tipo: 'doc', id: 'd7', da: DA_CATALOGARE },
    { tipo: 'cartella', id: 'luce', da: 'utenze' }, { tipo: 'doc', id: 'd3', da: 'casa' },
  ], 'auto', opz);
  assert.deepEqual(chiamateDrive(op), [
    { azione: 'cartella_drive', id: 'luce' },
    { azione: 'sposta_documenti', ids: ['d2', 'd7', 'd3'], cartella_id: 'auto' },
  ]);
  // Annulla: d7 torna «fuori» → torna all'ordine automatico per Categoria/anno
  assert.deepEqual(chiamateDrive(inversa(op)), [
    { azione: 'cartella_drive', id: 'luce' },
    { azione: 'sposta_documenti', ids: ['d2'], cartella_id: 'utenze' },
    { azione: 'sposta_documenti', ids: ['d3'], cartella_id: 'casa' },
    { azione: 'automatico', ids: ['d7'] },
  ]);
  assert.deepEqual(chiamateDrive(operazioneSposta([{ tipo: 'doc', id: 'd3', da: 'casa' }], RADICE, opz)), [{ azione: 'sposta_documenti', ids: ['d3'], cartella_id: RADICE }]);
  assert.deepEqual(chiamateDrive({ tipo: 'crea', id: 'n', nome: 'N', padre: RADICE }), [{ azione: 'cartella_drive', id: 'n' }]);
  assert.deepEqual(chiamateDrive({ tipo: 'rinomina', cosa: 'cartella', id: 'casa', da: 'A', a: 'B' }), [{ azione: 'cartella_drive', id: 'casa' }]);
  assert.deepEqual(chiamateDrive({ tipo: 'rinomina', cosa: 'doc', id: 'd1', da: 'A', a: 'B' }), []);
  assert.deepEqual(chiamateDrive({ tipo: 'archivia', ids: ['casa'] }), []);
});

const dbFinto = () => {
  const scritture = [];
  const db = { from: (t) => {
    const q = { t, corpo: null, filtri: [], update(c) { q.corpo = c; return q; }, in(k, v) { q.filtri.push(['in', k, v]); return q; }, or(f) { q.filtri.push(['or', f]); return q; },
      then(ok, ko) { scritture.push({ t, corpo: q.corpo, filtri: q.filtri }); return Promise.resolve({ error: null }).then(ok, ko); } };
    return q;
  } };
  return { db, scritture };
};

const api = (rifiuta = null) => {
  const log = [];
  const a = new Proxy({}, { get: (_, fn) => async (...x) => { log.push([fn, ...x.slice(1)]); if (rifiuta === fn) throw new Error('rifiutato'); } });
  return { a, log };
};
const fetchCon = (risposta, inviati = []) => async (url, o) => { const b = JSON.parse(o.body); inviati.push(b); const r = typeof risposta === 'function' ? risposta(b) : risposta; if (r instanceof Error) throw r; return { json: async () => r }; };

test('PR #337: Drive prima del database; l’interfaccia cambia solo per ciò che è riuscito', async () => {
  const op = operazioneSposta([{ tipo: 'doc', id: 'd3', da: 'casa' }, { tipo: 'doc', id: 'd4', da: 'auto' }, { tipo: 'cartella', id: 'auto', da: RADICE }], 'luce', opz);
  const inviati = []; const { a, log } = api();
  const r = await eseguiCompleto(dbFinto().db, op, { token: 't', api: a, fetchImpl: fetchCon((b) => (b.azione === 'sposta_documenti' ? { ok: true, spostati: ['d3'], errori: [{ id: 'd4' }] } : { ok: true }), inviati) });
  assert.equal(r.ok, false);
  assert.deepEqual(r.nonRiusciti, ['d4']);
  assert.match(r.errore, /1 elemento non spostato/);
  assert.deepEqual(r.op.mosse.map((m) => m.id), ['auto', 'd3']);
  // la cartella: database e poi la gemella; i documenti: prima Drive, poi il database solo per d3
  assert.deepEqual(log, [['spostaCartelle', ['auto'], 'luce'], ['spostaDocumenti', ['d3'], 'casa', 'luce']]);
  assert.deepEqual(inviati.map((b) => b.azione), ['cartella_drive', 'sposta_documenti']);
  // Drive giù: niente cambia nel database, la cartella torna indietro
  const giu = api();
  const r2 = await eseguiCompleto(dbFinto().db, op, { token: 't', api: giu.a, fetchImpl: fetchCon(new Error('offline')) });
  assert.equal(r2.ok, false); assert.equal(r2.op, null);
  assert.deepEqual(giu.log, [['spostaCartelle', ['auto'], 'luce'], ['spostaCartelle', ['auto'], null]]);
  // il database rifiuta dopo Drive: i file tornano indietro su Drive
  const rif = api('spostaDocumenti'); const inv3 = [];
  const r3 = await eseguiCompleto(dbFinto().db, { tipo: 'sposta', mosse: [{ tipo: 'doc', id: 'd3', da: 'casa', a: 'luce' }] }, { token: 't', api: rif.a, fetchImpl: fetchCon({ ok: true, spostati: ['d3'], errori: [] }, inv3) });
  assert.equal(r3.ok, false);
  assert.deepEqual(inv3.map((b) => [b.azione, b.cartella_id]), [['sposta_documenti', 'luce'], ['sposta_documenti', 'casa']]);
});

test('PR #337: rinomina documento = prima Drive; cartella nuova creata anche su Drive o archiviata; copia senza Drive', async () => {
  const inviati = []; const { a, log } = api();
  const ok = await eseguiCompleto(dbFinto().db, { tipo: 'rinomina', cosa: 'doc', id: 'd1', da: 'A', a: 'B' }, { token: 't', api: a, fetchImpl: fetchCon({ ok: true, nome: 'B.pdf' }, inviati) });
  assert.equal(ok.ok, true);
  assert.deepEqual(inviati, [{ token: 't', azione: 'rinomina_file', id: 'd1', nome: 'B' }]);
  assert.deepEqual(log, [['aggiornaDocumento', 'd1', { titolo: 'B' }]]);
  const no = api();
  const ko = await eseguiCompleto(dbFinto().db, { tipo: 'rinomina', cosa: 'doc', id: 'd1', da: 'A', a: 'B' }, { token: 't', api: no.a, fetchImpl: fetchCon({ ok: false, errore: 'Drive giù' }) });
  assert.deepEqual([ko.ok, ko.errore, no.log.length], [false, 'Drive giù', 0]);
  const cr = api();
  const nuova = await eseguiCompleto(dbFinto().db, { tipo: 'crea', nome: 'Mutuo', padre: 'casa' }, { token: 't', api: cr.a, creaCartella: async () => ({ id: 'n1', nome: 'Mutuo' }), fetchImpl: fetchCon(new Error('offline')) });
  assert.equal(nuova.ok, false);
  assert.deepEqual(cr.log, [['archiviaCartelle', ['n1'], true]]);
  const cp = api(); const inv = [];
  const opC = incolla(copia([{ tipo: 'doc', id: 'd3', da: 'casa' }, { tipo: 'cartella', id: 'auto' }], 'Contratto'), 'auto', opz);
  assert.deepEqual(opC, { tipo: 'aggiungi', ids: ['d3'], a: 'auto' });
  assert.equal((await eseguiCompleto(dbFinto().db, opC, { token: 't', api: cp.a, fetchImpl: fetchCon({ ok: true }, inv) })).ok, true);
  assert.deepEqual([cp.log, inv], [[['aggiungiDocumenti', 'auto', ['d3']]], []]);
  assert.deepEqual(inversa(opC), { tipo: 'togli', ids: ['d3'], da: 'auto' });
  assert.deepEqual(documentiNelNodo(applica({ cartelle, posizioni }, opC).posizioni, 'auto').sort(), ['d1', 'd3', 'd4']);
  assert.equal(operazioneAggiungi([{ tipo: 'doc', id: 'd1' }], 'auto', opz), null); // c'è già
  assert.equal(operazioneAggiungi([{ tipo: 'doc', id: 'd1' }], DA_CATALOGARE, opz), null);
});

test('viste per cartella (con memoria che può mancare), Dettagli ordinabili con cartelle prima', () => {
  const mem = new Map(); const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(vistaDi(leggiViste(storage), 'casa'), 'grandi');
  salvaVista('casa', 'dettagli', storage); salvaVista('auto', 'elenco', storage);
  assert.deepEqual([vistaDi(leggiViste(storage), 'casa'), vistaDi(leggiViste(storage), 'auto'), vistaDi(leggiViste(storage), 'luce', 'medie')], ['dettagli', 'elenco', 'medie']);
  const rotto = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
  assert.deepEqual(leggiViste(rotto), {}); assert.doesNotThrow(() => salvaVista('x', 'elenco', rotto));
  const righe = righeDettagli([{ id: 'c', nome: 'Zeta', modificato_il: '2026-01-01T00:00:00Z' }], [
    { id: 'a', titolo: 'Bolletta 10', creato_il: '2026-03-01T10:00:00Z', mime_type: 'application/pdf', dimensione_byte: 2048 },
    { id: 'b', titolo: 'Bolletta 9', creato_il: '2026-02-01T10:00:00Z', mime_type: 'image/jpeg', dimensione_byte: 5 * 1024 * 1024 },
  ], { a: 'Bolletta 10' });
  assert.deepEqual(ordinaRighe(righe).map((r) => r.id), ['c', 'b', 'a']); // ordine naturale: 9 prima di 10
  assert.deepEqual(ordinaRighe(righe, { chiave: 'dimensione', verso: 'giu' }).map((r) => r.id), ['c', 'b', 'a']);
  assert.deepEqual(ordinaRighe(righe, { chiave: 'data', verso: 'giu' }).map((r) => r.id), ['c', 'a', 'b']);
  assert.deepEqual(ordinaSuColonna({ chiave: 'nome', verso: 'su' }, 'nome'), { chiave: 'nome', verso: 'giu' });
  assert.deepEqual(ordinaSuColonna({ chiave: 'nome', verso: 'giu' }, 'data'), { chiave: 'data', verso: 'su' });
  assert.deepEqual(righe.map((r) => r.tipo), ['Cartella di file', 'Documento PDF', 'Immagine JPEG']);
  assert.equal(tipoLeggibile({ mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Foglio Excel');
  assert.equal(tipoLeggibile({ nome_file_originale: 'x.dwg' }), 'File DWG');
  assert.deepEqual([dimensioneLeggibile(500), dimensioneLeggibile(2048), dimensioneLeggibile(5.5 * 1024 * 1024), dimensioneLeggibile(null)], ['500 byte', '2 KB', '5,5 MB', '']);
  assert.equal(dataLeggibile('2026-11-21T13:05:00Z'), '21/11/2026 14:05');
});

test('apertura con l’app predefinita, Apri con, Condividi, Altra app', () => {
  assert.deepEqual(comeAprire({ drive_file_id: 'f', mime_type: 'application/pdf' }), { modo: 'anteprima', tipo: 'pdf' });
  assert.deepEqual(comeAprire({ drive_file_id: 'f', mime_type: 'image/png' }), { modo: 'anteprima', tipo: 'immagine' });
  assert.deepEqual(comeAprire({ drive_file_id: 'f', mime_type: 'video/mp4' }), { modo: 'anteprima', tipo: 'video' });
  assert.deepEqual(comeAprire({ drive_file_id: 'f', mime_type: 'audio/mpeg' }), { modo: 'anteprima', tipo: 'audio' });
  assert.deepEqual(comeAprire({ drive_file_id: 'f', mime_type: 'application/msword', drive_url: 'https://drive/x' }), { modo: 'link', url: 'https://drive/x' });
  assert.deepEqual(comeAprire({ drive_file_id: 'f', mime_type: 'application/zip' }), { modo: 'scarica' });
  assert.deepEqual(comeAprire({ mime_type: 'message/rfc822', drive_url: 'https://mail/x' }), { modo: 'link', url: 'https://mail/x' });
  assert.equal(linkDocs({ drive_file_id: 'F1', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'https://docs.google.com/document/d/F1/edit');
  assert.equal(linkDocs({ drive_file_id: 'F1', mime_type: 'application/pdf' }), null);
  assert.equal(linkDrive({ drive_file_id: 'F1' }), 'https://drive.google.com/file/d/F1/view');
  assert.equal(linkEmail('Bolletta luce', 'https://d/x'), 'mailto:?subject=Bolletta%20luce&body=https%3A%2F%2Fd%2Fx');
  assert.equal(linkWhatsApp('IMU', 'https://d/x'), 'https://wa.me/?text=IMU%20https%3A%2F%2Fd%2Fx');
  assert.equal(ambienteApertura({ Capacitor: { isNativePlatform: () => true, Plugins: { FileOpener: {} } }, navigator: { share() {} } }), 'capacitor');
  assert.equal(ambienteApertura({ Capacitor: { isNativePlatform: () => true, Plugins: {} }, navigator: { share() {} } }), 'condividi');
  assert.equal(ambienteApertura({ navigator: {} }), 'scarica');
});

test('selezione: clic semplice, Ctrl, Maiusc, caselle; Accesso rapido', () => {
  const ordine = ['a', 'b', 'c', 'd'];
  let r = seleziona(new Set(), 'b', ordine);
  assert.deepEqual([...r.scelti], ['b']);
  r = seleziona(r.scelti, 'd', ordine, { shift: true, ancora: r.ancora });
  assert.deepEqual([...r.scelti], ['b', 'c', 'd']);
  r = seleziona(r.scelti, 'c', ordine, { ctrl: true, ancora: r.ancora });
  assert.deepEqual([...r.scelti], ['b', 'd']);
  r = seleziona(r.scelti, 'a', ordine, { casella: true });
  assert.deepEqual([...r.scelti].sort(), ['a', 'b', 'd']);
  let pref = cambiaPreferito([], 'cartella', 'casa');
  assert.equal(ePreferito(pref, 'cartella', 'casa'), true);
  pref = cambiaPreferito(pref, 'cartella', 'casa');
  assert.deepEqual(pref, []);
  assert.ok(eVirtuale(ACCESSO_RAPIDO));
});

/* ---------- fase 3: barra e Start ---------- */
import { VOCI_BARRA, voceAttiva, vociAperte, badgeBarra, vociStart, numeroNotifiche, oraData, nomeUtente, consigliati, etichettaNumero, accettaFile } from '../personal/src/lib/barra.js';
import { statoDrive, inizioDrive, fineDrive, attesaDrive, testoStatoDrive } from '../personal/src/lib/statoDrive.js';

test('barra: Start · Cerca · Oggi · Agenda · Esplora file · Assistente · Personale; stesse viste di prima', () => {
  assert.deepEqual(VOCI_BARRA.map((v) => v.nome), ['Start', 'Cerca', 'Oggi', 'Agenda', 'Esplora file', 'Assistente', 'Personale']);
  assert.equal(voceAttiva({ vista: 'agenda', start: 'cerca' }), 'cerca');
  // trascinare un file sulla barra: solo le app che sanno aprirlo
  assert.deepEqual(VOCI_BARRA.filter((v) => accettaFile(v.id)).map((v) => v.id), ['agenda', 'esplora', 'poliedron']);
  assert.deepEqual(VOCI_BARRA.filter((v) => v.vista).map((v) => v.vista), ['oggi', 'agenda', 'poliedron', 'altro']);
  assert.equal(voceAttiva({ vista: 'agenda' }), 'agenda');
  assert.equal(voceAttiva({ vista: 'poliedron' }), 'poliedron');
  assert.equal(voceAttiva({ vista: 'conti' }), 'altro'); // come prima: le altre sezioni accendono Personale
  assert.equal(voceAttiva({ vista: 'agenda', pagine: [{ tipo: 'documento' }, { tipo: 'esplora' }] }), 'esplora');
  assert.equal(voceAttiva({ vista: 'agenda', pagine: [{ tipo: 'esplora' }, { tipo: 'documento' }] }), 'agenda');
  assert.equal(voceAttiva({ vista: 'agenda', start: true }), 'start');
});

test('Start: aggiunte con pallini dai conteggi esistenti, notifiche = Da fare aperti, ora e data, nome, consigliati', () => {
  const v = vociStart({ esplora: 7, dafare: 3, urgenti: 1, documenti: 12 });
  const n = Object.fromEntries(v.map((x) => [x.id, x.n]));
  assert.deepEqual([n.oggi, n.documenti, n.esplora, n.dafare, n.conti], [1, 12, 7, 3, 0]);
  for (const id of ['oggi', 'agenda', 'documenti', 'esplora', 'conti', 'legal', 'pratiche', 'personali', 'diario', 'studio', 'impostazioni']) assert.ok(v.some((x) => x.id === id), id);
  assert.deepEqual(v.find((x) => x.id === 'esplora').azione, { apri: { tipo: 'esplora' } });
  assert.equal(numeroNotifiche({ dafare: 4 }), 4);
  assert.equal(numeroNotifiche({}), 0);
  assert.deepEqual(oraData(new Date('2026-11-21T13:05:00Z')), { ora: '14:05', data: '21/11/2026', breve: '21/11' });
  assert.equal(nomeUtente('luca.simondi@gmail.com'), 'Luca');
  assert.equal(nomeUtente(''), 'Account');
  const c = consigliati([{ id: 'r1', nome: 'scan.pdf', data: 5, tipo: 'application/pdf' }], [{ id: 'd1', titolo: 'Bolletta', creato_il: '2026-11-01T00:00:00Z' }, { id: 'd2', titolo: 'IMU' }], 2);
  assert.deepEqual(c.map((x) => [x.tipo, x.id]), [['recente', 'r1'], ['documento', 'd1']]);
  assert.equal(etichettaNumero(0), null);
  assert.equal(etichettaNumero(150), '99+');
});

test('barra PR #337: trattino 16 px attiva / 6 px aperta non in primo piano, badge, stato di Drive', () => {
  assert.deepEqual([...vociAperte({ vista: 'agenda', pagine: [] })], []);
  assert.deepEqual([...vociAperte({ vista: 'agenda', pagine: [{ tipo: 'esplora' }] })], ['agenda']);
  assert.deepEqual([...vociAperte({ vista: 'agenda', pagine: [{ tipo: 'esplora' }, { tipo: 'documento' }] })], ['esplora']); // il documento è aperto sopra l'agenda: Esplora resta aperto dietro
  assert.deepEqual([...vociAperte({ vista: 'conti', pagine: [{ tipo: 'documento' }] })], []); // Conti accende già «Personale» (attiva)
  assert.deepEqual([badgeBarra('oggi', { urgenti: 2, esplora: 7 }), badgeBarra('esplora', { esplora: 7 }), badgeBarra('agenda', { esplora: 7 })], [2, 7, 0]);
  assert.equal(etichettaNumero(250), '99+');
  assert.equal(statoDrive().stato, 'ok');
  inizioDrive(); assert.equal(statoDrive().stato, 'sync'); assert.equal(testoStatoDrive(), 'Drive: sincronizzo…');
  fineDrive('Drive non ha risposto'); assert.equal(statoDrive().stato, 'errore');
  inizioDrive(); fineDrive(); assert.equal(statoDrive().stato, 'ok');
  attesaDrive(3); assert.equal(statoDrive().stato, 'sync'); assert.match(testoStatoDrive(), /3 file al prossimo giro/);
  attesaDrive(0); assert.equal(testoStatoDrive(), 'Drive sincronizzato');
});
