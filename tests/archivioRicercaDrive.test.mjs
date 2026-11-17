// RICERCA-DRIVE — PO 2026-11-17: "Gemini funziona bene poliedron no come facciamo ?" → "Ok vai".
// (1) La chat e «Chiedi» cercano anche con la ricerca di Drive nel contenuto dei file (come Gemini),
//     tenendo solo i documenti registrati in archivio e mai i clinici.
// (2) La lettura dei testi non si blocca più su un testo che il database rifiuta (carattere nullo):
//     stessa correzione già pubblicata da un'altra sessione (branch ccr-3c54f7ef-xi3rlw), qui unita.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { cercaNelContenuto } from '../personal/src/lib/archivio.js';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const chiedi = readFileSync('personal/src/sezioni/documenti/Chiedi.jsx', 'utf8');

function scriptFinto({ drive = {}, archivio = [], parole = [], coda = [], testi = {}, rifiutaTesto = null } = {}) {
  const query = [];
  const chiamate = [];
  const scritture = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent, isFinite,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    Utilities: { sleep() {}, formatDate: (d) => d.toISOString().slice(0, 10) },
    Drive: { Files: {
      list: (o) => { query.push(o); return { files: (drive[o.q.includes(' or ') ? 'o' : 'e'] || []).map((id) => ({ id })) }; },
      copy: () => ({ id: 'tmp' }),
    } },
    DocumentApp: { openById: (id) => ({ getBody: () => ({ getText: () => testi[id] ?? '' }) }) },
    DriveApp: { getFileById: () => ({ setTrashed() {}, getBlob: () => ({ getDataAsString: () => '' }) }) },
    GmailApp: { getMessageById: () => ({ getPlainBody: () => '' }) },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.logErrore_ = () => {};
  ctx.sb_ = (percorso, opzioni = {}) => {
    chiamate.push({ percorso, corpo: opzioni.body });
    if (percorso.startsWith('rpc/cerca_archivio_v2')) return parole;
    if (percorso.startsWith('rpc/documenti_senza_testo')) return coda;
    if (percorso.startsWith('documenti_testo?on_conflict')) {
      if (rifiutaTesto && opzioni.body.testo && rifiutaTesto(opzioni.body.testo)) throw new Error('Supabase 400 su documenti_testo: 22P05');
      scritture.push(opzioni.body);
      return null;
    }
    if (percorso.startsWith('documenti?select=')) {
      const ids = decodeURIComponent(percorso.match(/drive_file_id=in\.\(([^)]*)\)/)[1]).split(',');
      return archivio.filter((d) => ids.includes(d.drive_file_id));
    }
    return [];
  };
  return { ctx, query, chiamate, scritture };
}

test('parole per Drive: senza parole vuote né doppioni, al massimo 5, numeri brevi tenuti', () => {
  const { ctx } = scriptFinto();
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.paroleDrive_('Trovami la fattura della caldaia del 2024, fattura n. 15 Enel luce gas acqua'))),
    ['fattura', 'caldaia', '2024', '15', 'Enel']);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.paroleDrive_("dov'è il l'IBAN?"))), ['dov', 'IBAN']);
});

