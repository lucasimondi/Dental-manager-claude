import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { capisciRichiesta, fascicoloDaTesto, riepilogoDebito } from '../personal/src/lib/coreArchivio.js';
import { rispondi, eliminaDocumento, segnaScadenza } from '../personal/src/lib/archivio.js';

test('Core: capisce le richieste comuni senza modello', () => {
  assert.deepEqual(capisciRichiesta('Quanto devo a Edison?'), { intento: 'DEBITO', controparte: 'edison' });
  assert.deepEqual(capisciRichiesta("quanto devo all'Agenzia delle Entrate"), { intento: 'DEBITO', controparte: 'agenzia delle entrate' });
  assert.equal(capisciRichiesta('Scadenze di questo mese').intento, 'SCADENZE');
  assert.equal(capisciRichiesta('Scadenze di questo mese').entroGiorni, 30);
  assert.equal(capisciRichiesta('cosa devo pagare questa settimana').entroGiorni, 7);
  assert.equal(capisciRichiesta('quanto devo pagare entro 15 giorni').entroGiorni, 15);
  assert.equal(capisciRichiesta('scadenze').entroGiorni, null);
  assert.equal(capisciRichiesta('Cosa devo fare?').intento, 'AZIONI');
  assert.deepEqual(capisciRichiesta('Le mie pratiche'), { intento: 'PRATICHE' });
  assert.deepEqual(capisciRichiesta('pratica Edison'), { intento: 'PRATICA', testo: 'edison' });
  assert.deepEqual(capisciRichiesta('Bollette'), { intento: 'FASCICOLO', fascicolo: 'utenze' });
  assert.deepEqual(capisciRichiesta('mostrami le polizze'), { intento: 'FASCICOLO', fascicolo: 'assicurazioni' });
  assert.deepEqual(capisciRichiesta('cerca la fattura Edison di settembre'), { intento: 'CERCA', testo: 'fattura edison settembre' });
  assert.deepEqual(capisciRichiesta('fattura luce edison'), { intento: 'CERCA', testo: 'fattura luce edison' });
  assert.deepEqual(capisciRichiesta('diffida condominio'), { intento: 'CERCA', testo: 'diffida condominio' });
  assert.deepEqual(capisciRichiesta('tutte le bollette'), { intento: 'FASCICOLO', fascicolo: 'utenze' });
  assert.equal(capisciRichiesta('   ').intento, 'VUOTO');
});

test('Core: sinonimi dei fascicoli usano solo codici esistenti nello schema', () => {
  const schema = readFileSync('supabase/archivio/migrations/20261012201509_schema_archivio_documenti.sql', 'utf8');
  for (const frase of ['enpam', 'tasse', 'banca', 'avvocato', 'scuola', 'catasto', 'auto', 'eredità', 'passaporto', 'referti', 'fornitori', 'abbonamenti', 'amazon']) {
    const codice = fascicoloDaTesto(frase);
    assert.ok(codice, frase);
    assert.match(schema, new RegExp(`\\('${codice}',`), `${frase} → ${codice}`);
  }
});

test('Core: riepilogo del debito', () => {
  const r = riepilogoDebito('Edison', [
    { id: 1, data: '2026-12-01', importo: '80.00', completata: false },
    { id: 2, data: '2026-11-15', importo: '120.50', completata: false },
    { id: 3, data: '2026-10-01', importo: '99.00', completata: true },
    { id: 4, data: '2027-01-10', importo: null, completata: false },
  ]);
  assert.equal(r.totale, 200.5);
  assert.equal(r.aperte.length, 3);
  assert.equal(r.prossima.id, 2);
  assert.match(r.frase, /^Edison: 200,50\s€ da pagare in 3 scadenze \(1 senza importo\)\. Prossima: 15\/11\/2026\.$/);
  assert.equal(riepilogoDebito('fides', []).frase, 'Nessuna scadenza aperta registrata per Fides.');
  assert.match(riepilogoDebito('agenzia delle entrate', [{ data: '2026-12-01', importo: 10, completata: false }]).frase, /^Agenzia Delle Entrate:/);
});

// Client finto: registra le chiamate e restituisce dati preparati.
function clientFinto(risposte) {
  const chiamate = [];
  const query = (tabella) => {
    const q = { tabella, filtri: [] };
    const catena = new Proxy({}, {
      get(_t, metodo) {
        if (metodo === 'then') return (ok, ko) => Promise.resolve({ data: risposte[tabella](q), error: null }).then(ok, ko);
        return (...args) => { q.filtri.push([metodo, ...args]); return catena; };
      },
    });
    chiamate.push(q);
    return catena;
  };
  return {
    chiamate,
    from: query,
    rpc: async (nome, args) => { chiamate.push({ rpc: nome, args }); return { data: risposte[nome](args), error: null }; },
  };
}

