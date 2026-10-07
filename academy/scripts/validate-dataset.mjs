import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('academy/datasets');
const allowedSplits=new Set(['train_synthetic','train_governed','eval_dev','exam_holdout']);
const allowedDecisions=new Set(['HIGH','NEEDS_DATA','AMBIGUOUS','BLOCKED','PROTECTED']);
const forbiddenKeys=new Set(['patient_id','paziente_id','studio_id','user_id','raw_chat','raw_prompt','diagnosis','diagnosi','clinical_note','prescription','document_text']);

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith('.jsonl')?[path.join(dir,e.name)]:[])}
function keysDeep(v,out=[]){if(Array.isArray(v))v.forEach(x=>keysDeep(x,out));else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){out.push(k);keysDeep(x,out)}return out}
const files=walk(ROOT), ids=new Set(), utterancesBySplit=new Map(), errors=[];
for(const file of files){
 const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean);
 lines.forEach((line,i)=>{
  let x; try{x=JSON.parse(line)}catch{errors.push(`${file}:${i+1} invalid JSON`);return}
  if(x.schema_version!=='poliedron-academy-example-v1') errors.push(`${x.id||file}: bad schema_version`);
  if(!x.id||ids.has(x.id)) errors.push(`${x.id||file}: missing/duplicate id`); else ids.add(x.id);
  if(!allowedSplits.has(x.split)) errors.push(`${x.id}: invalid split`);
  if(!allowedDecisions.has(x.expected?.decision)) errors.push(`${x.id}: invalid decision`);
  for(const k of keysDeep(x)) if(forbiddenKeys.has(k)) errors.push(`${x.id}: forbidden key ${k}`);
  const norm=String(x.utterance||'').trim().toLocaleLowerCase('it-IT');
  if(!norm) errors.push(`${x.id}: empty utterance`);
  const prior=utterancesBySplit.get(norm)||new Set(); prior.add(x.split); utterancesBySplit.set(norm,prior);
 });
}
for(const [u,splits] of utterancesBySplit) if(splits.has('exam_holdout')&&[...splits].some(x=>x!=='exam_holdout')) errors.push(`exam leakage: "${u}"`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`Poliedron Academy OK: ${ids.size} examples in ${files.length} files; no exact train/exam leakage.`);
