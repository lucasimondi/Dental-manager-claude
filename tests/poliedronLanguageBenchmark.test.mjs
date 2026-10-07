import test from 'node:test';import assert from 'node:assert/strict';
import {matchItalianIntent} from '../supabase/functions/agente-assistente/poliedron-language-matcher.js';
const cases=[
 ['che pazienti vedo domani','AGENDA_READ'],['domani chi viene','AGENDA_READ'],
 ['vai sulla scheda di Mario Rossi','PATIENT_SEARCH'],['cercami Mario Rossi','PATIENT_SEARCH'],
 ['chi devo ricontattare','RECALLS_READ'],['pazienti da richiamare','RECALLS_READ'],
 ['quanto stiamo producendo','KPI_READ'],['come siamo messi questo mese','KPI_READ'],
 ['blocca Mario Rossi domani alle 15 per igiene','APPOINTMENT_CREATE'],
 ['segna Mario Rossi domani alle 15 per igiene','APPOINTMENT_CREATE']
];
test('language replay benchmark classifies curated Italian paraphrases',()=>{for(const [q,want] of cases){const got=matchItalianIntent(q);assert.equal(got.intent,want,q);assert.ok(got.accepted,q)}});
test('language matcher refuses weak or ambiguous unrelated language',()=>{for(const q of ['ciao come va','scrivimi una poesia','forse quello di prima'])assert.equal(matchItalianIntent(q).accepted,false,q)});
