// DOCUMENTI-DRIVE (PO 2026-11-09): "la sezione documenti in parte personale dove trovo tutti i documenti
// che ci sono su drive … e devo poterli trovare attraverso la barra ricerca".
// Lo script gira in una VM con Supabase e Drive finti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const read = (p) => readFileSync(p, 'utf8');

function scriptFinto({ files = [], presenti = [], pagina = null } = {}) {
  const scritture = [], letture = [], richieste = [], spostati = [], rinominati = [];
  const proprieta = {};
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => proprieta[k] ?? null, setProperty: (k, v) => { proprieta[k] = v; }, deleteProperty: (k) => { delete proprieta[k]; } }) },
    Drive: { Files: {
      list: (o) => { richieste.push(o); return { files, nextPageToken: pagina }; },
      get: (id) => ({ name: id === 'cartellaClinica' ? 'Pazienti cartelle cliniche' : 'Scuola Giulia' }),
    } },
    DriveApp: { getFileById: (id) => ({ moveTo: () => spostati.push(id), setName: (n) => rinominati.push([id, n]), getBlob: () => ({ getBytes: () => [1] }) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  let n = 0;
  ctx.sb_ = (percorso, opzioni = {}) => {
    if (!opzioni.method) { letture.push(percorso); return percorso.startsWith('documenti?select=drive_file_id') ? presenti.map((id) => ({ drive_file_id: id })) : []; }
    scritture.push({ percorso, corpo: JSON.parse(JSON.stringify(opzioni.body)) });
    return percorso === 'rpc/registra_documento' ? { documento_id: `doc${++n}` } : null;
  };
  ctx.logErrore_ = () => {};
  return { ctx, scritture, letture, richieste, proprieta, spostati, rinominati };
}

const f = (id, name, mimeType = 'application/pdf', parent = 'cartella1') => ({ id, name, mimeType, createdTime: '2025-04-01T10:00:00Z', parents: [parent], webViewLink: `https://drive.google.com/file/d/${id}/view` });

test('documenti su Drive: indicizzati con titolo dal nome, da analizzare, senza spostarli né rinominarli', () => {
  const s = scriptFinto({ files: [f('a1', 'Calendario pallavolo Giulia', 'application/vnd.google-apps.document'), f('a2', 'già in archivio.pdf'), f('a3', 'tmp-conversione')], presenti: ['a2'] });
  s.ctx.importaDocumentiDrive_(Date.now() + 10000);
  const q = s.richieste[0].q;
  assert.match(q, /'me' in owners/);
  assert.match(q, /application\/vnd\.google-apps\.document/);
  assert.doesNotMatch(q, /image\//);
  assert.equal(s.letture.filter((l) => l.startsWith('documenti?select=drive_file_id')).length, 1, 'una lettura per pagina');
  const reg = s.scritture.filter((w) => w.percorso === 'rpc/registra_documento');
  assert.equal(reg.length, 1);
  const p = reg[0].corpo.p;
  assert.equal(p.gmail_message_id, 'drivefile:a1');
  assert.equal(p.hash_sha256, 'drivefile:a1');
  assert.equal(p.titolo, 'Calendario pallavolo Giulia');
  assert.equal(p.email_oggetto, 'Scuola Giulia');
  assert.deepEqual(p.tag, ['Drive', 'da analizzare']);
  assert.equal(s.scritture.find((w) => w.percorso === 'documenti?id=eq.doc1').corpo.da_analizzare, true);
  assert.deepEqual(s.spostati, []);
  assert.deepEqual(s.rinominati, []);
  // Pagina finita: il cursore riparte da capo al prossimo giro (nuovi file).
  assert.equal(s.proprieta.DOC_DRIVE_FINO, undefined);
});

test('documenti su Drive: i file riconoscibili come clinici restano fuori', () => {
  const s = scriptFinto({ files: [f('c1', 'referto.pdf', 'application/pdf', 'cartellaClinica')] });
  s.ctx.importaDocumentiDrive_(Date.now() + 10000);
  assert.equal(s.scritture.length, 0);
});

test('documenti su Drive: la pagina successiva resta per il giro dopo', () => {
  const s = scriptFinto({ files: [], pagina: 'tok2' });
  s.ctx.importaDocumentiDrive_(Date.now() + 10000);
  assert.equal(s.proprieta.DOC_DRIVE_PAGINA, 'tok2');
  assert.ok(s.proprieta.DOC_DRIVE_FINO);
});

test('script: i file di Luca da Drive non si spostano, non si rinominano, non sono email', () => {
  assert.match(codice, /gmail_message_id=not\.like\.drivefoto:\*&gmail_message_id=not\.like\.drivefile:\*/);
  assert.match(codice, /if \(!daDrive\) try \{ file\.setName/);
  assert.match(codice, /if \(!caricato && !daDrive\)/);
  assert.match(codice, /importaDocumentiDrive_\(Date\.now\(\) \+ 15000\)/);
  assert.equal((codice.match(/!\/\^\(caricato\|drivefile\|drivefoto\):\/\.test/g) || []).length, 2);
});

test('app: Documenti in Per te, scheda «Da Drive», ricerca anche su oggetto e categoria', async () => {
  const { daDrive, conEmail, cercaArchivio, documentiDaDrive } = await import('../personal/src/lib/archivio.js');
  assert.equal(daDrive({ gmail_message_id: 'drivefile:x' }), true);
  assert.equal(conEmail({ gmail_message_id: 'drivefile:x' }), false);
  assert.equal(conEmail({ gmail_message_id: 'caricato:x' }), false);
  assert.equal(conEmail({ gmail_message_id: '18c0abc' }), true);
  const passi = [];
  const q = new Proxy({}, { get: (_, k) => (k === 'then' ? (ok) => ok({ data: [], error: null }) : (...a) => { passi.push([k, ...a]); return q; }) });
  const db = { from: () => q };
  await cercaArchivio(db, { testo: 'pallavolo' });
  assert.match(passi.find((p) => p[0] === 'or')[1], /email_oggetto\.ilike\.\*pallavolo\*.*categoria\.ilike/);
  passi.length = 0;
  await documentiDaDrive(db);
  assert.deepEqual(passi.find((p) => p[0] === 'like'), ['like', 'gmail_message_id', 'drivefile:%']);
  assert.match(read('personal/src/sezioni/altro/index.jsx'), /\['documenti', 'Documenti', 'documenti', 'alta'/);
  assert.match(read('src/App.jsx'), /id: 'vita-documenti', nome: 'Documenti', icona: 'documenti', taglia: 'alta'.*sectionDestination\('personal', 'documenti'\)/);
  assert.match(read('personal/src/sezioni/documenti/Documenti.jsx'), /\['drive', 'Da Drive'\]/);
});
