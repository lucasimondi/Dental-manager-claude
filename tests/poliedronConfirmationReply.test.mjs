import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decisioneConferma } from '../src/lib/poliedron/confirmationReply.js';

test('short typed replies decide a pending confirmation', () => {
  for (const t of ['sì', 'Si', 'ok', 'OK!', 'confermo', 'procedi', 'va bene', 'certo 👍']) assert.equal(decisioneConferma(t), 'conferma', t);
  for (const t of ['no', 'No.', 'annulla', 'non procedere', 'lascia stare']) assert.equal(decisioneConferma(t), 'annulla', t);
});

test('a new request is never mistaken for a yes or a no', () => {
  for (const t of ['sì, ma alle 11', 'ok spostalo a giovedì', 'nome del paziente?', 'no, fissalo martedì', '', null]) {
    assert.equal(decisioneConferma(t), null, String(t));
  }
});

test('the chat routes a typed decision to the same confirmation handler as the buttons', () => {
  const src = readFileSync(new URL('../src/components/poliedron/Poliedron.jsx', import.meta.url), 'utf8');
  assert.match(src, /chatStructuredStateRef\.current\?\.modelConfirmation/);
  assert.match(src, /modelConfirmationRef\.current\?\.\(pendingConfirmation, decisione === 'annulla', true\)/);
  assert.match(src, /modelConfirmationRef\.current = handleModelConfirmation;/);
});

test('an expired or invalid confirmation answers plainly and writes nothing', () => {
  const src = readFileSync(new URL('../supabase/functions/agente-assistente/index.ts', import.meta.url), 'utf8');
  assert.match(src, /catch \(error\) \{\s*\/\/ Expired\/invalid\/no-longer-allowed[^\n]*\n\s*return json\(\{ text: `\$\{error\.message\} Nessuna modifica eseguita\.` \}\);/);
});
