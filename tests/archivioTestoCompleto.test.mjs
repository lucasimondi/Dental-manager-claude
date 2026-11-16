// POL-VITA-034 TESTO-COMPLETO — PO 2026-11-16 ("Trovo ancora che gemini funzioni meglio di poliedron
// in ricerca perché?" → "Sì, parti dal primo e poi fai il secondo"):
// (1) la chat usa la stessa ricerca di «Chiedi» (cerca_archivio_v2), con ritorno a quella di prima;
// (2) il testo completo dei file letto da Drive (OCR) entra nella ricerca; mai i clinici dei pazienti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const sql = readFileSync('supabase/archivio/migrations/20261116120000_pol_vita_034_testo_completo.sql', 'utf8');
const dashboard = readFileSync('poliedron/archivio/index.html', 'utf8');

function scriptFinto({ coda = [], rispostaRicerca, testi = {}, erroreCopia = null } = {}) {
  const chiamate = [];
  const scritture = [];
  const copie = [];
  const cestinati = [];
  const aperti = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent, isFinite,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    MimeType: { GOOGLE_DOCS: 'application/vnd.google-apps.document', GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet' },
    Drive: { Files: { copy: (risorsa, id, opzioni) => {
      if (erroreCopia) throw new Error(erroreCopia);
      copie.push({ risorsa, id, opzioni });
      return { id: 'tmp-' + id };
    } } },
    DocumentApp: { openById: (id) => { aperti.push(id); return { getBody: () => ({ getText: () => testi[id] ?? '' }) }; } },
    DriveApp: { getFileById: (id) => ({ setTrashed: (v) => v && cestinati.push(id), getBlob: () => ({ getDataAsString: () => testi[id] ?? '' }) }) },
    GmailApp: { getMessageById: (id) => ({ getPlainBody: () => `Corpo dell'email ${id}` }) },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.logErrore_ = () => {};
  ctx.sb_ = (percorso, opzioni = {}) => {
    chiamate.push({ percorso, opzioni });
    if (percorso.startsWith('rpc/documenti_senza_testo')) return coda;
    if (percorso.startsWith('rpc/cerca_archivio_v2')) return rispostaRicerca();
    if (percorso.startsWith('rpc/cerca_documenti')) return [{ id: 'vecchio', fascicolo: 'utenze', titolo: 'Dalla ricerca di prima' }];
    if (percorso.startsWith('documenti_testo?on_conflict')) { scritture.push(opzioni.body); return null; }
    if (percorso.startsWith('documenti?select=id,titolo,fascicolo')) return testi.__documento ? [testi.__documento] : [];
    if (percorso.startsWith('documenti_testo?select')) return testi.__riga ? [testi.__riga] : [];
    return [];
  };
  return { ctx, chiamate, scritture, copie, cestinati, aperti };
}

test('chat: cerca con la ricerca di «Chiedi» (fascicolo e periodo come filtri) e toglie i clinici', () => {
  const { ctx, chiamate } = scriptFinto({ rispostaRicerca: () => [
    { id: 'a', fascicolo: 'utenze', titolo: 'Bolletta – Enel – marzo 2025' },
    { id: 'p', fascicolo: 'clinico_pazienti', titolo: 'Referto' },
  ] });
  const r = ctx.strumentoChat_('cerca_documenti', { testo: 'enel luce', fascicolo: 'utenze', da: '2025-01-01', a: 'ieri', limite: 5 });
  const c = chiamate[0];
  assert.match(c.percorso, /^rpc\/cerca_archivio_v2\?select=id,titolo,fascicolo/);
  assert.deepEqual(JSON.parse(JSON.stringify(c.opzioni.body)), { p_testo: 'enel luce', p_filtri: { poco_utili: true, fascicoli: ['utenze'], da: '2025-01-01' }, p_lim: 15 });
  assert.deepEqual(JSON.parse(JSON.stringify(r.documenti.map((d) => d.id))), ['a']);
  assert.equal(r.esclusi_clinici, 1);
});

test('chat: se la ricerca nuova non risponde usa quella di prima', () => {
  const { ctx, chiamate } = scriptFinto({ rispostaRicerca: () => { throw new Error('Supabase 404'); } });
  const r = ctx.strumentoChat_('cerca_documenti', { testo: 'condominio' });
  assert.equal(r.documenti[0].id, 'vecchio');
  assert.deepEqual(chiamate.map((c) => c.percorso.split('?')[0]), ['rpc/cerca_archivio_v2', 'rpc/cerca_documenti']);
});

test('chat: istruzioni e strumenti — poche parole chiave, testo_documento per i dati precisi', () => {
  assert.match(codice, /name: 'testo_documento'/);
  assert.match(codice, /Ogni parola deve comparire: usa 1-3 parole chiave/);
  assert.match(codice, /leggi il documento con testo_documento/);
});

test('testo_documento: mai i clinici; testo lungo → solo i passaggi con le parole (accenti compresi)', () => {
  const clinico = scriptFinto({ testi: { __documento: { id: 'p', fascicolo: 'clinico_pazienti' }, __riga: { stato: 'letto', testo: 'segreto' } } });
  assert.match(clinico.ctx.strumentoChat_('testo_documento', { id: 'p' }).errore, /clinico/);
  assert.equal(clinico.chiamate.some((c) => c.percorso.startsWith('documenti_testo')), false, 'il testo di un clinico non viene nemmeno letto');

  const lungo = 'x'.repeat(9000) + ' La penalità di recesso è pari a 120 euro. ' + 'y'.repeat(9000);
  const { ctx } = scriptFinto({ testi: { __documento: { id: 'd', fascicolo: 'utenze', titolo: 'Contratto' }, __riga: { stato: 'letto', testo: lungo } } });
  const r = ctx.strumentoChat_('testo_documento', { id: 'd', cerca: 'penalita' });
  assert.equal(r.caratteri, lungo.length);
  assert.match(r.testo, /La penalità di recesso è pari a 120 euro/);
  assert.ok(r.testo.length < 1000);
  assert.match(ctx.strumentoChat_('testo_documento', { id: 'd' }).testo, /\[…testo troncato\]$/);
  const inCoda = scriptFinto({ testi: { __documento: { id: 'd', fascicolo: 'utenze' } } });
  assert.match(inCoda.ctx.strumentoChat_('testo_documento', { id: 'd' }).errore, /in coda/);
});

test('lettura dei file: PDF con OCR italiano, copia nel Cestino, corpo dell\'email; clinici mai aperti', () => {
  const { ctx, scritture, copie, cestinati, aperti } = scriptFinto({
    coda: [
      { id: 'd1', drive_file_id: 'f1', mime_type: 'application/pdf', nome_file_originale: 'contratto.pdf', fascicolo: 'utenze', gmail_message_id: 'm1', tentativi: 0 },
      { id: 'd2', drive_file_id: 'f2', mime_type: 'application/pdf', nome_file_originale: 'referto.pdf', fascicolo: 'clinico_pazienti', gmail_message_id: 'm2', tentativi: 0 },
      { id: 'd3', drive_file_id: 'f3', mime_type: 'application/octet-stream', nome_file_originale: 'foto.JPG', fascicolo: 'veicoli', gmail_message_id: 'caricato:x', tentativi: 2 },
      { id: 'd4', drive_file_id: 'f4', mime_type: 'application/zip', nome_file_originale: 'archivio.zip', fascicolo: 'altro', gmail_message_id: 'drivefile:f4', tentativi: 0 },
    ],
    testi: { 'tmp-f1': 'Codice   cliente\n\n  ABC123', 'tmp-f3': 'TARGA AB123CD' },
  });
  assert.equal(ctx.estraiTesti_(Date.now() + 60000), false);
  assert.deepEqual(copie.map((c) => [c.id, c.opzioni.ocrLanguage, c.risorsa.mimeType]), [
    ['f1', 'it', 'application/vnd.google-apps.document'], ['f3', 'it', 'application/vnd.google-apps.document'],
  ]);
  assert.deepEqual(cestinati, ['tmp-f1', 'tmp-f3'], 'solo le copie temporanee vanno nel Cestino');
  assert.ok(!aperti.includes('f2') && !copie.some((c) => c.id === 'f2'), 'il clinico non viene aperto');
  const per = Object.fromEntries(scritture.map((s) => [s.documento_id, s]));
  assert.equal(per.d1.stato, 'letto');
  assert.equal(per.d1.fonte, 'pdf');
  assert.equal(per.d1.testo, "Codice cliente\nABC123\nEmail: Corpo dell'email m1");
  assert.deepEqual([per.d2.stato, per.d2.testo], ['escluso', null]);
  assert.deepEqual([per.d3.stato, per.d3.fonte, per.d3.testo, per.d3.tentativi], ['letto', 'immagine', 'TARGA AB123CD', 3], 'file caricati: niente email');
  assert.deepEqual([per.d4.stato, per.d4.testo], ['non_leggibile', null]);
});

test('lettura dei file: quote di Google → si ferma senza scrivere; altri errori → stato errore', () => {
  const coda = [{ id: 'd1', drive_file_id: 'f1', mime_type: 'application/pdf', nome_file_originale: 'a.pdf', fascicolo: 'utenze', gmail_message_id: 'drivefile:f1', tentativi: 0 }];
  const quota = scriptFinto({ coda, erroreCopia: 'User rate limit exceeded' });
  assert.equal(quota.ctx.estraiTesti_(Date.now() + 60000), true);
  assert.equal(quota.scritture.length, 0);
  const rotto = scriptFinto({ coda, erroreCopia: 'File not found: f1' });
  rotto.ctx.estraiTesti_(Date.now() + 60000);
  assert.deepEqual([rotto.scritture[0].stato, rotto.scritture[0].errore], ['errore', 'File not found: f1']);
});

test('lettura dei file: un po\' a ogni giro di elabora, e a mano con leggiTestiOra', () => {
  assert.match(codice, /try \{ estraiTesti_\(Date\.now\(\) \+ TESTO_MS\); \} catch \(e\) \{ logErrore_\('testo completo', e\); \}/);
  assert.match(codice, /function leggiTestiOra\(\)/);
  assert.match(codice, /ocrLanguage: 'it'/);
});

test('migrazione: solo aggiunte, RLS, clinici senza testo, coda solo per lo script', () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|function|view|policy|trigger)\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
  assert.match(sql, /create table if not exists documenti_testo/);
  assert.match(sql, /references documenti\(id\) on delete cascade/);
  assert.match(sql, /alter table documenti_testo enable row level security/);
  assert.match(sql, /create policy proprietario_legge on documenti_testo for select to authenticated using \(\(select e_proprietario\(\)\)\)/);
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger on documenti_testo from authenticated/);
  assert.match(sql, /revoke all on documenti_testo from anon/);
  // Mai testo per i clinici: rifiutato all'inserimento e tolto se il documento diventa clinico.
  assert.match(sql, /d\.fascicolo = 'clinico_pazienti'\) then\s+new\.stato := 'escluso';\s+new\.testo := null;/);
  assert.match(sql, /after insert or update of fascicolo on documenti\s+for each row when \(new\.fascicolo = 'clinico_pazienti'\)/);
  assert.match(sql, /revoke all on function documenti_senza_testo\(integer\) from public, anon, authenticated;\s+grant execute on function documenti_senza_testo\(integer\) to service_role;/);
  // La ricerca guarda anche il testo, mai dei clinici, ed è sempre security invoker senza anon.
  assert.match(sql, /from documenti_testo t join documenti d on d\.id = t\.documento_id\s+where t\.ricerca @@ %L::tsquery and d\.fascicolo <> %L', v_tsq, 'clinico_pazienti'/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /revoke all on function cerca_archivio_v2\(text, jsonb, integer\) from public, anon;/);
});

test('dashboard: ricerca nuova con ritorno a quella di prima', () => {
  assert.match(dashboard, /sb\.rpc\('cerca_archivio_v2', \{ p_testo: st\.q, p_filtri: \{ poco_utili: true \}, p_lim: 100 \}\)/);
  assert.match(dashboard, /if \(error\) \(\{ data, error \} = await sb\.rpc\('cerca_documenti'/);
});
