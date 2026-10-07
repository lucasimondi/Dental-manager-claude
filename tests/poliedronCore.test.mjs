import test from 'node:test';import assert from 'node:assert/strict';import {understandPoliedron,coreDecision,parseItalianTime} from '../supabase/functions/agente-assistente/poliedron-core.js';
test('understands agenda without LLM',()=>{const p=understandPoliedron('Fammi vedere gli appuntamenti di domani');assert.equal(p.intent,'AGENDA_READ');assert.equal(p.entities.relative_day,1);assert.equal(coreDecision(p).action,'EXECUTE_READ')});
test('asks only for missing agenda day',()=>{const p=understandPoliedron('fammi vedere agenda');assert.deepEqual(p.missing,['day']);assert.equal(coreDecision(p).action,'CLARIFY')});
test('understands patient search',()=>{const p=understandPoliedron('cerca paziente Mario Rossi');assert.equal(p.intent,'PATIENT_SEARCH');assert.equal(p.entities.query,'mario rossi')});
test('understands appointment creation entities',()=>{const p=understandPoliedron('crea appuntamento domani ore 14:30');assert.equal(p.intent,'APPOINTMENT_CREATE');assert.equal(p.entities.relative_day,1);assert.equal(p.entities.time,'14:30');assert.equal(coreDecision(p).action,'PREPARE_WRITE_CONFIRMATION')});
test('never guesses missing write data',()=>{const p=understandPoliedron('fissa appuntamento domani');assert.deepEqual(p.missing,['time']);assert.equal(coreDecision(p).action,'CLARIFY')});
test('invalid time is rejected',()=>assert.equal(parseItalianTime('ore 27:80'),null));
test('unknown language escalates',()=>assert.equal(coreDecision(understandPoliedron('sistemami un po tutto')).action,'ESCALATE_LLM'));
