// POL-VITA-007 — Documenti (ricerca, filtri, azioni di massa) e Agenda fedele a Poliedra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cercaArchivio, aggiornaDocumenti, eliminaDocumenti, aggiornaDocumento } from '../personal/src/lib/archivio.js';
import { layoutOverlap, etichettaMese, inizioSettimana } from '../personal/src/lib/agenda.js';

function clientFinto(dati = []) {
  const chiamate = [];
  const db = {
    chiamate,
    from(tabella) { return catena({ tabella, passi: [] }); },
    rpc(nome, arg) { const q = { tabella: `rpc:${nome}`, passi: [['rpc', arg]] }; chiamate.push(q); return Promise.resolve({ data: { eliminato: true }, error: null }); },
  };
  function catena(q) {
    chiamate.push(q);
    const c = new Proxy({}, { get(_t, m) {
      if (m === 'then') return (ok) => Promise.resolve({ data: dati, error: null }).then(ok);
      return (...a) => { q.passi.push([m, ...a]); return c; };
    } });
    return c;
  }
  return db;
}
const passi = (db, nome) => db.chiamate[0].passi.filter(([p]) => p === nome).map(([, ...a]) => a);

test('ricerca: ogni parola cercata in titolo, ente, riassunto, tipo, mittente, file e persona', async () => {
  const db = clientFinto();
  await cercaArchivio(db, { testo: 'enel  2024' });
  const or = passi(db, 'or').map(([f]) => f);
  assert.equal(or.length, 3, 'due parole + filtro dei poco utili');
  assert.match(or[0], /^titolo\.ilike\.\*enel\*,ente\.ilike\.\*enel\*,riassunto\.ilike\.\*enel\*,tipo_documento/);
  assert.match(or[1], /\*2024\*/);
  assert.equal(or[2], 'rilevanza.is.null,rilevanza.neq.bassa');
});

