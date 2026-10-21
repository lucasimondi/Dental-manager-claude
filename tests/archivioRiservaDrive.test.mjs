// POL-VITA-013 — importazione senza Claude (catalogo provvisorio) e cartelle di Drive per categoria e
// persona: lo script gira davvero in una VM con Supabase, Drive e Claude finti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const sql = readFileSync('supabase/archivio/migrations/20261017120000_pol_vita_013_riserva_e_drive.sql', 'utf8');

function scriptFinto({ documenti = [], impostazioni = null, pausa = false, fileMancanti = [] } = {}) {
  const scritture = [];
  const alModello = [];
  const spostati = [];
  const proprieta = { API_PAUSA_FINO: pausa ? String(Date.now() + 3600e3) : null };
  const cartella = (nome, padre) => ({ nome, padre, getId: () => (padre ? padre.getId() + '/' : '') + nome });
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => proprieta[k] ?? null, setProperty: (k, v) => { proprieta[k] = v; } }) },
    Utilities: { formatDate: (d, _f, formato) => formato === 'yyyy-MM-dd' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 4) },
    DriveApp: {
      getFileById: (id) => {
        if (fileMancanti.includes(id)) throw new Error('File non trovato');
        return { moveTo: (c) => spostati.push([id, c.getId()]), getBlob: () => ({ getBytes: () => [1, 2, 3] }), setName() {} };
      },
    },
    GmailApp: { getMessageById: () => ({ getPlainBody: () => 'Testo email' }) },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.cartellaRadice_ = () => cartella('Archivio personale');
  ctx.sottocartella_ = (padre, nome) => cartella(nome, padre);
  ctx.sb_ = (percorso, opzioni = {}) => {
    if (!opzioni.method || opzioni.method === 'get') {
      if (percorso.startsWith('impostazioni_app')) return impostazioni ? [{ valore: impostazioni }] : [];
      if (percorso.startsWith('documenti?select=')) {
        const offset = Number((percorso.match(/&offset=(\d+)/) || [])[1] || 0);
        return documenti.slice(offset);
      }
      if (percorso.startsWith('pratiche')) return [];
      return [];
    }
    scritture.push({ percorso, metodo: opzioni.method, corpo: opzioni.body });
    return percorso.startsWith('rpc/completa_analisi') ? { ok: true, fascicolo: opzioni.body.p.fascicolo } : null;
  };
  ctx.claude_ = (system, contenuto) => {
    alModello.push(contenuto.map((b) => b.text || b.type).join('\n'));
    return JSON.stringify({ fascicolo: 'utenze', tipo_documento: 'fattura', titolo: 'Fattura – Enel Energia – marzo 2018', riassunto: 'Bolletta luce.',
      data_documento: '2018-03-02', importo: 84.3, soggetti: [], scadenze: [], azione_richiesta: false, azione_descrizione: null,
      urgenza: 'bassa', pratica: { id_esistente: null, nuova_titolo: null }, tag: ['luce'], dati: [], ente: 'Enel Energia', rilevanza: 'normale' });
  };
  ctx.logErrore_ = () => {};
  return { ctx, scritture, alModello, spostati };
}

const plain = (x) => JSON.parse(JSON.stringify(x));
const meta = (oggetto, mittente = 'Enel Energia <noreply@enel.it>') => ({ oggetto, mittente, destinatari: '', data: new Date('2018-03-05T10:00:00Z') });

test('riserva: categoria, tipo, ente e titolo dalle regole, senza nessuna chiamata a Claude', () => {
  const { ctx, alModello } = scriptFinto({ pausa: true });
  const a = ctx.analisiDiRiserva_(meta('R: Bolletta luce marzo 2018'), 'fattura_123.pdf', 'application/pdf');
  assert.equal(a.riserva, true);
  assert.equal(a.fascicolo, 'utenze');
  assert.equal(a.tipo_documento, 'fattura');
  assert.equal(a.ente, 'Enel Energia');
  assert.equal(a.titolo, 'Fattura – Enel Energia – Bolletta luce marzo 2018');
  assert.deepEqual(plain(a.tag), ['da analizzare']);
  assert.equal(alModello.length, 0);
});

test('riserva: priorità delle regole, foto, pubblicità, ente dal dominio, caricati da Luca', () => {
  const { ctx } = scriptFinto({ pausa: true });
  const f = (o, n = 'doc.pdf', mime = 'application/pdf', m) => ctx.analisiDiRiserva_(meta(o, m), n, mime);
  assert.equal(f('Rinnovo carta d\'identità').fascicolo, 'identita');
  assert.equal(f('Modello F24 acconto IRPEF').fascicolo, 'fiscale');
  assert.equal(f('Consegna pellet 70 sacchi').fascicolo, 'riscaldamento');
  assert.equal(f('Estratto conto dicembre', 'ec.pdf', 'application/pdf', 'info@intesasanpaolo.com').ente, 'intesasanpaolo.com');
  assert.equal(f('Newsletter: offerte di primavera').rilevanza, 'bassa');
  assert.equal(f('', 'IMG_2041.jpg', 'image/jpeg').fascicolo, 'foto_video');
  assert.equal(f('Pratica in corso', 'x.pdf', 'application/pdf', 'Mario Bianchi <mario@example.it>').fascicolo, 'altro', '"in corso" non è un corso di formazione');
  assert.equal(f('Fattura n. 12', 'f.pdf', 'application/pdf', 'Enel Energia <noreply@enel.it>').fascicolo, 'utenze', 'il mittente decide se oggetto e file non bastano');
  assert.equal(f('Scansione', 'x.pdf', 'application/pdf', 'luca.simondi@gmail.com').ente, null);
});

