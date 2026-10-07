import test from 'node:test';import assert from 'node:assert/strict';import {understandPoliedron,coreDecision,parseItalianTime} from '../supabase/functions/agente-assistente/poliedron-core.js';
test('understands agenda without LLM',()=>{const p=understandPoliedron('Fammi vedere gli appuntamenti di domani');assert.equal(p.intent,'AGENDA_READ');assert.equal(p.entities.relative_day,1);assert.equal(coreDecision(p).action,'EXECUTE_READ')});
test('asks only for missing agenda day',()=>{const p=understandPoliedron('fammi vedere agenda');assert.deepEqual(p.missing,['day']);assert.equal(coreDecision(p).action,'CLARIFY')});
test('understands patient search',()=>{const p=understandPoliedron('cerca paziente Mario Rossi');assert.equal(p.intent,'PATIENT_SEARCH');assert.equal(p.entities.query,'mario rossi')});
test('understands appointment creation entities',()=>{const p=understandPoliedron('crea appuntamento domani ore 14:30');assert.equal(p.intent,'APPOINTMENT_CREATE');assert.equal(p.entities.relative_day,1);assert.equal(p.entities.time,'14:30');assert.equal(coreDecision(p).action,'PREPARE_WRITE_CONFIRMATION')});
test('never guesses missing write data',()=>{const p=understandPoliedron('fissa appuntamento domani');assert.deepEqual(p.missing,['time']);assert.equal(coreDecision(p).action,'CLARIFY')});
test('invalid time is rejected',()=>assert.equal(parseItalianTime('ore 27:80'),null));
test('unknown language escalates',()=>assert.equal(coreDecision(understandPoliedron('sistemami un po tutto')).action,'ESCALATE_LLM'));

test('routine reads remain core-first candidates',()=>{for(const q of ['agenda domani','cerca paziente Luca Rossi','richiami','fatturato']){const p=understandPoliedron(q);assert.equal(coreDecision(p).action,'EXECUTE_READ')}});
test('writes never execute directly in Core v1',()=>{for(const q of ['crea appuntamento domani ore 15','sposta appuntamento domani ore 16','cancella appuntamento']){const d=coreDecision(understandPoliedron(q));assert.notEqual(d.action,'EXECUTE_READ')}});

test('extracts a complete autonomous appointment write',()=>{const p=understandPoliedron('crea appuntamento per Mario Rossi domani ore 14:30 per igiene');assert.equal(p.intent,'APPOINTMENT_CREATE');assert.equal(p.entities.patient_query,'mario rossi');assert.equal(p.entities.relative_day,1);assert.equal(p.entities.time,'14:30');assert.equal(p.entities.tipo,'igiene');assert.deepEqual(p.missing,[]);assert.equal(coreDecision(p).action,'PREPARE_WRITE_CONFIRMATION')});
test('appointment write refuses to guess patient or visit type',()=>{const p=understandPoliedron('crea appuntamento domani ore 14:30');assert.ok(p.missing.includes('patient'));assert.ok(p.missing.includes('type'));assert.equal(coreDecision(p).action,'CLARIFY')});
