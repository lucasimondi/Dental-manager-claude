import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
test('Academy synthetic and holdout sets stay separate',()=>{
 const train=read('academy/datasets/synthetic/dental-it-v1.jsonl');
 const exam=read('academy/datasets/exam/dental-it-holdout-v1.jsonl');
 assert.ok(train.length>=6); assert.ok(exam.length>=3);
 assert.ok(train.every(x=>x.split==='train_synthetic'));
 assert.ok(exam.every(x=>x.split==='exam_holdout'));
 const seen=new Set(train.map(x=>x.utterance.trim().toLocaleLowerCase('it-IT')));
 assert.ok(exam.every(x=>!seen.has(x.utterance.trim().toLocaleLowerCase('it-IT'))));
});
test('Academy includes ambiguity and protected-action teaching cases',()=>{
 const all=[...read('academy/datasets/synthetic/dental-it-v1.jsonl'),...read('academy/datasets/exam/dental-it-holdout-v1.jsonl')];
 assert.ok(all.some(x=>x.expected.decision==='AMBIGUOUS'));
 assert.ok(all.some(x=>x.expected.decision==='PROTECTED'));
 assert.ok(all.some(x=>x.tags.includes('hard-negative')));
});