test('Drive: cartella dell’app e anno per tutti i documenti personali; clinici separati', () => {
  const { ctx } = scriptFinto();
  const persone = ['Luca Simondi', 'Giulia Simondi'];
  assert.equal(ctx.percorsoDrive_({ fascicolo: 'identita', persona: 'Giulia Simondi', email_data: '2019-01-01T00:00:00Z' }, persone), 'Cartelle/Senza%20cartella/2019');
  assert.equal(ctx.percorsoDrive_({ fascicolo: 'identita', persona: 'Mario Rossi', data_documento: '2012-02-01' }, persone), 'Cartelle/Senza%20cartella/2012');
  assert.equal(ctx.percorsoDrive_({ fascicolo: 'utenze', data_documento: null, email_data: '2018-03-05T10:00:00Z' }, persone), 'Cartelle/Senza%20cartella/2018');
  assert.equal(ctx.percorsoDrive_({ fascicolo: 'clinico_pazienti', persona: 'Luca Simondi', email_data: '2020-05-01' }, persone), 'Clinico pazienti/2020', 'i clinici restano nel clinico');
  assert.equal(ctx.percorsoDrive_({ fascicolo: 'boh', email_data: null }, persone), 'Cartelle/Senza%20cartella/Senza data');
});

test('Drive: sposta solo i file fuori posto, segna la cartella; file sparito segnato e non ritentato', () => {
  const documenti = [
    { id: 'a', drive_file_id: 'fileAAAAAAAA', fascicolo: 'utenze', data_documento: '2018-03-02', drive_cartella: null },
    { id: 'b', drive_file_id: 'fileBBBBBBBB', fascicolo: 'utenze', data_documento: '2018-03-02', drive_cartella: 'Cartelle/Senza%20cartella/2018' },
    { id: 'c', drive_file_id: 'fileCCCCCCCC', fascicolo: 'identita', persona: 'Martina Simondi', drive_cartella: 'Identità/2019' },
    { id: 'd', drive_file_id: 'fileDDDDDDDD', fascicolo: 'fiscale', data_documento: '2015-06-01', drive_cartella: null },
    { id: 'e', drive_file_id: 'fileEEEEEEEE', fascicolo: 'fiscale', data_documento: '2015-06-01', drive_cartella: '!Cartelle/Senza%20cartella/2015' },
  ];
  const { ctx, scritture, spostati } = scriptFinto({ documenti, impostazioni: { persone: ['Martina Simondi'] }, fileMancanti: ['fileDDDDDDDD'] });
  assert.equal(ctx.ordinaDrive_(Date.now() + 60e3), false);
  assert.deepEqual(spostati, [
    ['fileAAAAAAAA', 'Archivio personale/Cartelle/Senza cartella/2018'],
    ['fileCCCCCCCC', 'Archivio personale/Cartelle/Senza cartella/Senza data'],
  ]);
  assert.deepEqual(scritture.map((s) => [s.percorso, s.corpo.drive_cartella]), [
    ['documenti?id=eq.a', 'Cartelle/Senza%20cartella/2018'],
    ['documenti?id=eq.c', 'Cartelle/Senza%20cartella/Senza data'],
    ['documenti?id=eq.d', '!Cartelle/Senza%20cartella/2015'],
  ]);
  assert.ok(scritture.every((s) => s.metodo === 'patch'), 'si sposta e si annota, nulla si cancella');
});

