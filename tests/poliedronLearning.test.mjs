import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningEvent,assertLearningEventSafe,LEARNING_EVENT_VERSION} from '../supabase/functions/agente-assistente/learning.js';

test('learning event contains structured metadata but no raw prompt',()=>{
 const e=buildLearningEvent({action:'aggiungi_prestazione_piano',decision:{decision:'HIGH',reason:'authoritative_checks_passed',version:'v1',factors:{supported:true,domain_validated:true}},entity_types:['patient','plan','treatment'],match_counts:{patient:1,plan:1},outcome:'executed'});
 assert.equal(e.schema_version,LEARNING_EVENT_VERSION); assert.equal(e.match_counts.patient,1);
 assert.equal('raw_prompt' in e,false); assertLearningEventSafe(e);
});
test('learning event stores correction as intent delta only',()=>{
 const e=buildLearningEvent({action:'unknown',decision:{decision:'AMBIGUOUS'},correction:{from_intent:'create_plan',to_intent:'add_treatment'}});
 assert.deepEqual(e.correction,{kind:'corrected',from_intent:'create_plan',to_intent:'add_treatment'});
});
test('safety assertion rejects forbidden raw-data fields if contract is bypassed',()=>{
 assert.throws(()=>assertLearningEventSafe({raw_chat:'x'}),/forbidden/);
});
