import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyAction,DECISION,CONFIDENCE_VERSION} from '../supabase/functions/agente-assistente/confidence.js';

test('verified domain action is HIGH without model self-confidence',()=>{
 const r=classifyAction({prepared:{dati:{paziente_id:7}}});
 assert.equal(r.decision,DECISION.HIGH); assert.equal(r.version,CONFIDENCE_VERSION);
});
test('domain warning becomes AMBIGUOUS',()=>{
 const r=classifyAction({prepared:{dati:{},avviso:'possible duplicate'}});
 assert.equal(r.decision,DECISION.AMBIGUOUS);
});
test('multiple authoritative targets become AMBIGUOUS',()=>{
 const r=classifyAction({error:new Error('Il paziente ha più piani: chiedi quale scegliere')});
 assert.equal(r.decision,DECISION.AMBIGUOUS);
});
test('missing authoritative data becomes NEEDS_DATA',()=>{
 const r=classifyAction({error:new Error('Piano non trovato: leggi prima lo storico')});
 assert.equal(r.decision,DECISION.NEEDS_DATA);
});
test('protected action always requires protection',()=>{
 const r=classifyAction({protectedAction:true,prepared:{dati:{}}});
 assert.equal(r.decision,DECISION.PROTECTED);
});
test('unsupported action is BLOCKED',()=>{
 const r=classifyAction({supported:false,prepared:{dati:{}}});
 assert.equal(r.decision,DECISION.BLOCKED);
});