test('rispondi: "Quanto devo a Edison?" somma le scadenze aperte dei documenti trovati', async () => {
  const db = clientFinto({
    cerca_documenti: () => [{ id: 'd1' }, { id: 'd2' }],
    scadenze: () => [
      { id: 's1', data: '2026-11-15', importo: 120.5, completata: false },
      { id: 's2', data: '2026-12-01', importo: 80, completata: false },
    ],
  });
  const r = await rispondi(db, 'Quanto devo a Edison?');
  assert.equal(r.tipo, 'debito');
  assert.equal(r.totale, 200.5);
  assert.deepEqual(db.chiamate[0], { rpc: 'cerca_documenti', args: { q: 'edison', fasc: null, lim: 200 } });
  assert.deepEqual(db.chiamate[1].filtri.find((f) => f[0] === 'in'), ['in', 'documento_id', ['d1', 'd2']]);
});

test('rispondi: fascicolo e ricerca libera passano dalla ricerca del database', async () => {
  const db = clientFinto({ cerca_documenti: () => [] });
  await rispondi(db, 'bollette');
  await rispondi(db, 'diffida condominio');
  assert.deepEqual(db.chiamate.map((c) => c.args), [
    { q: '', fasc: 'utenze', lim: 50 },
    { q: 'diffida condominio', fasc: null, lim: 50 },
  ]);
});

test('azioni: pagata e cancellazione definitiva', async () => {
  const db = clientFinto({ scadenze: () => ({ id: 's1', completata: true }), elimina_documento: () => ({ eliminato: true, drive_file_ids: ['drv'] }) });
  assert.deepEqual(await segnaScadenza(db, 's1'), { id: 's1', completata: true });
  assert.deepEqual(db.chiamate[0].filtri[0], ['update', { completata: true }]);
  assert.deepEqual(await eliminaDocumento(db, 'd1'), { eliminato: true, drive_file_ids: ['drv'] });
  assert.deepEqual(db.chiamate[1], { rpc: 'elimina_documento', args: { p_id: 'd1' } });
});

test('cancellazione: se la funzione del database manca, l\'app fa gli stessi passi senza residui', async () => {
  const chiamate = [];
  const dati = { soggettiAncoraUsati: { s1: [], s2: [{ documento_id: 'altro' }] } };
  const db = {
    rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.elimina_documento(p_id) in the schema cache' } }),
    from(tabella) {
      const q = { tabella, filtri: [] };
      chiamate.push(q);
      const catena = new Proxy({}, { get(_t, m) {
        if (m === 'then') {
          let data = null;
          if (tabella === 'documenti' && q.filtri[0][0] === 'select') data = { id: 'd1', hash_sha256: 'h1', gmail_message_id: 'm1', drive_file_id: 'drv1' };
          if (tabella === 'documenti_soggetti' && q.filtri.some((f) => f[0] === 'eq' && f[1] === 'documento_id')) data = [{ soggetto_id: 's1' }, { soggetto_id: 's2' }];
          if (tabella === 'documenti_soggetti' && q.filtri.some((f) => f[0] === 'eq' && f[1] === 'soggetto_id')) data = dati.soggettiAncoraUsati[q.filtri.find((f) => f[0] === 'eq' && f[1] === 'soggetto_id')[2]];
          return (ok) => Promise.resolve({ data, error: null }).then(ok);
        }
        return (...a) => { q.filtri.push([m, ...a]); return catena; };
      } });
      return catena;
    },
  };
  assert.deepEqual(await eliminaDocumento(db, 'd1'), { eliminato: true, drive_file_ids: ['drv1'] });
  const cancellazioni = chiamate.filter((q) => q.filtri.some((f) => f[0] === 'delete')).map((q) => [q.tabella, q.filtri.find((f) => f[0] === 'eq' || f[0] === 'in').slice(1)]);
  assert.deepEqual(cancellazioni, [
    ['log_elaborazione', ['riferimento', ['d1', 'h1', 'm1']]],
    ['documenti', ['id', 'd1']],
    ['soggetti', ['id', 's1']],
  ]);
});

test('cancellazione: un errore diverso dalla funzione mancante non viene aggirato', async () => {
  const db = { rpc: async () => ({ data: null, error: { code: '42501', message: 'Archivio personale: operazione non consentita' } }), from: () => { throw new Error('non deve arrivare qui'); } };
  await assert.rejects(eliminaDocumento(db, 'd1'), /operazione non consentita/);
});

const fileDi = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? fileDi(join(dir, f)) : [join(dir, f)]));

test('Poliedron Personal è isolata dall\'app dello studio', () => {
  for (const file of fileDi('personal/src')) {
    const src = readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /idklxdqebfceplrualgh/, `${file}: progetto dello studio`);
    assert.doesNotMatch(src, /from ['"](?:\.\.\/)+src\/(?:lib|components)\//, `${file}: importa codice dello studio`);
    assert.doesNotMatch(src, /service_role|sb_secret_/, `${file}: chiave segreta`);
  }
  assert.match(readFileSync('personal/src/lib/supabasePersonal.js', 'utf8'), /tkcwvjzjkfhcuebrjvsp/);
  const config = readFileSync('vite.personal.config.js', 'utf8');
  assert.match(config, /root: resolve\('personal'\)/);
  assert.match(config, /outDir: resolve\('dist-personal'\)/);
  assert.doesNotMatch(config, /VitePWA/);
});
