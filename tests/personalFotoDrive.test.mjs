import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const gs = readFileSync('poliedron/archivio/Code.gs', 'utf8');
function ambiente({ presenti = [], files = [{ id: 'a', name: 'IMG_1.jpg', mimeType: 'image/jpeg', createdTime: '2026-10-19T10:00:00Z', parents: ['p'], imageMediaMetadata: { time: '2025:08:12 12:10:00' } }], errore = false } = {}) {
  const props = {}, scritture = [], richieste = [];
  const ctx = vm.createContext({ console, PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k], setProperty: (k, v) => props[k] = v, deleteProperty: k => delete props[k] }) }, Drive: { Files: {
    list: o => { richieste.push(o); return { files, nextPageToken: 'pagina2' }; },
    get: () => ({ name: 'Vacanze' }),
  } } });
  vm.runInContext(gs, ctx);
  ctx.eClinico_ = (_m, nome) => nome.includes('paziente');
  ctx.sb_ = (url, op) => {
    if (!op) return presenti;
    scritture.push({ url, op });
    if (errore) throw Error('rete');
    return { documento_id: 'doc' };
  };
  return { ctx, props, scritture, richieste };
}
test('Drive: cataloga data di scatto e cartella senza leggere o spostare originali', () => {
  const a = ambiente(); a.ctx.importaFotoDrive_(Date.now() + 10000);
  const p = a.scritture[0].op.body.p;
  assert.equal(p.data_documento, '2025-08-12'); assert.equal(p.fascicolo, 'foto_video');
  assert.equal(p.azione_richiesta, false); assert.equal(p.analisi_contenuto, false); assert.equal(p.drive_file_id, 'a');
  assert.equal(a.scritture[1].op.body.album, 'Vacanze');
  assert.equal(a.props.FOTO_DRIVE_PAGINA, 'pagina2');
  assert.match(a.richieste[0].q, /'me' in owners/);
});
test('Drive: non riclassifica file già indicizzati', () => {
  const a = ambiente({ presenti: [{ id: 'gia', gmail_message_id: 'gmail:1' }] });
  a.ctx.importaFotoDrive_(Date.now() + 10000); assert.equal(a.scritture.length, 0);
});
test('Drive: errore non fa avanzare il cursore', () => {
  const a = ambiente({ errore: true });
  assert.throws(() => a.ctx.importaFotoDrive_(Date.now() + 10000), /rete/);
  assert.equal(a.props.FOTO_DRIVE_PAGINA, undefined); assert.ok(a.props.FOTO_DRIVE_FINO);
});
test('Drive: riprende il catalogo se il record era stato creato prima di un errore', () => {
  const a = ambiente({ presenti: [{ id: 'doc', gmail_message_id: 'drivefoto:a', riordinato_il: null }] });
  a.ctx.importaFotoDrive_(Date.now() + 10000);
  assert.equal(a.scritture.length, 1); assert.equal(a.scritture[0].op.method, 'patch');
});
test('Drive: salta nomi clinici e rispetta il limite di tempo', () => {
  const a = ambiente({ files: [{ id: 'c', name: 'paziente.jpg' }] });
  a.ctx.importaFotoDrive_(Date.now() + 10000); assert.equal(a.scritture.length, 0);
  const b = ambiente(); b.ctx.importaFotoDrive_(Date.now() - 1);
  assert.equal(b.scritture.length, 0); assert.equal(b.props.FOTO_DRIVE_PAGINA, undefined);
});