test('ricerca su Drive: prima tutte le parole, poi almeno una; solo file in archivio, mai i clinici, ordine di Drive', () => {
  const { ctx, query, chiamate } = scriptFinto({
    drive: { e: ['f2'], o: ['f2', 'f9', 'f1', 'fp'] },
    archivio: [
      { id: 'a', drive_file_id: 'f1', fascicolo: 'riscaldamento', data_documento: '2024-03-01' },
      { id: 'b', drive_file_id: 'f2', fascicolo: 'utenze', data_documento: '2025-01-10' },
      { id: 'p', drive_file_id: 'fp', fascicolo: 'clinico_pazienti', data_documento: '2025-01-10' },
    ],
  });
  const r = ctx.cercaNelContenuto_('matricola caldaia', {}, 10, 'id,titolo,fascicolo');
  assert.deepEqual(JSON.parse(JSON.stringify(r.map((d) => d.id))), ['b', 'a']);
  assert.deepEqual(query.map((q) => q.q), [
    "(fullText contains 'matricola' and fullText contains 'caldaia') and trashed = false",
    "(fullText contains 'matricola' or fullText contains 'caldaia') and trashed = false",
  ]);
  const lettura = chiamate.find((c) => c.percorso.startsWith('documenti?select='));
  assert.match(lettura.percorso, /^documenti\?select=id,titolo,fascicolo,drive_file_id,data_documento,email_data&fascicolo=neq\.clinico_pazienti&drive_file_id=in\.\(/);
});

test('ricerca su Drive: filtri di fascicolo e periodo; errori di Drive → nessun risultato, la ricerca continua', () => {
  const archivio = [
    { id: 'a', drive_file_id: 'f1', fascicolo: 'utenze', data_documento: '2023-05-01' },
    { id: 'b', drive_file_id: 'f2', fascicolo: 'utenze', data_documento: '2025-05-01' },
  ];
  const { ctx, chiamate } = scriptFinto({ drive: { e: ['f1', 'f2', 'f3', 'f4', 'f5'] }, archivio });
  const r = ctx.cercaNelContenuto_('bolletta', { fascicoli: ['utenze'], da: '2025-01-01' }, 10, 'id,fascicolo,drive_file_id,data_documento,email_data');
  assert.deepEqual(JSON.parse(JSON.stringify(r.map((d) => d.id))), ['b']);
  assert.match(chiamate.at(-1).percorso, /&fascicolo=in\.\(utenze\)$/);
  assert.doesNotMatch(chiamate.at(-1).percorso, /drive_file_id,drive_file_id/);
  const rotto = scriptFinto();
  rotto.ctx.Drive.Files.list = () => { throw new Error('Drive 500'); };
  assert.deepEqual(JSON.parse(JSON.stringify(rotto.ctx.cercaNelContenuto_('bolletta', {}, 10, 'id'))), []);
  assert.equal(scriptFinto().ctx.cercaNelContenuto_('di la', {}, 10, 'id').length, 0, 'senza parole utili Drive non si chiama');
});

test('chat: parole + Drive uniti, i trovati dentro i file segnati nel_testo, mai i clinici', () => {
  const { ctx } = scriptFinto({
    parole: [{ id: 'a', fascicolo: 'utenze', titolo: 'Bolletta gas' }],
    drive: { e: ['f2', 'f1'] },
    archivio: [
      { id: 'a', drive_file_id: 'f1', fascicolo: 'utenze', titolo: 'Bolletta gas' },
      { id: 'b', drive_file_id: 'f2', fascicolo: 'riscaldamento', titolo: 'Libretto caldaia' },
    ],
  });
  const r = ctx.strumentoChat_('cerca_documenti', { testo: 'matricola caldaia' });
  assert.deepEqual(JSON.parse(JSON.stringify(r.documenti.map((d) => [d.id, d.nel_testo ?? false]))), [['a', false], ['b', true]]);
  assert.match(codice, /quelli in cui la ricerca di Drive trova le parole dentro il file \(nel_testo: true\)/);
});

test('lettura dei testi: carattere nullo tolto; testo rifiutato → errore e la coda va avanti', () => {
  const { ctx } = scriptFinto();
  assert.equal(ctx.testoPulito_('Fattura\u0000 n.\u0007 12\n\n  totale \ud800 €'), 'Fattura n. 12\ntotale €');
  const doc = (id) => ({ id, drive_file_id: id, mime_type: 'application/vnd.google-apps.document', nome_file_originale: id, fascicolo: 'utenze', tentativi: 0 });
  const giro = scriptFinto({
    coda: [doc('rotto'), doc('buono')],
    testi: { rotto: 'testo strano', buono: 'Bolletta\u0000 luce' },
    rifiutaTesto: (t) => t === 'testo strano',
  });
  assert.equal(giro.ctx.estraiTesti_(Date.now() + 60000), false);
  assert.deepEqual(giro.scritture.map((s) => [s.documento_id, s.stato, s.testo]), [['rotto', 'errore', null], ['buono', 'letto', 'Bolletta luce']]);
  assert.match(giro.scritture[0].errore, /^Salvataggio: /);
});

test('lettura dei testi: blocchi finché c\'è tempo, ma al massimo un altro minuto (tempo giornaliero degli attivatori)', () => {
  assert.match(codice, /const TESTO_MS = 45 \* 1000;/);
  assert.match(codice, /function bloccoTesti_\(scadenza\)/);
  assert.match(codice, /estraiTesti_\(Math\.min\(Date\.now\(\) \+ 60000, inizio \+ CONFIG\.TEMPO_MAX_MS - 30000\)\)/);
});

test('app: azione «contenuto», esclusi i già mostrati e i clinici; sezione «Trovati dentro i file»', async () => {
  const inviati = [];
  const fetchFinto = async (_url, o) => {
    inviati.push(JSON.parse(o.body));
    return { json: async () => ({ ok: true, documenti: [{ id: 'a', fascicolo: 'utenze' }, { id: 'c', fascicolo: 'riscaldamento' }, { id: 'p', fascicolo: 'clinico_pazienti' }] }) };
  };
  const r = await cercaNelContenuto({ token: 't', testo: ' matricola caldaia ', filtri: { a: '2025-12-31' }, esclusi: ['a'] }, fetchFinto);
  assert.deepEqual(r.map((d) => d.id), ['c']);
  assert.deepEqual(inviati[0], { token: 't', azione: 'contenuto', testo: 'matricola caldaia', filtri: { a: '2025-12-31' } });
  assert.deepEqual(await cercaNelContenuto({ token: null, testo: 'caldaia' }, fetchFinto), []);
  assert.match(codice, /if \(req\.azione === 'contenuto'\) \{/);
  assert.match(codice, /cercaNelContenuto_\(req\.testo, filtri, 20, CAMPI_APP\)/);
  assert.match(chiedi, /intestazione=\{`Trovati dentro i file · \$\{nelTesto\.length\}`\}/);
  assert.match(chiedi, /similiNuovi = simili \? simili\.filter\(\(d\) => !giaNelTesto\.has\(d\.id\)\)/);
});
