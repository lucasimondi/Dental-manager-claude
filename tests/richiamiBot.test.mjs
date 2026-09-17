import test from 'node:test';
import assert from 'node:assert/strict';
import { generaRichiamiBot } from '../src/lib/richiamiBot.js';

// Product Owner: "c'è capraro con incasso in standby, ma non è in standby,
// e sono due capraro, poi Lauretti anche doppio con incasso in stand by, in
// effetti ha 100 euro da dare ancora quindi dovrebbe essere un solo
// Lauretti e con 100 euro da dare... deve generarsi un solo richiamo...
// ho annullato appuntamento di fabio distefano, non ha generato un
// richiamo che dica che deve fare otturazione".

const paz = { id: 1, nome: 'Massimo', cognome: 'Capraro' };
const base = { patients: [paz], plans: [], payments: [], appointments: [], richiami: [] };

test('rule 4 (executed, not yet billed) produces ONE proposal per plan, not one per voce — reproduces the exact Capraro/Lauretti duplication', () => {
  const plans = [{
    id: 10, pazienteId: 1, voci: [
      { prestazione: 'Estrazione complessa', prezzo: 75, eseguita: true, incassata: false, dataEsec: '2020-01-01' },
      { prestazione: 'Estrazione complessa', prezzo: 75, eseguita: true, incassata: false, dataEsec: '2020-01-01' },
    ],
  }];
  const { proposte } = generaRichiamiBot({ ...base, plans });
  assert.equal(proposte.length, 1);
  assert.equal(proposte[0].categoria, 'da_fatturare');
  assert.equal(proposte[0].chiaveBot, 'plan_incasso:10');
  assert.match(proposte[0].motivo, /€ 150\.00 da fatturare/); // sums both voci (75 + 75)
});

test('rule 4 uses its own "da_fatturare" categoria, not "incasso" (which now means a genuinely suspended payment) — fixes the false "in standby" reading', () => {
  const plans = [{ id: 10, pazienteId: 1, voci: [{ prestazione: 'X', prezzo: 100, eseguita: true, incassata: false, dataEsec: '2020-01-01' }] }];
  const { proposte } = generaRichiamiBot({ ...base, plans });
  assert.equal(proposte[0].categoria, 'da_fatturare');
  assert.notEqual(proposte[0].categoria, 'incasso');
});

test('a plan whose voci are ALL già incassate produces no proposal — the real Capraro state after the fix', () => {
  const plans = [{
    id: 10, pazienteId: 1, voci: [
      { prestazione: 'Estrazione complessa', prezzo: 75, eseguita: true, incassata: true, dataEsec: '2020-01-01' },
      { prestazione: 'Estrazione complessa', prezzo: 75, eseguita: true, incassata: true, dataEsec: '2020-01-01' },
    ],
  }];
  const { proposte } = generaRichiamiBot({ ...base, plans });
  assert.deepEqual(proposte, []);
});

test('legacy per-voce richiami (plan_voce_incasso:planId:i) are always swept away — the stale Capraro/Lauretti rows that never closed', () => {
  const plans = [{
    id: 10, pazienteId: 1, voci: [
      { prestazione: 'Estrazione complessa', prezzo: 75, eseguita: true, incassata: true, dataEsec: '2020-01-01' },
      { prestazione: 'Estrazione complessa', prezzo: 75, eseguita: true, incassata: true, dataEsec: '2020-01-01' },
    ],
  }];
  const richiami = [
    { id: 9, pazienteId: 1, categoria: 'incasso', stato: 'da_fare', origine: 'bot', chiaveBot: 'plan_voce_incasso:10:0' },
    { id: 10, pazienteId: 1, categoria: 'incasso', stato: 'da_fare', origine: 'bot', chiaveBot: 'plan_voce_incasso:10:1' },
  ];
  const { proposte, daRimuovere } = generaRichiamiBot({ ...base, plans, richiami });
  assert.deepEqual(proposte, []);
  assert.deepEqual(daRimuovere.sort((a, b) => a - b), [9, 10]);
});

test('legacy rows are swept AND replaced by exactly one consolidated proposal when the plan still genuinely needs billing', () => {
  const plans = [{
    id: 8, pazienteId: 1, voci: [
      { prestazione: 'Impianto osteointegrato', prezzo: 500, eseguita: true, incassata: false, dataEsec: '2020-01-01' },
      { prestazione: 'Impianto osteointegrato', prezzo: 500, eseguita: true, incassata: false, dataEsec: '2020-01-01' },
    ],
  }];
  const richiami = [
    { id: 4, pazienteId: 1, categoria: 'incasso', stato: 'da_fare', origine: 'bot', chiaveBot: 'plan_voce_incasso:8:0' },
    { id: 5, pazienteId: 1, categoria: 'incasso', stato: 'da_fare', origine: 'bot', chiaveBot: 'plan_voce_incasso:8:1' },
  ];
  const { proposte, daRimuovere } = generaRichiamiBot({ ...base, plans, richiami });
  assert.equal(proposte.length, 1);
  assert.equal(proposte[0].chiaveBot, 'plan_incasso:8');
  assert.deepEqual(daRimuovere.sort((a, b) => a - b), [4, 5]);
});

test('an open "plan_incasso" richiamo auto-closes once all its voci become incassata (no more staying open forever)', () => {
  const plans = [{ id: 10, pazienteId: 1, voci: [{ prestazione: 'X', prezzo: 75, eseguita: true, incassata: true, dataEsec: '2020-01-01' }] }];
  const richiami = [{ id: 99, pazienteId: 1, categoria: 'da_fatturare', stato: 'da_fare', origine: 'bot', chiaveBot: 'plan_incasso:10' }];
  const { daRimuovere } = generaRichiamiBot({ ...base, plans, richiami });
  assert.deepEqual(daRimuovere, [99]);
});

