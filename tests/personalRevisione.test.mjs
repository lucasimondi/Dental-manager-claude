import test from 'node:test';
import assert from 'node:assert/strict';
import { valutaScadenza, avvisoCartella, areaArchivio } from '../personal/src/lib/revisioneArchivio.js';
const oggi = '2026-10-19';
const base = { id: 'a', data: '2026-10-07', importo: 84.93, documento: { titolo: 'Sollecito fattura 2366/2025', tipo_documento: 'sollecito', fascicolo: 'studio_fornitori' } };
test('sollecito recente di fattura 2025 richiede verifica e conferma esplicita', () => {
 assert.equal(valutaScadenza(base, oggi).tipo, 'verifica');
 assert.equal(valutaScadenza({ ...base, documento: { ...base.documento, tag: ['pagamento-verificato:a'] } }, oggi).tipo, 'pagamento');
});
test('congresso promozionale con prezzo resta opportunità', () => {
 assert.equal(valutaScadenza({ ...base, documento: { titolo: 'Invito Agorà', fascicolo: 'pubblicita', tipo_documento: 'comunicazione' } }, oggi).tipo, 'opportunita');
});
test('quietanza con importo e futura copertura non prova un nuovo debito', () => {
 assert.equal(valutaScadenza({ ...base, documento: { titolo: 'Certificato RCA', riassunto: 'Quietanza rata mensile', tipo_documento: 'certificato' } }, oggi).tipo, 'verifica');
});
test('date di rinnovo e recesso senza importo sono promemoria', () => {
 assert.equal(valutaScadenza({ ...base, importo: null, documento: { titolo: 'Recesso contratto', tipo_documento: 'comunicazione' } }, oggi).tipo, 'promemoria');
});
test('manuali restano pagamenti e storico non diventa pagato', () => {
 assert.equal(valutaScadenza({ ...base, documento: null }, oggi).tipo, 'pagamento');
 assert.equal(valutaScadenza({ ...base, storica: true }, oggi).tipo, 'verifica');
});
test('badge esclude eventi promozionali, completati e scadenze storiche', () => {
 const promo = { ...base, documento: { fascicolo: 'pubblicita' } };
 const r = avvisoCartella([base, promo, { ...base, storica: true }, { ...base, completata: true }], oggi);
 assert.equal(r.n, 1); assert.equal(r.colore, '#B42318');
 assert.equal(areaArchivio('utenze'), areaArchivio('riscaldamento'));
});

import vm from 'node:vm';
import { readFileSync } from 'node:fs';
test('rilettura riprende dal checkpoint, non accoda foto e non avanza su errore', () => {
 const source = readFileSync('poliedron/archivio/Code.gs', 'utf8');
 const props = new Map([['RILETTURA_ATTIVA', '1']]);
 const writes = [];
 const ctx = vm.createContext({ PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k), setProperty: (k,v) => props.set(k,v), deleteProperty: (k) => props.delete(k) }) } });
 vm.runInContext(source, ctx);
 ctx.sb_ = (q, opts) => { if (q.includes('da_analizzare=is.true')) return []; if (!opts) return [{ id: 'a', gmail_message_id: 'drivefoto:1' }, { id: 'b', gmail_message_id: 'email' }]; writes.push(q); };
 vm.runInContext('accodaRilettura_()', ctx);
 assert.equal(writes.length, 1); assert.equal(props.get('RILETTURA_CURSORE'), 'b');
 ctx.sb_ = (q, opts) => { if (opts) throw Error('offline'); if (q.includes('da_analizzare=is.true')) return []; return [{ id: 'c' }]; };
 assert.throws(() => vm.runInContext('accodaRilettura_()', ctx), /offline/);
 assert.equal(props.get('RILETTURA_CURSORE'), 'b');
});
