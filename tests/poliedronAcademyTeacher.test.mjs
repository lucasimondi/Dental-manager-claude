import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const prompt=fs.readFileSync('academy/teacher/system-prompt-v1.md','utf8');
const batch=fs.readFileSync('academy/scripts/build-teacher-batch.mjs','utf8');
const validator=fs.readFileSync('academy/scripts/validate-candidates.mjs','utf8');

test('teacher preserves labels and ambiguity',()=>{
 assert.match(prompt,/Preserve the source example's intended meaning and labels/);
 assert.match(prompt,/Never resolve an ambiguity/);
 assert.match(batch,/locked_expected:x\.expected/);
});
test('teacher is provider-neutral and candidates retain provenance',()=>{
 assert.match(validator,/teacher\?\.provider/);
 assert.match(validator,/teacher\?\.model/);
 assert.doesNotMatch(batch,/openai|anthropic|gemini|claude/i);
});
test('teacher batch never points at holdout exam by default',()=>{
 assert.match(batch,/datasets\/synthetic/);
 assert.doesNotMatch(batch,/datasets\/exam/);
});