test('an open "plan_standby" richiamo auto-closes once the plan is no longer "attivo" (accepted or rejected)', () => {
  const plans = [{ id: 20, pazienteId: 1, stato: 'accettato', data: '2020-01-01', voci: [] }];
  const richiami = [{ id: 100, pazienteId: 1, categoria: 'preventivo', stato: 'da_fare', origine: 'bot', chiaveBot: 'plan_standby:20' }];
  const { daRimuovere } = generaRichiamiBot({ ...base, plans, richiami });
  assert.deepEqual(daRimuovere, [100]);
});

test('an open "payment_standby" richiamo auto-closes once the payment is no longer "sospeso"', () => {
  const payments = [{ id: 30, pazienteId: 1, stato: 'pagato', data: '2020-01-01', importo: 50 }];
  const richiami = [{ id: 101, pazienteId: 1, categoria: 'incasso', stato: 'da_fare', origine: 'bot', chiaveBot: 'payment_standby:30' }];
  const { daRimuovere } = generaRichiamiBot({ ...base, payments, richiami });
  assert.deepEqual(daRimuovere, [101]);
});

// ── Rule 5: appuntamento annullato / trattamento accettato senza nulla in agenda ──

test('rule 5 fires immediately when there is an "annullato" appointment on record for the patient — the reported Fabio Di Stefano scenario', () => {
  const plans = [{ id: 29, pazienteId: 1, stato: 'accettato', data: today(), voci: [{ prestazione: 'Otturazione', prezzo: 100, eseguita: false }] }];
  const appointments = [{ id: 122, pazienteId: 1, data: '2020-01-01', stato: 'annullato' }];
  const { proposte } = generaRichiamiBot({ ...base, plans, appointments });
  assert.equal(proposte.length, 1);
  assert.equal(proposte[0].chiaveBot, 'appt_cancel_pending:29:0');
  assert.match(proposte[0].motivo, /Otturazione/);
  assert.match(proposte[0].motivo, /annullato/);
});

test('rule 5 never fires for a plan the patient has not accepted (e.g. "rifiutato") — a declined treatment is not "falling through the cracks"', () => {
  const plans = [{ id: 29, pazienteId: 1, stato: 'rifiutato', data: '2000-01-01', voci: [{ prestazione: 'Otturazione', prezzo: 100, eseguita: false }] }];
  const appointments = [{ id: 122, pazienteId: 1, data: '2020-01-01', stato: 'annullato' }];
  const { proposte } = generaRichiamiBot({ ...base, plans, appointments });
  assert.deepEqual(proposte, []);
});

test('rule 5 falls back to a staleness check (no annullato evidence needed) so a hard-deleted appointment — which leaves no trace at all — is still caught eventually', () => {
  const plans = [{ id: 29, pazienteId: 1, stato: 'accettato', data: '2000-01-01', voci: [{ prestazione: 'Otturazione', prezzo: 100, eseguita: false }] }];
  const { proposte } = generaRichiamiBot({ ...base, plans, appointments: [] });
  assert.equal(proposte.length, 1);
  assert.doesNotMatch(proposte[0].motivo, /annullato/);
});

test('rule 5 does NOT fire for a freshly-accepted plan with no annullato evidence — avoids nagging before the first appointment is even booked', () => {
  const plans = [{ id: 29, pazienteId: 1, stato: 'accettato', data: today(), voci: [{ prestazione: 'Otturazione', prezzo: 100, eseguita: false }] }];
  const { proposte } = generaRichiamiBot({ ...base, plans, appointments: [] });
  assert.deepEqual(proposte, []);
});

test('rule 5 does not fire when the patient already has an active future appointment', () => {
  const future = addDays(today(), 5);
  const plans = [{ id: 29, pazienteId: 1, stato: 'accettato', data: '2000-01-01', voci: [{ prestazione: 'Otturazione', prezzo: 100, eseguita: false }] }];
  const appointments = [{ id: 1, pazienteId: 1, data: future, stato: 'confermato' }];
  const { proposte } = generaRichiamiBot({ ...base, plans, appointments });
  assert.deepEqual(proposte, []);
});

test('an open "appt_cancel_pending" richiamo auto-closes once the patient gets an active future appointment booked', () => {
  const future = addDays(today(), 5);
  const plans = [{ id: 29, pazienteId: 1, stato: 'accettato', data: '2000-01-01', voci: [{ prestazione: 'Otturazione', prezzo: 100, eseguita: false }] }];
  const appointments = [{ id: 2, pazienteId: 1, data: future, stato: 'confermato' }];
  const richiami = [{ id: 200, pazienteId: 1, categoria: 'clinico', stato: 'da_fare', origine: 'bot', chiaveBot: 'appt_cancel_pending:29:0' }];
  const { daRimuovere } = generaRichiamiBot({ ...base, plans, appointments, richiami });
  assert.deepEqual(daRimuovere, [200]);
});

test('an open "appt_cancel_pending" richiamo auto-closes once the treatment is actually done', () => {
  const plans = [{ id: 29, pazienteId: 1, stato: 'accettato', data: '2000-01-01', voci: [{ prestazione: 'Otturazione', prezzo: 100, eseguita: true }] }];
  const richiami = [{ id: 201, pazienteId: 1, categoria: 'clinico', stato: 'da_fare', origine: 'bot', chiaveBot: 'appt_cancel_pending:29:0' }];
  const { daRimuovere } = generaRichiamiBot({ ...base, plans, richiami });
  assert.deepEqual(daRimuovere, [201]);
});

function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
