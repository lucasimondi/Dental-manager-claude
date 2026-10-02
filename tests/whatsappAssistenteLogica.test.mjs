import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  costruisciStorico, dataOggiStudio, estraiEventi, filtraSlotOggi, inPausa, pausaFinoA,
  promptDiSistema, testoDaMessaggio, validaDataDisponibilita, validaRichiesta, minutiAdessoStudio,
} from '../supabase/functions/whatsapp-webhook/logica.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the Edge Function slot calculator is byte-identical to the app one', () => {
  assert.equal(
    read('supabase/functions/whatsapp-webhook/agendaSlots.js'),
    read('src/lib/agendaSlots.js'),
    'copy src/lib/agendaSlots.js into supabase/functions/whatsapp-webhook/ after changing it',
  );
});

test('dates are computed in the studio time zone, not UTC', () => {
  // 23:30 UTC on 1 Oct = 01:30 on 2 Oct in Rome (CEST, UTC+2)
  const t = new Date('2026-10-01T23:30:00Z');
  assert.equal(dataOggiStudio(t), '2026-10-02');
  assert.equal(minutiAdessoStudio(t), 90);
});

test('extracts patient messages and Coexistence staff echoes from one webhook', () => {
  const payload = {
    entry: [{
      changes: [
        { field: 'messages', value: { metadata: { phone_number_id: 'P1' }, messages: [
          { from: '393331112222', id: 'wamid.1', type: 'text', text: { body: 'Buongiorno' } },
          { from: '393331112222', id: 'wamid.2', type: 'button', button: { text: 'Confermo' } },
        ] } },
        { field: 'messages', value: { metadata: { phone_number_id: 'P1' }, statuses: [{ id: 'x', status: 'read' }] } },
        { field: 'smb_message_echoes', value: { metadata: { phone_number_id: 'P1' }, message_echoes: [
          { from: '390000', to: '393331112222', id: 'wamid.3', type: 'text', text: { body: 'Ci penso io' } },
          { from: '390000', to: '393331112222', id: 'wamid.4', type: 'revoke', revoke: { original_message_id: 'wamid.3' } },
        ] } },
      ],
    }],
  };
  assert.deepEqual(estraiEventi(payload), [
    { tipo: 'messaggio', phoneNumberId: 'P1', telefono: '393331112222', testo: 'Buongiorno', waId: 'wamid.1' },
    { tipo: 'messaggio', phoneNumberId: 'P1', telefono: '393331112222', testo: 'Confermo', waId: 'wamid.2' },
    { tipo: 'eco_staff', phoneNumberId: 'P1', telefono: '393331112222', testo: 'Ci penso io', waId: 'wamid.3' },
  ]);
  assert.deepEqual(estraiEventi({}), []);
});

test('non-text messages still reach the assistant as readable text', () => {
  assert.equal(testoDaMessaggio({ type: 'audio' }), '[messaggio vocale]');
  assert.equal(testoDaMessaggio({ type: 'image', image: { caption: 'gengiva' } }), '[foto] gengiva');
  assert.equal(testoDaMessaggio({ type: 'interactive', interactive: { button_reply: { title: 'Devo spostarlo' } } }), 'Devo spostarlo');
});

test('history alternates roles, starts with the patient and ends with the new message', () => {
  const righe = [
    { direzione: 'out', origine: 'assistente', contenuto: 'Promemoria' }, // dropped: must start with user
    { direzione: 'in', contenuto: 'Ciao' },
    { direzione: 'in', contenuto: 'ho mal di denti' },
    { direzione: 'out', origine: 'assistente', contenuto: 'Mi dispiace' },
    { direzione: 'out', origine: 'staff', contenuto: 'La chiamo io' },
    { direzione: 'in', contenuto: '' },
  ];
  const storico = costruisciStorico(righe, 'Grazie');
  assert.deepEqual(storico, [
    { role: 'user', content: 'Ciao\nho mal di denti' },
    { role: 'assistant', content: "Mi dispiace\n[Scritto da una persona dello staff dello studio] La chiamo io" },
    { role: 'user', content: 'Grazie' },
  ]);
  assert.deepEqual(costruisciStorico([], ''), [{ role: 'user', content: '[messaggio vuoto]' }]);
});

test('the assistant pauses only while the staff pause is in the future', () => {
  const adesso = new Date('2026-10-02T10:00:00Z');
  assert.equal(inPausa(null, adesso), false);
  assert.equal(inPausa({ ai_pausa_fino: null }, adesso), false);
  assert.equal(inPausa({ ai_pausa_fino: '2026-10-02T09:59:00Z' }, adesso), false);
  assert.equal(inPausa({ ai_pausa_fino: pausaFinoA(adesso) }, adesso), true);
  assert.equal(pausaFinoA(adesso), '2026-10-02T14:00:00.000Z');
});

test('appointment requests from the model are validated before touching the agenda', () => {
  const oggi = '2026-10-02';
  assert.ok(validaRichiesta({ tipo: 'prenota', data: '2026-10-05', ora: '09:30' }, oggi).ok);
  assert.match(validaRichiesta({ tipo: 'conferma' }, oggi).errore, /tipo/);
  assert.match(validaRichiesta({ tipo: 'prenota', data: '2026-10-01', ora: '09:30' }, oggi).errore, /passato/);
  assert.match(validaRichiesta({ tipo: 'prenota', data: '2027-06-01', ora: '09:30' }, oggi).errore, /4 mesi/);
  assert.match(validaRichiesta({ tipo: 'prenota', data: '2026-10-05', ora: '9.30' }, oggi).errore, /ora/);
  assert.match(validaRichiesta({ tipo: 'sposta', data: '2026-10-05', ora: '09:30' }, oggi).errore, /appuntamento_id/);
  assert.ok(validaRichiesta({ tipo: 'disdici', appuntamento_id: 7 }, oggi).ok);
  assert.equal(validaDataDisponibilita('2026-10-03', oggi), null);
  assert.match(validaDataDisponibilita('domani', oggi), /formato/);
});

test("today's slots too close to now are not proposed", () => {
  const slots = [{ ora: '09:00' }, { ora: '10:00' }, { ora: '11:30' }];
  assert.deepEqual(filtraSlotOggi(slots, '2026-10-02', '2026-10-02', 9 * 60 + 45).map((s) => s.ora), ['11:30']);
  assert.equal(filtraSlotOggi(slots, '2026-10-03', '2026-10-02', 9 * 60 + 45).length, 3);
});

test('system prompt carries the Product Owner rules', () => {
  const p = promptDiSistema({ nomeStudio: 'Studio Bianchi', oggiIso: '2026-10-02', paziente: { nome: 'Mario', cognome: 'Rossi' } });
  assert.match(p, /Studio Bianchi/);
  assert.match(p, /Mario Rossi/);
  assert.match(p, /tu PROPONI, lo staff CONFERMA/);
  assert.match(p, /Non dai consigli clinici/);
  assert.match(p, /112/);
  const ignoto = promptDiSistema({ nomeStudio: 'X', oggiIso: '2026-10-02', paziente: null });
  assert.match(ignoto, /NON corrisponde a un paziente/);
});
