import test from 'node:test';
import assert from 'node:assert/strict';
import { creaAttivita, registraEvento, aggiornamentoPersonal, richiedeConferma } from '../personal/src/lib/attivitaEsterne.js';

test('attività esterna nasce in attesa, senza risultato inventato', () => {
  const a = creaAttivita({ id: 'test-1', titolo: 'Scarica fattura' });
  assert.equal(a.stato, 'in_attesa');
  assert.equal(a.risultato, null);
  assert.equal(aggiornamentoPersonal(a), null);
});
test('solo evento con prova può dichiarare completamento', () => {
  const a = registraEvento(creaAttivita({ id: 'test-2', titolo: 'Leggi allegato' }), { stato: 'in_corso', descrizione: 'Accesso avviato' });
  assert.throws(() => registraEvento(a, { stato: 'completata', descrizione: 'Fatto' }), /Prova/);
  const finita = registraEvento(a, { stato: 'completata', descrizione: 'File verificato', prova: 'file:test-2' });
  assert.equal(aggiornamentoPersonal(finita).verificato, true);
  assert.equal(finita.risultato.prova, 'file:test-2');
});
test('non si salta da attesa a completata', () => {
  assert.throws(() => registraEvento(creaAttivita({ id: 'test-3', titolo: 'Test' }), { stato: 'completata', descrizione: 'Fatto', prova: 'x' }), /Transizione/);
});
test('operazioni sensibili richiedono conferma', () => {
  for (const azione of ['pagamento', 'invio', 'cancellazione', 'modifica_sensibile']) assert.equal(richiedeConferma(azione), true);
  assert.equal(richiedeConferma('lettura'), false);
});
test('errore recuperabile e allegati tracciati', () => {
  let a = creaAttivita({ id: 'test-4', titolo: 'Test' });
  a = registraEvento(a, { stato: 'errore', descrizione: 'Sessione scaduta', allegati: [{ nome: 'log.txt', riferimento: 'log:1' }] });
  assert.equal(a.allegati.length, 1);
  a = registraEvento(a, { stato: 'in_attesa', descrizione: 'Pronto al nuovo tentativo' });
  assert.equal(a.stato, 'in_attesa');
});
