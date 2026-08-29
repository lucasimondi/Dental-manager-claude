import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generaRichiamiBot } from '../src/lib/richiamiBot.js';

// Product Owner follow-up (payments/incassi architecture audit): the
// "prestazione eseguita e non ancora incassata" reminder used to trust the
// legacy per-item "incassata" flag, disconnected from real payments. It
// must now agree with the canonical get_saldi_aperti_studio RPC
// (eseguito_non_pagato) — the same source Dashboard/Incassi/SchedaPaz use —
// so the same real-world situation is never reported differently in two
// places.

const patients = [{ id: 1, nome: 'Mario', cognome: 'Rossi' }];
const appointments = [];
const richiami = [];

const oldDate = '2020-01-01'; // far beyond STANDBY_ESEGUITA_GIORNI (30gg)

test('a legacy-marked "incassata" item whose plan STILL shows eseguito_non_pagato > 0 in the real saldi is still reported', () => {
  const plans = [{ id: 'p1', pazienteId: 1, titolo: 'Piano', stato: 'attivo', voci: [
    { prestazione: 'Devitalizzazione', dente: '', prezzo: 200, eseguita: true, incassata: true, dataEsec: oldDate },
  ] }];
  const saldiAperti = [{ piano_id: 'p1', paziente_id: 1, eseguito_non_pagato: 200 }];
  const { proposte } = generaRichiamiBot({ patients, plans, payments: [], appointments, richiami, saldiAperti });
  assert.ok(proposte.some((p) => p.chiaveBot === 'plan_voce_incasso:p1:0'), 'expected the reminder even though the legacy flag says incassata');
});

test('an item still flagged "incassata: false" but whose plan real saldo is fully paid (no open row) is NOT reported', () => {
  const plans = [{ id: 'p2', pazienteId: 1, titolo: 'Piano', stato: 'attivo', voci: [
    { prestazione: 'Otturazione', dente: '', prezzo: 80, eseguita: true, incassata: false, dataEsec: oldDate },
  ] }];
  // No row for p2 in saldiAperti at all == saldo_piano <= 0 == fully reconciled.
  const saldiAperti = [];
  const { proposte } = generaRichiamiBot({ patients, plans, payments: [], appointments, richiami, saldiAperti });
  assert.equal(proposte.some((p) => p.chiaveBot === 'plan_voce_incasso:p2:0'), false);
});

test('missing saldiAperti argument defaults to empty and never throws', () => {
  const plans = [{ id: 'p3', pazienteId: 1, titolo: 'Piano', stato: 'attivo', voci: [
    { prestazione: 'Otturazione', dente: '', prezzo: 80, eseguita: true, incassata: false, dataEsec: oldDate },
  ] }];
  assert.doesNotThrow(() => generaRichiamiBot({ patients, plans, payments: [], appointments, richiami }));
});

test('App.jsx fetches the canonical studio-wide open balances once and feeds them into generaRichiamiBot', () => {
  const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /import \{ fetchSaldiPiani, fetchSaldiApertiStudio \} from '\.\/lib\/domain\/incassiService\.js';/);
  assert.match(appSource, /const \[saldiApertiStudio, setSaldiApertiStudio\] = useState\(\[\]\);/);
  assert.match(appSource, /fetchSaldiApertiStudio\(studioId\)/);
  assert.match(appSource, /generaRichiamiBot\(\{ patients, plans, payments, appointments, richiami, saldiAperti: saldiApertiStudio \}\)/);
});
