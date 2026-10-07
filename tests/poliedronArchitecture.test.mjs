import test from 'node:test';import assert from 'node:assert/strict';
import {understandPoliedron} from '../supabase/functions/agente-assistente/poliedron-core.js';
import {deriveContext,enrichWithContext} from '../supabase/functions/agente-assistente/poliedron-context.js';
import {planPoliedron,confidenceDecision} from '../supabase/functions/agente-assistente/poliedron-planner.js';
test('context carries an explicitly searched patient into a later command',()=>{const ctx=deriveContext([{role:'user',content:'cerca paziente Mario Rossi'},{role:'assistant',content:'Mario Rossi'}]);const p=enrichWithContext(understandPoliedron('crea appuntamento domani ore 15 per igiene'),ctx);assert.equal(p.entities.patient_query,'mario rossi');assert.ok(!p.missing.includes('patient'))});
test('planner makes write safety stages explicit',()=>{const p=understandPoliedron('crea appuntamento per Mario Rossi domani ore 15 per igiene');const plan=planPoliedron(p);assert.deepEqual(plan.steps.map(x=>x.action),['SEARCH_PATIENT','RESOLVE_PATIENT','CHECK_AVAILABILITY','PREPARE_APPOINTMENT','CONFIRM','WRITE_APPOINTMENT','VERIFY_WRITE']);assert.equal(confidenceDecision(p,plan).decision,'PREPARE_CONFIRM')});
test('missing slots stop before planning a write',()=>{const p=understandPoliedron('crea appuntamento domani ore 15');assert.equal(confidenceDecision(p,planPoliedron(p)).decision,'CLARIFY')});
test('unknown language escalates instead of guessing',()=>{const p=understandPoliedron('fai quella cosa di prima');assert.equal(confidenceDecision(p,planPoliedron(p)).decision,'ESCALATE')});
