// POL-VITA-ORDINA fase 3b (Code.gs): giro automatico del riordino. Solo moveTo + setName (mai copie,
// cancellazioni o cestino), cartella e nome REALI letti prima dello spostamento, verifica dopo,
// registrazione ogni 25 file, errori per file, pausa, pausa di quota, fine con notifica.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const LOTTO_VECCHIO = '11111111-1111-4111-8111-111111111111';

function scriptFinto({ file = {}, cartelle = {}, prossimi = [], props = {}, trigger = [], lockLibero = true, quotaDopo = Infinity, nonVerifica = [] } = {}) {
  const chiamate = []; const drive = []; const store = { ...props }; const triggers = trigger.map((h) => ({ h }));
  let mosse = 0; let uuid = 0;
  const cartella = (id) => {
    if (!cartelle[id]) throw new Error('Cartella non trovata');
    return { getId: () => id, isTrashed: () => !!cartelle[id].cestino };
  };
  const fileDrive = (id) => {
    const f = file[id];
    return {
      getId: () => id, isTrashed: () => !!f.cestino, getName: () => f.nome,
      getParents: () => { const p = f.padri.slice(); return { hasNext: () => p.length > 0, next: () => cartella(p.shift()) }; },
      moveTo: (c) => {
        if (++mosse > quotaDopo) throw new Error('Servizio richiamato troppe volte in un giorno: drive.');
        drive.push(['moveTo', id, c.getId()]);
        if (!nonVerifica.includes(id)) f.padri = [c.getId()];
      },
      setName: (n) => { drive.push(['setName', id, n]); if (!nonVerifica.includes(id)) f.nome = n; },
    };
  };
  const ctx = {
    console: { log() {}, error() {} }, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = String(v); }, deleteProperty: (k) => { delete store[k]; },
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => lockLibero, releaseLock() {} }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.map((t) => ({ getHandlerFunction: () => t.h, _t: t })),
      deleteTrigger: (x) => { triggers.splice(triggers.indexOf(x._t), 1); },
      newTrigger: (h) => ({ timeBased: () => ({ everyMinutes: (m) => ({ create: () => triggers.push({ h, m }) }) }) }),
    },
    Utilities: { getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`, formatDate: (d) => d.toISOString().slice(0, 10) },
    DriveApp: {
      getFileById: (id) => { if (!file[id]) throw new Error('File non trovato'); return fileDrive(id); },
      getFolderById: cartella,
      createShortcut: () => { throw new Error('nessuna scorciatoia attesa'); },
      createFolder: () => { throw new Error('mai cartelle nuove'); },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.logErrore_ = () => {};
  ctx.inviaNotifiche_ = () => chiamate.push(['notifiche']);
  const restanti = prossimi.slice();
  ctx.sb_ = (percorso, o = {}) => {
    chiamate.push([percorso, o.body === undefined ? null : JSON.parse(JSON.stringify(o.body))]);
    if (percorso === 'rpc/riordino_prossimi') return restanti.splice(0, o.body.p_limite);
    if (percorso === 'rpc/riordino_registra_v2') return o.body.p_righe.length;
    if (percorso === 'rpc/riordino_errore') return 1;
    if (percorso.startsWith('impostazioni_app?select')) return [];
    if (percorso.startsWith('v_riordino_errori_ripetuti')) return [];
    return null;
  };
  return { ctx, chiamate, drive, store, triggers };
}

const riga = (id, dest, nome) => ({ file_id: id, documento_id: null, drive_cartella_id: dest, nome_nuovo: nome, percorso_nuovo: 'X/Y', scorciatoie: [] });
const registrazioni = (s) => s.chiamate.filter(([p]) => p === 'rpc/riordino_registra_v2').map(([, b]) => b);
const errori = (s) => s.chiamate.filter(([p]) => p === 'rpc/riordino_errore').map(([, b]) => b);

test('giro: sposta e rinomina, registra cartella e nome REALI di prima; già a posto solo registrato; cestino → errore', () => {
  const s = scriptFinto({
    cartelle: { vecchia: {}, dest: {} },
    file: {
      fA: { nome: 'scan 1.pdf', padri: ['vecchia'] },
      fB: { nome: '2020-01-01_Giusto.pdf', padri: ['dest'] },
      fC: { nome: 'via.pdf', padri: ['vecchia'], cestino: true },
    },
    prossimi: [riga('fA', 'dest', '2021-02-03_Nuovo.pdf'), riga('fB', 'dest', '2020-01-01_Giusto.pdf'), riga('fC', 'dest', 'x.pdf')],
  });
  const e = JSON.parse(JSON.stringify(s.ctx.riordinoGiro_()));
  assert.equal(e.spostati, 1); assert.equal(e.gia_a_posto, 1); assert.equal(e.errori, 1); assert.equal(e.registrati, 2);
  assert.deepEqual(s.drive, [['moveTo', 'fA', 'dest'], ['setName', 'fA', '2021-02-03_Nuovo.pdf']]);   // fB non toccato
  const [reg] = registrazioni(s);
  assert.equal(reg.p_lotto, e.lotto);
  assert.deepEqual(reg.p_righe, [
    { file_id: 'fA', da_padre_id: 'vecchia', da_nome: 'scan 1.pdf', scorciatoie: [] },
    { file_id: 'fB', da_padre_id: 'dest', da_nome: '2020-01-01_Giusto.pdf', scorciatoie: [] },
  ]);
  assert.deepEqual(errori(s), [{ p_lotto: e.lotto, p_file_id: 'fC', p_errore: 'File nel cestino di Drive' }]);
  assert.equal(s.store.RIORDINO_PENDENTI, undefined);   // tutto registrato
  // mai copie, cancellazioni o cestino: nessuna chiamata diversa da moveTo / setName
  assert.ok(s.drive.every(([op]) => op === 'moveTo' || op === 'setName'));
});

test('file o cartella di destinazione mancanti → riordino_errore, nessuno spostamento', () => {
  const s = scriptFinto({
    cartelle: { vecchia: {}, cestinata: { cestino: true } },
    file: { fA: { nome: 'a.pdf', padri: ['vecchia'] }, fB: { nome: 'b.pdf', padri: ['vecchia'] } },
    prossimi: [riga('sparito', 'vecchia', 'x.pdf'), riga('fA', 'nonc_e', 'a2.pdf'), riga('fB', 'cestinata', 'b2.pdf')],
  });
  const e = s.ctx.riordinoGiro_();
  assert.equal(e.errori, 3); assert.equal(e.spostati, 0);
  assert.deepEqual(errori(s).map((x) => x.p_file_id), ['sparito', 'fA', 'fB']);
  assert.match(errori(s)[1].p_errore, /destinazione non trovata/);
  assert.match(errori(s)[2].p_errore, /cestino/);
  assert.deepEqual(s.drive, []);
  assert.deepEqual(registrazioni(s), []);
});

test('verifica dopo lo spostamento: se Drive non torna come nel piano il file torna dov\'era e va in errore', () => {
  const s = scriptFinto({
    cartelle: { vecchia: {}, dest: {} },
    file: { fA: { nome: 'a.pdf', padri: ['vecchia'] } },
    prossimi: [riga('fA', 'dest', 'nuovo.pdf')],
    nonVerifica: ['fA'],
  });
  const e = s.ctx.riordinoGiro_();
  assert.equal(e.errori, 1);
  assert.match(errori(s)[0].p_errore, /Verifica non riuscita/);
  assert.deepEqual(s.drive.slice(-1)[0], ['moveTo', 'fA', 'vecchia']);
  assert.deepEqual(registrazioni(s), []);
});

test('registra ogni 25 file e si ferma al limite di tempo', () => {
  const file = {}; const prossimi = [];
  for (let i = 0; i < 30; i++) { file[`f${i}`] = { nome: `n${i}`, padri: ['vecchia'] }; prossimi.push(riga(`f${i}`, 'dest', `m${i}`)); }
  const s = scriptFinto({ cartelle: { vecchia: {}, dest: {} }, file, prossimi });
  const e = s.ctx.riordinoGiro_();
  assert.equal(e.spostati, 30);
  assert.deepEqual(registrazioni(s).map((r) => r.p_righe.length), [25, 5]);

  const s2 = scriptFinto({ cartelle: { vecchia: {}, dest: {} }, file: { f0: { nome: 'a', padri: ['vecchia'] }, f1: { nome: 'b', padri: ['vecchia'] } }, prossimi: [riga('f0', 'dest', 'x'), riga('f1', 'dest', 'y')] });
  const e2 = s2.ctx.riordinoGiro_({ tempo: -1 });
  assert.equal(e2.letti, 0); assert.deepEqual(s2.drive, []);
});

test('quota di Google: pausa automatica di 1 ora, niente errore sul file, i già spostati restano registrati', () => {
  const s = scriptFinto({
    cartelle: { vecchia: {}, dest: {} },
    file: { fA: { nome: 'a', padri: ['vecchia'] }, fB: { nome: 'b', padri: ['vecchia'] } },
    prossimi: [riga('fA', 'dest', 'A'), riga('fB', 'dest', 'B')],
    quotaDopo: 1,
  });
  const prima = Date.now();
  const e = s.ctx.riordinoGiro_();
  assert.equal(e.quota, true); assert.equal(e.spostati, 1); assert.deepEqual(errori(s), []);
  assert.ok(Number(s.store.RIORDINO_RIPRENDI_DOPO) >= prima + 3600000 - 1000);
  assert.deepEqual(registrazioni(s)[0].p_righe.map((r) => r.file_id), ['fA']);
  // giro dopo, ancora in pausa di quota: esce senza chiamare Supabase
  const n = s.chiamate.length;
  assert.equal(s.ctx.riordinoGiro_().saltato, 'quota');
  assert.equal(s.chiamate.length, n);
});

test('pausa (RIORDINO_PAUSA=1) e lock occupato: il giro esce subito', () => {
  const p = scriptFinto({ props: { RIORDINO_PAUSA: '1' }, prossimi: [riga('fA', 'dest', 'A')] });
  assert.equal(p.ctx.riordinoGiro_().saltato, 'pausa');
  assert.deepEqual(p.chiamate, []);
  const l = scriptFinto({ lockLibero: false, prossimi: [riga('fA', 'dest', 'A')] });
  assert.equal(l.ctx.riordinoGiro_().saltato, 'giro già in corso');
  assert.deepEqual(l.chiamate, []);
});

test('file spostati e non registrati da un giro interrotto: registrati per primi, col loro lotto', () => {
  const pend = [{ lotto: LOTTO_VECCHIO, file_id: 'fZ', da_padre_id: 'vecchia', da_nome: 'z.pdf', scorciatoie: [] }];
  const s = scriptFinto({ props: { RIORDINO_PENDENTI: JSON.stringify(pend) }, prossimi: [] , trigger: ['riordinoGiro'] });
  s.ctx.riordinoGiro_();
  assert.deepEqual(JSON.parse(JSON.stringify(registrazioni(s))), [{ p_lotto: LOTTO_VECCHIO, p_righe: [{ file_id: 'fZ', da_padre_id: 'vecchia', da_nome: 'z.pdf', scorciatoie: [] }] }]);
  assert.equal(s.store.RIORDINO_PENDENTI, undefined);
  // registra PRIMA di chiedere i prossimi
  const i = s.chiamate.findIndex(([p]) => p === 'rpc/riordino_registra_v2');
  const j = s.chiamate.findIndex(([p]) => p === 'rpc/riordino_prossimi');
  assert.ok(i >= 0 && i < j);
});

test('piano finito: trigger cancellato, notifica «Riordino finito: X spostati, Y errori», riepilogo salvato', () => {
  const s = scriptFinto({ prossimi: [], trigger: ['riordinoGiro', 'elabora'] });
  const e = s.ctx.riordinoGiro_();
  assert.equal(e.finito, true);
  assert.deepEqual(s.triggers.map((t) => t.h), ['elabora']);
  const sc = s.chiamate.find(([p]) => p === 'scadenze');
  assert.match(sc[1].descrizione, /^Riordino finito: \d+ spostati, \d+ errori$/);
  assert.equal(sc[1].categoria, 'riordino');
  assert.ok(s.chiamate.some(([p]) => p === 'notifiche'));
  assert.ok(s.chiamate.some(([p, b]) => p.startsWith('impostazioni_app?on_conflict') && b.valore.finito_il));
});

test('avviaRiordino: un solo trigger ogni 5 minuti, toglie quelli vecchi e la pausa; i vecchi handler si spengono da soli', () => {
  const s = scriptFinto({ trigger: ['riordinoAutomatico', 'riordinoParallelo0', 'riordinoParallelo3', 'elabora'], props: { RIORDINO_PAUSA: '1' } });
  s.ctx.avviaRiordino();
  s.ctx.avviaRiordino();
  assert.deepEqual(s.triggers.map((t) => [t.h, t.m]), [['elabora', undefined], ['riordinoGiro', 5]]);
  assert.equal(s.store.RIORDINO_PAUSA, undefined);
  const v = scriptFinto({ trigger: ['riordinoParallelo1', 'elabora'] });
  v.ctx.riordinoParallelo1();
  assert.deepEqual(v.triggers.map((t) => t.h), ['elabora']);
  assert.deepEqual(v.chiamate, []);   // nessuna chiamata a Supabase (quota)
  s.ctx.pausaRiordino();
  assert.equal(s.store.RIORDINO_PAUSA, '1');
  s.ctx.riprendiRiordino();
  assert.equal(s.store.RIORDINO_PAUSA, undefined);
});

test('annulla_lotto con file_ids: solo quei file (id non validi scartati)', () => {
  const s = scriptFinto();
  s.ctx.annullaLottoRiordino_(LOTTO_VECCHIO, ['fA_1234567890', 'x;drop']);
  const q = s.chiamate.find(([p]) => p.startsWith('log_spostamenti?select=*'))[0];
  assert.match(q, /&file_id=in\.\(fA_1234567890\)/);
  assert.doesNotMatch(q, /drop/);
});

test('quota: riconosce i messaggi di Google (anche in italiano), non gli altri «Limite superato»', () => {
  const s = scriptFinto();
  const q = vm.runInContext('RIORDINO_QUOTA', s.ctx);
  assert.ok(q.test('Servizio richiamato troppe volte in un giorno: drive.'));
  assert.ok(q.test('Service invoked too many times for one day: urlfetch.'));
  assert.ok(q.test('User rate limit exceeded'));
  assert.ok(!q.test('Limite superato: Lunghezza URL URLFetch.'));
  assert.ok(!q.test('File nel cestino di Drive'));
});
