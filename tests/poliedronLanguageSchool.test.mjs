import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeItalianOperational,domainVocabulary} from '../supabase/functions/agente-assistente/poliedron-language.js';
import {ITALIAN_OPERATIONAL_EXAMPLES,LANGUAGE_SCHOOL_VERSION} from '../supabase/functions/agente-assistente/poliedron-language-data.js';
import {understandPoliedron} from '../supabase/functions/agente-assistente/poliedron-core.js';
test('language school dataset is versioned',()=>{assert.equal(LANGUAGE_SCHOOL_VERSION,'2.0.0');assert.ok(ITALIAN_OPERATIONAL_EXAMPLES.length>=5)});
test('Italian paraphrases normalize to canonical operational language',()=>{assert.equal(normalizeItalianOperational('Prenota Mario Rossi domani ore 15 per una pulizia'),'fissa mario rossi domani ore 15 per igiene');assert.equal(normalizeItalianOperational('Metti Mario Rossi domani alle tre per igiene'),'fissa mario rossi domani alle 15 per igiene')});
test('domain vocabulary exposes synonyms',()=>{const v=domainVocabulary();assert.ok(v.hygiene.includes('pulizia'));assert.ok(v.create.includes('prenota'))});
test('normalization is deterministic',()=>{const q='  PRENOTA   Mario Rossi domani ore 15 per una pulizia  ';assert.equal(normalizeItalianOperational(q),normalizeItalianOperational(q))});
test('Core understands taught Italian appointment paraphrases',()=>{const p=understandPoliedron('Prenota un appuntamento per Mario Rossi domani ore 15 per una pulizia');assert.equal(p.intent,'APPOINTMENT_CREATE');assert.equal(p.entities.patient_query,'mario rossi');assert.equal(p.entities.tipo,'igiene');assert.deepEqual(p.missing,[])});
