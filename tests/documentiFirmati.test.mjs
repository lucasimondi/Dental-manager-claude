// DOCUMENTI-FIRMATI e FIRMA-BIRO — PO 2026-11-17: firmare e allegare a una risposta (solo bozza),
// cartella «Documenti firmati» in Poliedron e su Drive, titolo «… firmato» modificabile e suggerito dal
// contenuto, firma come una biro (pressione, sfumature, Bic nera e blu), foglio di salvataggio semplice
// con cartelle nuove create sia in Poliedron sia su Drive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { INCHIOSTRI, larghezzaTratto, opacitaTratto, pressioneUtile, tocchi, granelli, casuale, smorza } from '../personal/src/pdf/biro.js';
import { titoloIniziale, conFirmato } from '../personal/src/pdf/titoloFirmato.js';
import { caricaDocumento, suggerisciTitolo, bozzaConAllegato, daEmail } from '../personal/src/lib/archivio.js';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const migrazione = readFileSync('supabase/archivio/migrations/20261117120000_documenti_firmati.sql', 'utf8');
const firma = readFileSync('personal/src/pdf/Firma.jsx', 'utf8');
const salva = readFileSync('personal/src/pdf/SalvaArchivio.jsx', 'utf8');
const gestore = readFileSync('personal/src/pdf/GestorePdf.jsx', 'utf8');
const documenti = readFileSync('personal/src/sezioni/documenti/Documenti.jsx', 'utf8');
const indice = readFileSync('personal/src/sezioni/documenti/index.jsx', 'utf8');

/* ---------- biro ---------- */

test('biro: piano e premuto → tratto più largo e più scuro; veloce → più sottile e più chiaro', () => {
  assert.ok(larghezzaTratto(0, 0.5) > larghezzaTratto(2.5, 0.5));
  assert.ok(larghezzaTratto(0.5, 1) > larghezzaTratto(0.5, 0.1));
  assert.ok(opacitaTratto(0, 0.5) > opacitaTratto(2.5, 0.5));
  for (const v of [0, 0.3, 1, 3, 50]) for (const p of [0, 0.5, 1]) {
    const w = larghezzaTratto(v, p);
    assert.ok(w >= 1.7 * 0.55 * 0.7 - 1e-9 && w <= 1.7 * 1.3 * 1.35 + 1e-9, `larghezza ${w}`);
    const a = opacitaTratto(v, p);
    assert.ok(a >= 0.35 && a <= 0.97, `opacità ${a}`);
  }
  assert.equal(smorza(null, 2), 2);
  assert.equal(smorza(0, 2, 0.5), 1);
});

test('biro: la pressione conta solo con la penna; col dito resta media', () => {
  assert.equal(pressioneUtile({ pointerType: 'pen', pressure: 0.9 }), 0.9);
  assert.equal(pressioneUtile({ pointerType: 'pen', pressure: 0 }), 0.5);
  assert.equal(pressioneUtile({ pointerType: 'touch', pressure: 1 }), 0.5);
  assert.equal(pressioneUtile({ pointerType: 'mouse', pressure: 0.5 }), 0.5);
});

test('biro: tocchi fitti lungo il tratto, con grana e qualche microvuoto solo dove si va veloce', () => {
  const rnd = casuale(7);
  const lento = tocchi({ x0: 0, y0: 0, w0: 2, a0: 0.95, x1: 10, y1: 0, w1: 2, a1: 0.95 }, rnd);
  assert.ok(lento.length >= 10 / (2 * 0.3) - 1, 'almeno un tocco ogni 0.3 della larghezza');
  assert.ok(lento.every((t) => t.r === 1 && t.a > 0.2 && t.a < 0.95), 'lento: nessun vuoto, tocchi leggeri che sovrapposti fanno il tratto');
  const copertura = (k) => 1 - lento.slice(0, 4).reduce((p, t) => p * (1 - t.a), 1);
  assert.ok(copertura() > 0.75, 'tre-quattro tocchi sovrapposti ≈ inchiostro pieno');
  assert.ok(new Set(lento.map((t) => t.a.toFixed(3))).size > 3, 'opacità non uniforme (grana)');
  const veloce = tocchi({ x0: 0, y0: 0, w0: 1, a0: 0.4, x1: 400, y1: 0, w1: 1, a1: 0.4 }, casuale(3));
  const vuoti = veloce.filter((t) => t.a === 0).length;
  assert.ok(vuoti > 0 && vuoti < veloce.length * 0.3, `veloce: qualche vuoto (${vuoti}/${veloce.length})`);
  assert.deepEqual(tocchi({ x0: 0, y0: 0, w0: 1, a0: 1, x1: 3, y1: 4, w1: 1, a1: 1 }, casuale(1)), tocchi({ x0: 0, y0: 0, w0: 1, a0: 1, x1: 3, y1: 4, w1: 1, a1: 1 }, casuale(1)), 'ripetibile col seme');
});

