import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  costruisciStorico, dataOggiStudio, estraiEventi, filtraSlotOggi, inPausa, pausaFinoA,
  promptDiSistema, testoDaMessaggio, validaDataDisponibilita, validaRichiesta, minutiAdessoStudio,
  dataDomaniStudio, oraAdessoStudio, normalizzaTelefono, parametriPromemoria, testoPromemoria,
  esitoRispostaPromemoria, testoConfermaStaff,
} from '../supabase/functions/whatsapp-webhook/logica.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Edge Function and app share the same authoritative slot calculator', async () => {
  const edge = await import('../supabase/functions/whatsapp-webhook/agendaSlots.js');
  const app = await import('../src/lib/agendaSlots.js');
  assert.equal(edge.computeFreeSlots, app.computeFreeSlots);
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
    { tipo: 'messaggio', phoneNumberId: 'P1', telefono: '393331112222', testo: 'Buongiorno', waId: 'wamid.1', rispostaA: null },
    { tipo: 'messaggio', phoneNumberId: 'P1', telefono: '393331112222', testo: 'Confermo', waId: 'wamid.2', rispostaA: null },
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

// ── POL-WA-003b ─────────────────────────────────────────────────────────
test('tomorrow and the current hour follow the studio time zone', () => {
  // 22:30 UTC on 31 Oct = 23:30 on 31 Oct in Rome (CET after the switch)
  const t = new Date('2026-10-31T22:30:00Z');
  assert.equal(dataDomaniStudio(t), '2026-11-01');
  assert.equal(oraAdessoStudio(t), 23);
  // 23:30 UTC on 1 Oct is already 2 Oct in Rome, so tomorrow is 3 Oct
  assert.equal(dataDomaniStudio(new Date('2026-10-01T23:30:00Z')), '2026-10-03');
  assert.equal(oraAdessoStudio(new Date('2026-10-01T23:30:00Z')), 1);
});

test('phone numbers from the patient record become Meta format or null', () => {
  assert.equal(normalizzaTelefono('+39 333 111 2222'), '393331112222');
  assert.equal(normalizzaTelefono('0039 333-111-2222'), '393331112222');
  assert.equal(normalizzaTelefono('333 1112222'), '393331112222');
  assert.equal(normalizzaTelefono('+41 79 123 45 67'), '41791234567');
  assert.equal(normalizzaTelefono('02 1234567'), null);
  assert.equal(normalizzaTelefono(''), null);
  assert.equal(normalizzaTelefono(null), null);
  assert.equal(normalizzaTelefono('1234567890123456'), null);
});

test('reminder parameters match the Meta template text', () => {
  const p = parametriPromemoria({ nome: 'Mario', nomeStudio: 'Studio Bianchi', data: '2026-10-05', ora: '09:30' });
  assert.deepEqual(p, ['Mario', 'Studio Bianchi', 'domani, lunedì 5 ottobre', '09:30']);
  assert.equal(
    testoPromemoria(p),
    'Gentile Mario, le ricordiamo il suo appuntamento presso Studio Bianchi per domani, lunedì 5 ottobre alle ore 09:30. Se non può venire, ci avvisi rispondendo a questo messaggio o chiamando lo studio. Grazie.',
  );
  assert.deepEqual(parametriPromemoria({ data: '2026-10-05', ora: '09:30' }).slice(0, 2), ['gentile paziente', 'il nostro studio']);
});

test('reminder replies are classified without guessing', () => {
  for (const t of ['Confermo', 'confermato!', 'Ok', 'ok grazie', 'Va bene', 'Sì', 'si, a domani', 'Ci sarò 👍']) {
    assert.equal(esitoRispostaPromemoria(t), 'confermato', t);
  }
  for (const t of ['Devo spostarlo', 'Posso cambiare orario?', 'Non posso venire', 'non riesco', 'vorrei disdire... anzi disdico', 'Annullo']) {
    assert.equal(esitoRispostaPromemoria(t), 'da_spostare', t);
  }
  for (const t of ['Okkupato', 'Simone', 'A che ora apre lo studio?', '', null]) {
    assert.equal(esitoRispostaPromemoria(t), null, String(t));
  }
});

test('staff confirmation texts are fixed per request type', () => {
  const base = { nome: 'Mario', nomeStudio: 'Studio Bianchi', data: '2026-10-05', ora: '09:30' };
  assert.equal(testoConfermaStaff({ ...base, tipo: 'prenota' }),
    "Gentile Mario, le confermiamo l'appuntamento di lunedì 5 ottobre alle 09:30. A presto! Lo studio Studio Bianchi");
  assert.match(testoConfermaStaff({ ...base, tipo: 'sposta' }), /l'appuntamento è stato spostato a lunedì 5 ottobre alle 09:30/);
  assert.match(testoConfermaStaff({ ...base, tipo: 'disdici' }), /abbiamo annullato il suo appuntamento di lunedì 5 ottobre alle 09:30/);
  assert.match(testoConfermaStaff({ tipo: 'prenota', data: '2026-10-05', ora: '09:30' }), /^Buongiorno, .*Lo studio$/);
});

test('button replies keep the id of the reminder they answer', () => {
  const [e] = estraiEventi({ entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: 'P1' }, messages: [
    { from: '393331112222', id: 'wamid.9', type: 'button', button: { text: 'Confermo' }, context: { id: 'wamid.promemoria' } },
  ] } }] }] });
  assert.equal(e.rispostaA, 'wamid.promemoria');
  assert.equal(e.testo, 'Confermo');
});
