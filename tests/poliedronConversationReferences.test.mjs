import test from 'node:test';import assert from 'node:assert/strict';
import {conversationalReference} from '../supabase/functions/agente-assistente/poliedron-conversation.js';

test('spostalo resolves exactly one observed appointment',()=>{const r=conversationalReference('spostalo domani alle 16',{observed_appointments:[{id:42}]});assert.equal(r.kind,'APPOINTMENT_MOVE');assert.equal(r.appointment_id,42);assert.equal(r.relative_day,1);assert.equal(r.time,'16:00');assert.deepEqual(r.missing,[])});
test('spostalo never guesses between appointments',()=>{const r=conversationalReference('spostalo domani alle 16',{observed_appointments:[{id:42},{id:43}]});assert.equal(r.kind,'AMBIGUOUS_REFERENCE');assert.equal(r.target,'appointment')});
test('spostalo asks for missing date instead of inventing it',()=>{const r=conversationalReference('spostalo alle 16',{observed_appointments:[{id:42}]});assert.equal(r.kind,'APPOINTMENT_MOVE');assert.deepEqual(r.missing,['day'])});
test('cancellalo never guesses a target',()=>{assert.equal(conversationalReference('cancellalo',{observed_appointments:[]}).kind,'AMBIGUOUS_REFERENCE')});
test('explicit correction is captured as correction, not silently learned',()=>{const r=conversationalReference('No, intendevo quello di prima',{});assert.equal(r.kind,'CORRECTION');assert.match(r.text,/intendevo/)});
test('ordinary unrelated language is not forced into a reference',()=>{assert.equal(conversationalReference('come va oggi?',{}).kind,'NONE')});