test('biro: grana della sfera — puntini minuscoli e leggeri nel riquadro del tratto, con un tetto', () => {
  const g = granelli({ x0: 10, y0: 20, x1: 60, y1: 40 }, casuale(5));
  assert.equal(g.length, Math.round(50 * 20 * 0.12));
  assert.ok(g.every((p) => p.x >= 10 && p.x <= 60 && p.y >= 20 && p.y <= 40 && p.r < 0.5 && p.a > 0.1 && p.a < 0.45));
  assert.equal(granelli({ x0: 0, y0: 0, x1: 1000, y1: 1000 }).length, 5000);
  assert.match(firma, /globalCompositeOperation = 'destination-out'/);
});

test('firma: inchiostro Bic nero o blu ricordato, tratto a tocchi, goccia all\'appoggio, data nello stesso colore', () => {
  assert.deepEqual(Object.keys(INCHIOSTRI), ['nero', 'blu']);
  assert.match(firma, /role="radiogroup" aria-label="Colore della biro"/);
  assert.match(firma, /personal-pdf-inchiostro-v1/);
  assert.match(firma, /tocchi\(\{ x0: prima\.x/);
  assert.match(firma, /r: w \* 0\.62/);
  assert.match(firma, /pngTesto\(testoOggi\(\), \{ colore \}\)/);
  assert.match(firma, /onUsa\(await ricolora\(png, colore\)/, 'anche la firma salvata esce nel colore scelto');
  assert.doesNotMatch(firma, /ctx\.stroke\(\)/, 'niente più linea uniforme');
});

/* ---------- foglio di salvataggio ---------- */

test('foglio: titolo «… firmato» modificabile, suggerimento, Documenti firmati predefinita, nuova cartella, altro facoltativo', () => {
  assert.equal(titoloIniziale({ origine: { titolo: 'Contratto luce' }, firmato: true }), 'Contratto luce firmato');
  assert.equal(titoloIniziale({ nomeFile: 'Copia di Modulo.pdf', firmato: false }), 'Modulo');
  assert.equal(titoloIniziale({ origine: { titolo: 'Modulo firmato' }, firmato: true }), 'Modulo firmato');
  assert.equal(titoloIniziale({ nomeFile: '', firmato: true }), 'Documento firmato');
  assert.equal(titoloIniziale({ nomeFile: 'Delega banca - modificato.pdf', firmato: true }), 'Delega banca firmato');
  assert.equal(conFirmato('Delega – Banca X', true), 'Delega – Banca X firmato');
  assert.equal(conFirmato('Delega firmata', true), 'Delega firmata');
  assert.equal(conFirmato('Delega', false), 'Delega');
  assert.match(salva, /useState\(firmato \? FIRMATI : AUTOMATICO\)/);
  assert.match(salva, /<option value=\{FIRMATI\}>Documenti firmati<\/option>/);
  assert.match(salva, /<option value=\{NUOVA\}>\+ Nuova cartella…<\/option>/);
  assert.match(salva, /creaCartella\(archivioDb, \{ nome: nuova\.nome, padre_id: nuova\.padre \|\| null \}\)/);
  assert.match(salva, /Suggerito dal contenuto/);
  assert.match(salva, /Altro \(facoltativo\): categoria, persona, tipo, tag/);
  assert.match(salva, /if \(clinico \|\| !testoPdf\) return undefined;/, 'mai il suggerimento per i pazienti');
  assert.match(salva, /Si crea solo una bozza in Gmail: la invii tu\./);
  assert.match(gestore, /if \(tipo !== 'data'\) firmatoRef\.current = true;/);
  assert.match(gestore, /'Salva firmato nell’archivio'/);
});

test('Documenti: sottosezione «Documenti firmati» a un tocco', () => {
  assert.match(documenti, /ctx\.apri\(\{ tipo: 'firmati' \}\)/);
  assert.match(documenti, /<span>Documenti firmati<\/span>/);
  assert.match(indice, /firmati: \{ titolo: 'Documenti firmati'/);
});

/* ---------- app → script ---------- */

test('app: caricamento con titolo esatto e cartella; titolo suggerito; bozza con allegato; daEmail', async () => {
  const inviati = [];
  const f = (risposta) => async (_u, o) => { inviati.push(JSON.parse(o.body)); return { json: async () => risposta }; };
  await caricaDocumento({ token: 't', dati: 'AA', nome: 'x.pdf', mime: 'application/pdf', titolo: 'Delega firmato', firmati: true }, f({ ok: true, id: 'd1' }));
  assert.equal(inviati[0].titolo, 'Delega firmato');
  assert.equal(inviati[0].firmati, true);
  assert.equal('cartella' in inviati[0], false);
  await caricaDocumento({ token: 't', dati: 'AA', nome: 'x.pdf', mime: 'application/pdf', cartella: 'c-1' }, f({ ok: true, id: 'd2' }));
  assert.equal(inviati[1].cartella, 'c-1');
  assert.equal('firmati' in inviati[1], false);

  assert.equal(await suggerisciTitolo({ token: 't', testo: 'Contratto di fornitura energia elettrica tra le parti', nome: 'x.pdf' }, f({ ok: true, titolo: 'Contratto – Enel – 2026' })), 'Contratto – Enel – 2026');
  assert.equal(inviati[2].azione, 'titolo_suggerito');
  const prima = inviati.length;
  assert.equal(await suggerisciTitolo({ token: 't', testo: 'testo lungo abbastanza per chiedere', clinico: true }, f({ ok: true, titolo: 'X' })), null);
  assert.equal(await suggerisciTitolo({ token: 't', testo: 'corto' }, f({ ok: true, titolo: 'X' })), null);
  assert.equal(inviati.length, prima, 'clinico o testo corto: nessuna chiamata');

  const r = await bozzaConAllegato({ token: 't', documento: 'd1', origine: 'o1', testo: 'Ecco' }, f({ ok: true, risposta: true, link: 'L' }));
  assert.equal(r.link, 'L');
  assert.deepEqual(inviati.at(-1), { token: 't', azione: 'bozza_allegato', documento: 'd1', origine: 'o1', testo: 'Ecco', a: '', oggetto: '' });
  await assert.rejects(bozzaConAllegato({ token: 't', documento: 'd1' }, f({ ok: false, errore: 'Il file supera 24 MB' })), /24 MB/);

  assert.equal(daEmail({ gmail_message_id: '18c2f' }), true);
  for (const id of ['caricato:1', 'drivefile:2', 'drivefoto:3', '', null]) assert.equal(daEmail({ gmail_message_id: id }), false);
});

/* ---------- script ---------- */

function scriptFinto({ cartelle = [], documenti = {}, rispostaAI = 'Contratto – Rossi – via Roma 1', messaggio = null } = {}) {
  const chiamate = [];
  const cartelleDrive = [];
  const bozze = [];
  const inviate = [];
  let ai = 0;
  const cartellaFinta = (id, nome) => ({ getId: () => id, getName: () => nome, isTrashed: () => false,
    createFolder: (n) => { const f = cartellaFinta('drv-' + n, n); cartelleDrive.push({ padre: id, nome: n }); return f; } });
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent, isFinite,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    Utilities: { sleep() {}, formatDate: (d) => d.toISOString().slice(0, 10) },
    DriveApp: {
      getFolderById: (id) => { if (id === 'sparita') throw new Error('not found'); return cartellaFinta(id, id); },
      getFileById: (id) => ({ getSize: () => (id === 'grande' ? 30e6 : 1000), getBlob: () => ({ blob: id }) }),
    },
    GmailApp: {
      createDraft: (a, oggetto, testo, opz) => { bozze.push({ nuova: true, a, oggetto, testo, opz }); return { getMessage: () => ({ getId: () => 'm-nuova' }) }; },
      sendEmail: () => inviate.push(1), getThreadById: () => ({ getMessages: () => (messaggio ? [messaggio] : []) }), getMessageById: () => messaggio,
    },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.logErrore_ = () => {};
  ctx.cartellaRadice_ = () => cartellaFinta('radice', 'Archivio personale');
  ctx.testoAI_ = () => { ai++; return rispostaAI; };
  ctx.sb_ = (percorso, opzioni = {}) => {
    chiamate.push({ percorso, metodo: opzioni.method || 'get', corpo: opzioni.body });
    if (percorso.startsWith('cartelle_mie?select=id&speciale=eq.firmati')) return cartelle.filter((c) => c.speciale === 'firmati');
    if (percorso.startsWith('cartelle_mie?select=id') && opzioni.method === 'post') return [{ id: 'nuova-firmati' }];
    if (percorso.startsWith('cartelle_mie?select=id,nome,padre_id,drive_cartella_id,archiviata_il&id=eq.')) return cartelle.filter((c) => c.id === decodeURIComponent(percorso.split('id=eq.')[1]));
    if (percorso.startsWith('documenti?select=')) { const id = percorso.split('id=eq.')[1]; return documenti[id] ? [documenti[id]] : []; }
    return null;
  };
  return { ctx, chiamate, cartelleDrive, bozze, inviate, ai: () => ai };
}

test('script: «Documenti firmati» esiste o si crea; cartelle gemelle su Drive annidate come in Poliedron', () => {
  const vuoto = scriptFinto();
  assert.equal(vuoto.ctx.cartellaFirmati_(), 'nuova-firmati');
  assert.deepEqual(JSON.parse(JSON.stringify(vuoto.chiamate.at(-1).corpo)), { nome: 'Documenti firmati', speciale: 'firmati' });

  const { ctx, chiamate, cartelleDrive } = scriptFinto({ cartelle: [
    { id: 'casa', nome: 'Casa', padre_id: null, drive_cartella_id: null },
    { id: 'contratti', nome: 'Contratti: luce/gas', padre_id: 'casa', drive_cartella_id: 'sparita' },
  ] });
  const f = ctx.cartellaDriveDi_('contratti');
  assert.equal(f.getName(), 'Contratti- luce-gas');
  assert.deepEqual(cartelleDrive, [{ padre: 'radice', nome: 'Casa' }, { padre: 'drv-Casa', nome: 'Contratti- luce-gas' }]);
  const patch = chiamate.filter((c) => c.metodo === 'patch').map((c) => [c.percorso, c.corpo.drive_cartella_id]);
  assert.deepEqual(patch, [['cartelle_mie?id=eq.casa', 'drv-Casa'], ['cartelle_mie?id=eq.contratti', 'drv-Contratti- luce-gas']]);
  assert.throws(() => ctx.cartellaDriveDi_('inesistente'), /Cartella non trovata/);
});

test('script: titolo suggerito mai da un modello per i pazienti o con poco testo', () => {
  const s = scriptFinto();
  const ok = s.ctx.titoloSuggerito_({ testo: 'Contratto di locazione ad uso abitativo tra Rossi Mario e Luca', nome: 'scan.pdf' });
  assert.equal(ok.titolo, 'Contratto – Rossi – via Roma 1');
  assert.equal(s.ai(), 1);
  for (const req of [
    { testo: 'Consenso informato alle cure odontoiatriche del paziente', nome: 'modulo.pdf' },
    { testo: 'Documento qualsiasi con abbastanza testo da leggere', nome: 'referto_paziente.pdf' },
    { testo: 'Documento qualsiasi con abbastanza testo da leggere', nome: 'x.pdf', clinico: true },
    { testo: 'corto', nome: 'x.pdf' },
  ]) assert.equal(s.ctx.titoloSuggerito_(req).titolo, null);
  assert.equal(s.ai(), 1, 'nessuna altra chiamata al modello');
});

test('script: bozza con allegato — risposta all\'email dell\'originale o nuova; mai inviata; oltre 24 MB no', () => {
  const messaggio = { getFrom: () => 'Ufficio <uff@ente.it>', getSubject: () => 'Modulo da firmare', createDraftReply: (testo, opz) => { messaggio.bozza = { testo, opz }; return { getMessage: () => ({ getId: () => 'm-risp' }) }; } };
  const uuid = (n) => `00000000-0000-4000-8000-00000000000${n}`;
  const documenti = {
    [uuid(1)]: { id: uuid(1), titolo: 'Modulo firmato', drive_file_id: 'f1' },
    [uuid(2)]: { gmail_message_id: '18c', gmail_thread_id: 't1' },
    [uuid(3)]: { gmail_message_id: 'caricato:x', gmail_thread_id: null },
    [uuid(4)]: { id: uuid(4), titolo: 'Grande', drive_file_id: 'grande' },
  };
  const s = scriptFinto({ documenti, messaggio });
  const r = s.ctx.bozzaConAllegato_({ documento: uuid(1), origine: uuid(2), testo: '' });
  assert.equal(r.ok, true); assert.equal(r.risposta, true);
  assert.equal(r.link, 'https://mail.google.com/mail/u/0/#drafts/m-risp');
  assert.match(messaggio.bozza.testo, /in allegato il documento firmato/);
  assert.deepEqual(JSON.parse(JSON.stringify(messaggio.bozza.opz)), { attachments: [{ blob: 'f1' }] });
  const nuova = s.ctx.bozzaConAllegato_({ documento: uuid(1), origine: uuid(3), a: 'x@y.it', testo: 'Ciao' });
  assert.equal(nuova.risposta, false);
  assert.deepEqual(JSON.parse(JSON.stringify(s.bozze.map((b) => [b.a, b.oggetto, b.testo]))), [['x@y.it', 'Modulo firmato', 'Ciao']]);
  assert.match(s.ctx.bozzaConAllegato_({ documento: uuid(4) }).errore, /24 MB/);
  assert.equal(s.ctx.bozzaConAllegato_({ documento: 'non-uuid' }).ok, false);
  assert.equal(s.inviate.length, 0, 'mai inviata');
  assert.doesNotMatch(codice.slice(codice.indexOf('function bozzaConAllegato_'), codice.indexOf('CARICAMENTO DALL\'APP (Poliedron Personal)')), /sendEmail|\.send\(/);
});

test('script: caricamento nella cartella scelta (nome = titolo, file fisso), ordinaDrive_ non lo sposta, azioni nuove', () => {
  assert.match(codice, /const idCartella = req\.firmati \? cartellaFirmati_\(\) : \(UUID_\.test\(String\(req\.cartella \|\| ''\)\) \? String\(req\.cartella\) : null\);/);
  assert.match(codice, /const cartella = idCartella \? cartellaDriveDi_\(idCartella\)/);
  assert.match(codice, /if \(titoloScelto\) analisi\.titolo = titoloScelto;/);
  assert.match(codice, /file\.setName\(idCartella \? pulisciNome_\(analisi\.titolo/);
  assert.match(codice, /body: \{ drive_fissa: true, drive_cartella: 'cartella:' \+ idCartella \}/);
  assert.match(codice, /&drive_fissa=is\.false&gmail_message_id=not\.like\.drivefoto/);
  assert.match(codice, /if \(req\.azione === 'titolo_suggerito'\) return rispostaJson_\(titoloSuggerito_\(req\)\);/);
  assert.match(codice, /if \(req\.azione === 'bozza_allegato'\) return rispostaJson_\(bozzaConAllegato_\(req\)\);/);
  assert.match(codice, /try \{ allineaCartelleDrive_\(\); \} catch \(e\) \{ logErrore_\('cartelle Drive', e\); \}/);
});

test('migrazione: solo aggiunte, cartella speciale unica, file fisso con default false', () => {
  assert.doesNotMatch(migrazione, /\bdrop\s+(table|column|function|view|policy|trigger)\b/i);
  assert.doesNotMatch(migrazione, /\bdelete\s+from\b|\bupdate\s+\w+\s+set\b/i);
  assert.match(migrazione, /add column if not exists drive_cartella_id text/);
  assert.match(migrazione, /check \(speciale is null or speciale in \('firmati'\)\)/);
  assert.match(migrazione, /create unique index if not exists cartelle_mie_speciale_unica on cartelle_mie \(speciale\) where speciale is not null/);
  assert.match(migrazione, /add column if not exists drive_fissa boolean not null default false/);
  assert.match(migrazione, /insert into cartelle_mie \(nome, speciale\)\s+select 'Documenti firmati', 'firmati'\s+where not exists/);
  assert.match(migrazione, /c\.drive_cartella_id, c\.speciale\s+from cartelle_mie c;/);
  assert.match(migrazione, /revoke all on v_cartelle_mie from anon;/);
});
