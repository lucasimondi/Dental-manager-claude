import test from 'node:test';
import assert from 'node:assert/strict';
import { understandPoliedron } from '../supabase/functions/agente-assistente/poliedron-core.js';
import { planPoliedron, confidenceDecision } from '../supabase/functions/agente-assistente/poliedron-planner.js';
test('agenda availability is parsed without LLM',()=>{const p=understandPoliedron('Ho spazio domani alle 15?');assert.equal(p.intent,'AGENDA_AVAILABILITY');assert.equal(p.entities.time,'15:00');assert.equal(p.entities.relative_day,1);assert.equal(confidenceDecision(p,planPoliedron(p)).decision,'EXECUTE')});
test('booking without appointment keyword parses patient and treatment',()=>{const p=understandPoliedron('Fissa Mario Rossi domani alle 15 per igiene');assert.equal(p.intent,'APPOINTMENT_CREATE');assert.equal(p.entities.patient_query,'mario rossi');assert.equal(p.entities.tipo,'igiene')});
test('missing time requires clarification',()=>{const p=understandPoliedron('Ho spazio domani?');assert.equal(p.intent,'AGENDA_AVAILABILITY');assert.deepEqual(p.missing,['time'])});
