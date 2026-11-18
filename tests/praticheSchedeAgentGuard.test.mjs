import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const start = code.indexOf('function aggiornaSchede_()');
const end = code.indexOf('\n/* ', start);
assert.ok(start >= 0 && end > start);
const fn = code.slice(start, end);

function run(modello, nuova = true) {
  const writes = [], generated = [], properties = [];
  const context = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: () => null, setProperty: (...args) => properties.push(args)
    }) },
    apiInPausa_: () => false,
    sb_: (url, options) => {
      if (options) { writes.push({ url, ...options }); return; }
      if (url.startsWith('pratiche_schede?')) {
        assert.match(url, /stato_analisi=neq\.da_aggiornare/);
        return [{ pratica_id: 'synthetic', generata_il: '2026-11-01', modello }];
      }
      return [{ pratica_id: 'synthetic', creato_il: nuova ? '2026-11-02' : '2026-10-31' }];
    },
    schedaPratica_: id => { generated.push(id); return { ok: true }; },
    logErrore_: () => { throw Error('Unexpected error'); }
  };
  vm.createContext(context);
  vm.runInContext(fn, context);
  return { result: context.aggiornaSchede_(), writes, generated, properties };
}

for (const author of ['claude-code', 'codex']) {
  test(author + ': nuovi documenti segnalano aggiornamento senza rigenerare', () => {
    const r = run(author);
    assert.equal(r.result, false);
    assert.equal(r.generated.length, 0);
    assert.equal(r.writes.length, 1);
    assert.equal(r.writes[0].body.stato_analisi, 'da_aggiornare');
    assert.equal(r.writes[0].body.verificata_il, null);
    assert.equal(r.properties.length, 0);
  });
  test(author + ': senza documenti nuovi nessuna scrittura', () => {
    const r = run(author, false);
    assert.equal(r.writes.length, 0);
    assert.equal(r.generated.length, 0);
  });
}
test('schede automatiche: il percorso di rigenerazione resta disponibile', () => {
  const r = run('gemini');
  assert.equal(r.result, true);
  assert.deepEqual(r.generated, ['synthetic']);
  assert.equal(r.writes.length, 0);
  assert.equal(r.properties[0][0], 'SCHEDE_ULTIMO');
});
