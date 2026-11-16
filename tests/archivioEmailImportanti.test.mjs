// 2026-11-16, Luca: email importanti senza allegati (mittenti noti, PEC, parole chiave, risposte),
// esclusi messaggi automatici e qualsiasi cosa clinica.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent };
vm.createContext(ctx);
vm.runInContext(readFileSync('poliedron/archivio/Code.gs', 'utf8'), ctx);
const scegli = (oggetto, msgs, imp = []) => ctx.emailImportante_(oggetto, msgs, imp);
const da = (x) => ({ da: x, a: 'luca.simondi@gmail.com' });
const luca = { da: 'Luca Simondi <luca.simondi@gmail.com>', a: '' };

test('mittente già in archivio nelle categorie importanti', () => {
  assert.equal(scegli('Aggiornamento pratica', [da('Avv. Rossi <studio@avvrossi.it>')], ['studio@avvrossi.it']).motivo, 'mittente');
});
test('PEC e parole chiave nell\'oggetto', () => {
  assert.equal(scegli('Comunicazione', [da('<comune.cuneo@cert.legalmail.it>')]).motivo, 'pec');
  const s = scegli('EDISON ENERGIA: Ultimo Sollecito Pagamento', [da('Fides <clientiedison@fidesspa.eu>')]);
  assert.equal(s.motivo, 'oggetto');
  assert.equal(s.forte, true);
});
test('risposta di Luca a un indirizzo non personale sì, a una casella gmail no', () => {
  assert.equal(scegli('Chiarimenti fattura', [da('<assistenzaclienti@unionenergia.it>'), luca]).motivo, 'risposta');
  assert.equal(scegli('Ciao', [da('<amico@gmail.com>'), luca]), null);
});
test('messaggi automatici esclusi, salvo parole importanti', () => {
  assert.equal(scegli('Pagamento fallito per Edison', [da('Klarna <noreply-it@klarna.com>')]), null);
  assert.equal(scegli('Il tuo codice di verifica', [da('<no-reply@banca.it>')], ['no-reply@banca.it']), null);
  assert.equal(scegli('Proposta di modifica unilaterale delle condizioni', [da('<no-reply@revolut.com>')]).motivo, 'oggetto');
});
test('mai le email cliniche, anche da mittenti importanti', () => {
  assert.equal(scegli('Appuntamento visita di controllo', [da('<studio@avvrossi.it>')], ['studio@avvrossi.it']), null);
  assert.equal(scegli('Referto', [da('<x@aslcn1.it>')]), null);
});
