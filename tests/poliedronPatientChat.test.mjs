import test from 'node:test';
import assert from 'node:assert/strict';
import { whatsappLink, searchPatients, searchMessages, patientChatKey, patientIdFromKey, patientName } from '../src/lib/poliedron/team/patientChat.js';

test('WhatsApp links: Italian numbers get +39 once, unusable numbers are refused', () => {
  assert.equal(whatsappLink('333 123 4567'), 'https://wa.me/393331234567');
  assert.equal(whatsappLink('+39 333 1234567'), 'https://wa.me/393331234567');
  assert.equal(whatsappLink('0039 3331234567', 'Ciao a te'), 'https://wa.me/393331234567?text=Ciao%20a%20te');
  assert.equal(whatsappLink(''), null);
  assert.equal(whatsappLink('12'), null);
});
test('patient chat keys round-trip and never match other chats', () => {
  assert.equal(patientIdFromKey(patientChatKey(7)), '7');
  assert.equal(patientIdFromKey('assistant:agenda'), null);
  assert.equal(patientIdFromKey(null), null);
  assert.equal(patientName({ nome: 'Mario', cognome: 'Rossi' }), 'Mario Rossi');
});
test('patient search matches every word in name, surname or phone', () => {
  const list = [{ id: 1, nome: 'Mario', cognome: 'Rossi', telefono: '333' }, { id: 2, nome: 'Maria', cognome: 'Bianchi', telefono: '347' }];
  assert.deepEqual(searchPatients(list, 'ros').map((p) => p.id), [1]);
  assert.deepEqual(searchPatients(list, 'mar bia').map((p) => p.id), [2]);
  assert.deepEqual(searchPatients(list, '347').map((p) => p.id), [2]);
  assert.equal(searchPatients(list, '', 1).length, 1);
});
test('message search spans chats, newest first, ignores one-letter queries', () => {
  const hits = searchMessages({
    poliedron: [{ id: 1, content: 'Sposta il controllo', created_at: '2026-10-01T10:00:00Z' }],
    'patient:7': [{ id: 'a', content: 'Le ricordo il controllo', at: '2026-10-05T10:00:00Z' }, { id: 'b', content: 'altro' }],
  }, 'controllo');
  assert.deepEqual(hits.map((h) => h.key), ['patient:7', 'poliedron']);
  assert.deepEqual(searchMessages({ poliedron: [{ id: 1, content: 'a' }] }, 'a'), []);
});
