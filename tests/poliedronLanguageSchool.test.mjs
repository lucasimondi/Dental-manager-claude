import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeItalianOperational,domainVocabulary} from '../supabase/functions/agente-assistente/poliedron-language.js';
import {ITALIAN_OPERATIONAL_EXAMPLES,LANGUAGE_SCHOOL_VERSION} from '../supabase/functions/agente-assistente/poliedron-language-data.js';
test('language school dataset is versioned',()=>{assert.equal(LANGUAGE_SCHOOL_VERSION,'1.0.0');assert.ok(ITALIAN_OPERATIONAL_EXAMPLES.length>=5)});
test('Italian paraphrases normalize to canonical operational language',()=>{assert.equal(normalizeItalianOperational('Prenota Mario Rossi domani ore 15 per una pulizia'),'fissa mario rossi domani ore 15 per igiene');assert.equal(normalizeItalianOperational('Metti Mario Rossi domani alle tre per igiene'),'fissa mario rossi domani alle 15 per igiene')});
test('domain vocabulary exposes synonyms',()=>{const v=domainVocabulary();assert.ok(v.hygiene.includes('pulizia'));assert.ok(v.create.includes('prenota'))});
test('normalization is deterministic',()=>{const q='  PRENOTA   Mario Rossi domani ore 15 per una pulizia  ';assert.equal(normalizeItalianOperational(q),normalizeItalianOperational(q))});
