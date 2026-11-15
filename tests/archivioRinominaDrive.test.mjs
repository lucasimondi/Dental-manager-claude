// 2026-11-15, Luca: "Rinomina anche i file su drive". I file prendono "<data>_<titolo>.<ext>";
// mai i clinici né i file caricati dall'app o messi su Drive da Luca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');

function scriptFinto(docs) {
  const nomi = {}, patch = [];
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    DriveApp: { getFileById: (id) => ({ setName: (n) => { nomi[id] = n; } }) },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  let coda = docs.slice();
  ctx.logErrore_ = () => {};
  ctx.sb_ = (percorso, o = {}) => {
    if (!o.method) { const r = coda; coda = []; return r; }
    patch.push({ percorso, corpo: o.body });
    return null;
  };
  return { ctx, nomi, patch };
}

test('rinomina Drive: nome "<data>_<titolo>.<ext>", clinici e file propri esclusi, flag sempre tolto', () => {
  const { ctx, nomi, patch } = scriptFinto([
    { id: 'a', drive_file_id: 'f1', titolo: 'Fattura n. 3 – Enel / Luca', data_documento: '2024-03-02', nome_file_originale: 'x.PDF', fascicolo: 'utenze', gmail_message_id: 'm1' },
    { id: 'b', drive_file_id: 'f2', titolo: 'Ricetta', email_data: '2023-01-05T10:00:00Z', nome_file_originale: 'r.pdf', fascicolo: 'clinico_pazienti', gmail_message_id: 'm2' },
    { id: 'c', drive_file_id: 'f3', titolo: 'Mio file', email_data: '2023-01-05T10:00:00Z', nome_file_originale: 'm.pdf', fascicolo: 'altro', gmail_message_id: 'caricato:1' },
  ]);
  assert.equal(ctx.rinominaDrive_(Date.now() + 60000), false);
  assert.deepEqual(JSON.parse(JSON.stringify(nomi)), { f1: '2024-03-02_Fattura n. 3 – Enel - Luca.pdf' });
  assert.deepEqual(patch.map((p) => p.percorso), ['documenti?id=eq.a', 'documenti?id=eq.b', 'documenti?id=eq.c']);
  assert.ok(patch.every((p) => p.corpo.drive_rinomina === false));
});
