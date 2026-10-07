import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('academy/scripts/generate-dental-it-v1.mjs','utf8');
test('factory is deterministic and writes only synthetic training split',()=>{
 assert.match(src,/split:'train_synthetic'/);
 assert.match(src,/source:'synthetic_factory_v1'/);
 assert.doesNotMatch(src,/Math\.random/);
});
test('factory teaches terminology, ambiguity, noise and protected actions',()=>{
 for(const token of ['TREATMENTS','hard-negative','typo','PROTECTED','AMBIGUOUS','NEEDS_DATA']) assert.ok(src.includes(token),token);
});
test('factory contains no production-data connector or network dependency',()=>{
 assert.doesNotMatch(src,/supabase|fetch\(|axios|https?:\/\//i);
});
