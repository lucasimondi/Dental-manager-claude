import test from 'node:test';import assert from 'node:assert/strict';
import {deriveConversationState,completeConversationalTurn} from '../supabase/functions/agente-assistente/poliedron-conversation.js';

test('conversation fills missing appointment slots without repeating the command',()=>{
 const messages=[{role:'user',content:'Fissa un appuntamento per Mario Rossi domani'},{role:'assistant',content:'A che ora e per cosa?'}];
 const state=deriveConversationState(messages);const p=completeConversationalTurn('alle 15, igiene',state);
 assert.equal(p.intent,'APPOINTMENT_CREATE');assert.equal(p.entities.patient_query,'mario rossi');assert.equal(p.entities.time,'15:00');assert.equal(p.entities.tipo,'igiene');assert.deepEqual(p.missing,[]);
});
test('conversation keeps asking only for fields still missing',()=>{
 const state=deriveConversationState([{role:'user',content:'Fissa un appuntamento per Mario Rossi domani'}]);
 const p=completeConversationalTurn('alle 15',state);assert.deepEqual(p.missing,['type']);
});
test('conversation does not invent patient identity from a follow-up',()=>{
 const state=deriveConversationState([{role:'user',content:'Crea appuntamento domani ore 15 per igiene'}]);
 const p=completeConversationalTurn('va bene quello',state);assert.ok(p.intent==='UNKNOWN'||p.missing.includes('patient'),'never executable without an identified patient');assert.equal(p.entities.patient_query,undefined);
});
test('unrelated conversation without pending task stays unknown',()=>{assert.equal(completeConversationalTurn('va bene quello',{pending:null}).intent,'UNKNOWN')});