test('analisi dei rimasti: i clinici non vanno mai al modello; gli altri completati con completa_analisi', () => {
  const documenti = [
    { id: 'x1', fascicolo: 'altro', email_oggetto: 'Referto OPT paziente', email_mittente: 'studio', nome_file_originale: 'opt.pdf', mime_type: 'application/pdf', drive_file_id: 'fileX1xxxxxx', gmail_message_id: 'm1', email_data: '2018-03-05T10:00:00Z' },
    { id: 'x2', fascicolo: 'utenze', email_oggetto: 'Bolletta', email_mittente: 'Enel', nome_file_originale: 'f.txt', mime_type: 'text/plain', drive_file_id: 'fileX2xxxxxx', gmail_message_id: 'm2', email_data: '2018-03-05T10:00:00Z' },
    { id: 'x3', fascicolo: 'identita', email_oggetto: 'CI', email_mittente: 'Caricato dall\'app', nome_file_originale: 'ci.txt', mime_type: 'text/plain', drive_file_id: 'fileX3xxxxxx', gmail_message_id: 'caricato:1', email_data: '2018-03-05T10:00:00Z' },
  ];
  const { ctx, scritture, alModello } = scriptFinto({ documenti });
  ctx.Utilities.newBlob = (b) => ({ getDataAsString: () => 'Testo della bolletta' });
  assert.equal(ctx.analizzaRimasti_(Date.now() + 60e3), true);
  assert.equal(alModello.length, 2);
  assert.doesNotMatch(alModello.join('\n'), /Referto|opt\.pdf/);
  const x1 = scritture.find((s) => s.percorso === 'documenti?id=eq.x1').corpo;
  assert.deepEqual(plain(x1), { fascicolo: 'clinico_pazienti', rilevanza: 'alta', da_analizzare: false, riassunto: 'Documento clinico: archiviato senza analisi del contenuto.' });
  const rpc = scritture.filter((s) => s.percorso === 'rpc/completa_analisi').map((s) => s.corpo);
  assert.deepEqual(rpc.map((c) => [c.p_id, c.p.mantieni_fascicolo]), [['x2', false], ['x3', true]], 'i caricati da Luca tengono il fascicolo');
  assert.equal(rpc[0].p.importo, 84.3);
});

test('analisi dei rimasti: con l\'API in pausa non parte nulla', () => {
  const { ctx, alModello, scritture } = scriptFinto({ pausa: true, documenti: [{ id: 'x2', fascicolo: 'utenze', drive_file_id: 'f', gmail_message_id: 'm' }] });
  ctx.analizzaRimasti_(Date.now() + 60e3);
  assert.equal(alModello.length, 0);
  assert.equal(scritture.length, 0);
});

test('script: con il limite raggiunto si importa con il catalogo provvisorio, il riordino aspetta', () => {
  const fn = codice.slice(codice.indexOf('function elabora('), codice.indexOf('function elaboraThread_('));
  assert.doesNotMatch(fn.slice(0, 400), /if \(apiInPausa_\(\)\) return;/, 'niente più uscita immediata');
  assert.match(fn, /if \(!apiInPausa_\(\)\) \{[\s\S]*analizzaRimasti_[\s\S]*riordinaLotto_\(\)/);
  // Il riordino (solo testo del catalogo) aspetta Claude: la piccola quota gratuita di Gemini va alle analisi.
  assert.match(fn, /if \(!claudeInPausa_\(\)\) try \{ riordinaLotto_\(\); \}/);
  assert.match(fn, /while \(!claudeInPausa_\(\) && Date\.now\(\)/);
  const all = codice.slice(codice.indexOf('function elaboraAllegato_('), codice.indexOf('function eClinico_('));
  assert.ok(all.indexOf('eClinico_(meta, nome)') < all.indexOf('apiInPausa_()'), 'prima il controllo clinico');
  assert.match(all, /analisiDiRiserva_\(meta, nome, mime\)/);
  assert.match(codice, /&riordinato_il=is\.null&da_analizzare=is\.false/);
  const post = codice.slice(codice.indexOf('function doPost('), codice.indexOf('function fileDelDocumento_('));
  assert.match(post, /analisiDiRiserva_\(meta, nome, mime\)/);
});

test('migrazione 013: solo aggiunte, funzione riservata al servizio, mai dentro o fuori dal clinico', () => {
  assert.doesNotMatch(sql, /\b(drop|delete\s+from|truncate\s+table)\b/i);
  assert.match(sql, /add column if not exists da_analizzare boolean not null default false/);
  assert.match(sql, /add column if not exists drive_cartella text/);
  assert.match(sql, /if v_attuale = 'clinico_pazienti' then/);
  assert.match(sql, /codice <> 'clinico_pazienti'/);
  assert.match(sql, /revoke execute on function completa_analisi\(uuid, jsonb\) from public, anon, authenticated/);
  assert.match(sql, /'portafoglio' = any/);
});

test('script: quote di Google esaurite → si riprende dopo, mai email in errore; niente resoconti a raffica in pausa', () => {
  const fn = codice.slice(codice.indexOf('function elabora('), codice.indexOf('function elaboraThread_('));
  assert.equal((fn.match(/QUOTA_GOOGLE\.test\(e\.message\)/g) || []).length, 2);
  const { ctx } = scriptFinto();
  const quota = vm.runInContext('QUOTA_GOOGLE', ctx); // le const dello script non diventano proprietà del contesto
  assert.ok(quota.test('Exception: Service invoked too many times for one day: urlfetch.'));
  assert.ok(!quota.test('Supabase 400 su documenti: valore non valido'));
  const lotto = codice.slice(codice.indexOf('function chiudiLotto_('), codice.indexOf('function elaboraAllegato_('));
  assert.ok(lotto.indexOf("sb_('lotti_importazione") < lotto.indexOf('if (apiInPausa_()) return;'), 'la riga del lotto si salva comunque');
});