test('ricerca: caratteri che romperebbero il filtro vengono tolti; parole di una lettera ignorate', async () => {
  const db = clientFinto();
  await cercaArchivio(db, { testo: 'a (rossi),"x" *' });
  const or = passi(db, 'or').map(([f]) => f);
  assert.equal(or.length, 2, 'una sola parola valida + filtro dei poco utili');
  assert.match(or[0], /^titolo\.ilike\.\*rossi\*,/);
  assert.doesNotMatch(or[0], /["()]/);
});

test('ricerca: filtri per categoria, ente, anno, persona; con categoria o ente si vede tutto', async () => {
  const db = clientFinto();
  await cercaArchivio(db, { fascicolo: 'utenze', ente: 'Enel Energia', anno: '2024', persona: 'Luca Simondi' });
  assert.deepEqual(passi(db, 'eq'), [['fascicolo', 'utenze'], ['ente', 'Enel Energia'], ['persona', 'Luca Simondi']]);
  const or = passi(db, 'or').map(([f]) => f);
  assert.deepEqual(or, ['and(data_documento.gte.2024-01-01,data_documento.lte.2024-12-31),and(data_documento.is.null,email_data.gte.2024-01-01,email_data.lt.2025-01-01)']);
  const db2 = clientFinto();
  await cercaArchivio(db2, { anchePocoUtili: true });
  assert.equal(passi(db2, 'or').length, 0);
});

test('azioni di massa: una sola modifica per tutti, solo i campi ammessi e puliti', async () => {
  const db = clientFinto();
  await aggiornaDocumenti(db, ['a', 'b'], { fascicolo: 'fiscale', rilevanza: 'bassa', hash_sha256: 'x', titolo: 'no' });
  assert.deepEqual(passi(db, 'update'), [[{ fascicolo: 'fiscale', rilevanza: 'bassa' }]]);
  assert.deepEqual(passi(db, 'in'), [['id', ['a', 'b']]]);
  const db2 = clientFinto();
  await aggiornaDocumenti(db2, ['a'], { rilevanza: 'inventata', ente: '  Enel  ' });
  assert.deepEqual(passi(db2, 'update'), [[{ rilevanza: null, ente: 'Enel' }]]);
  assert.deepEqual(await aggiornaDocumenti(clientFinto(), [], { fascicolo: 'x' }), []);
});

test('documento singolo: titolo, ente e importanza modificabili', async () => {
  const db = clientFinto({});
  await aggiornaDocumento(db, 'd1', { titolo: '  Fattura – Enel  ', ente: '', rilevanza: 'alta' });
  assert.deepEqual(passi(db, 'update'), [[{ titolo: 'Fattura – Enel', ente: null, rilevanza: 'alta' }]]);
});

test('eliminazione di più documenti: uno alla volta con la stessa funzione del singolo, con avanzamento', async () => {
  const db = clientFinto();
  const visti = [];
  const n = await eliminaDocumenti(db, ['a', 'b', 'c'], (fatti, totale) => visti.push(`${fatti}/${totale}`));
  assert.equal(n, 3);
  assert.deepEqual(db.chiamate.map((c) => c.passi[0]), [['rpc', { p_id: 'a' }], ['rpc', { p_id: 'b' }], ['rpc', { p_id: 'c' }]]);
  assert.deepEqual(visti, ['1/3', '2/3', '3/3']);
});

test('app: selezione multipla con conferma prima di eliminare; i file su Drive restano', () => {
  const src = readFileSync('personal/src/Documenti.jsx', 'utf8');
  const ui = readFileSync('personal/src/ui.jsx', 'utf8');
  assert.match(src, /<ConfermaElimina n=\{ids\.length\}/);
  assert.match(ui, /useState\(false\);\n {2}const cosa/, 'la casella di Drive parte spenta');
  assert.match(ui, /I file restano nel tuo Google Drive/);
  assert.match(ui, /Cestino di Drive: recuperabili per 30 giorni/);
  assert.ok(src.indexOf('cestinaSuDrive(') < src.indexOf('await eliminaDocumenti('), 'prima Drive, poi l\'archivio');
  assert.match(src, /setTimeout\(\(\) => \{ lungo\.current = true; onLungo\(\)/, 'tieni premuto per selezionare');
  assert.match(src, /f\.codice !== 'clinico_pazienti'/, 'non si spostano documenti nel clinico dall\'app');
});

test('migrazione 007: solo aggiunte, vecchio titolo e fascicolo conservati, enti senza pazienti', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261016120000_pol_vita_007_catalogazione.sql', 'utf8');
  assert.doesNotMatch(sql, /\b(drop|delete\s+from|truncate\s+table)\b/i);
  for (const c of ['rilevanza', 'ente', 'riordinato_il', 'titolo_originale', 'fascicolo_originale']) assert.match(sql, new RegExp(`add column if not exists ${c}\\b`));
  assert.match(sql, /on conflict \(codice\) do nothing/);
  assert.match(sql, /d\.fascicolo <> 'clinico_pazienti'/);
  assert.match(sql, /security_invoker = true/);
  assert.match(sql, /revoke all on v_enti from anon/);
});

test('agenda: colonne per gli appuntamenti sovrapposti, come nello studio', () => {
  const r = layoutOverlap([{ id: 1, start: 540, end: 600 }, { id: 2, start: 570, end: 600 }, { id: 3, start: 600, end: 630 }]);
  assert.deepEqual(r.map((x) => [x.id, x.col, x.totalCols]), [[1, 0, 2], [2, 1, 2], [3, 0, 1]]);
});

test('agenda: etichetta del mese anche a cavallo di mesi e anni; settimana da lunedì', () => {
  assert.equal(etichettaMese('2026-10-12'), 'Ottobre 2026');
  assert.equal(etichettaMese('2026-09-28'), 'Set – Ott 2026');
  assert.equal(etichettaMese('2026-12-28'), 'Dic 2026 – Gen 2027');
  assert.equal(inizioSettimana('2026-10-18'), '2026-10-12');
});

test('agenda: Giorno e Settimana come Poliedra (colonna ore 34, 8–20 a mezz\'ore, impegni tratteggiati)', () => {
  const src = readFileSync('personal/src/AgendaGriglia.jsx', 'utf8');
  const css = readFileSync('personal/src/personal.css', 'utf8');
  assert.match(src, /const ORA_COL = 34/);
  assert.match(src, /const SLOT_MIN = 30/);
  assert.match(src, /Math\.min\(8,/);
  assert.match(src, /Math\.max\(20,/);
  assert.match(src, /\{a\.cognome \|\| a\.paziente \|\| '—'\}/);
  assert.match(css, /\.ag-impegno \{[^}]*dashed/);
  assert.match(readFileSync('personal/src/Agenda.jsx', 'utf8'), /useState\('settimana'\)/);
});

test('Drive: file nel Cestino a blocchi di 50, solo su scelta; errore → nessun documento eliminato', async () => {
  const { cestinaSuDrive } = await import('../personal/src/lib/archivio.js');
  const corpi = [];
  const fetchFinto = async (_u, o) => { const b = JSON.parse(o.body); corpi.push(b); return { json: async () => ({ ok: true, cestinati: b.ids, non_trovati: [] }) }; };
  const ids = Array.from({ length: 60 }, (_, i) => `file${String(i).padStart(8, '0')}`);
  const r = await cestinaSuDrive({ token: 'jwt', ids: [...ids, null, ids[0]] }, fetchFinto);
  assert.equal(corpi.length, 2);
  assert.equal(corpi[0].azione, 'cestina');
  assert.equal(corpi[0].ids.length, 50);
  assert.equal(r.cestinati.length, 60);
  assert.deepEqual(await cestinaSuDrive({ token: 'jwt', ids: [] }, fetchFinto), { cestinati: [], non_trovati: [] });
  await assert.rejects(cestinaSuDrive({ token: 'jwt', ids: ['x1234567890'] }, async () => ({ json: async () => ({ ok: false, errore: 'Accesso non autorizzato' }) })), /Accesso non autorizzato/);
});

test('script: cestina solo file registrati in archivio, dopo la verifica del proprietario, mai cancellazione definitiva', () => {
  const codeGs = readFileSync('poliedron/archivio/Code.gs', 'utf8');
  const doPost = codeGs.slice(codeGs.indexOf('function doPost('), codeGs.indexOf('function fileDelDocumento_('));
  assert.ok(doPost.indexOf("req.azione === 'cestina'") > doPost.indexOf('PROPRIETARIO || !utente.email_confirmed_at'));
  const fn = codeGs.slice(codeGs.indexOf('function cestinaFile_('), codeGs.indexOf('CATALOGO MIGLIORE'));
  assert.match(fn, /drive_file_id=in\./);
  assert.match(fn, /registrati\.indexOf\(id\) < 0/);
  assert.match(fn, /setTrashed\(true\)/);
  assert.doesNotMatch(fn, /Drive\.Files\.remove|\.remove\(|delete/i);
  assert.match(readFileSync('poliedron/archivio/CLAUDE.md', 'utf8'), /Eccezione decisa da Luca il 2026-10-16/);
});
