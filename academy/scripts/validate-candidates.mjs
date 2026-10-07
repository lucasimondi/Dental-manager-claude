import fs from 'node:fs';

const sourcePath=process.argv[2];
const candidatePath=process.argv[3];
if(!sourcePath||!candidatePath) throw new Error('Usage: node validate-candidates.mjs <source.jsonl> <candidates.jsonl>');
const read=p=>fs.readFileSync(p,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const sources=new Map(read(sourcePath).map(x=>[x.id,x]));
const candidates=read(candidatePath), seen=new Set(), errors=[];
const forbidden=/\b(patient_id|paziente_id|studio_id|user_id|raw_prompt|raw_chat|diagnosi|diagnosis|prescription|clinical_note)\b/i;
for(const c of candidates){
 const src=sources.get(c.source_example_id);
 if(!src){errors.push(`${c.candidate_id}: unknown source`);continue}
 if(!c.candidate_id||seen.has(c.candidate_id))errors.push(`${c.candidate_id||'?'}: missing/duplicate id`); else seen.add(c.candidate_id);
 if(!String(c.utterance||'').trim())errors.push(`${c.candidate_id}: empty utterance`);
 if(forbidden.test(JSON.stringify(c)))errors.push(`${c.candidate_id}: forbidden field/content marker`);
 if(!c.teacher?.provider||!c.teacher?.model)errors.push(`${c.candidate_id}: missing teacher provenance`);
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`Teacher candidates structurally valid: ${candidates.length}. Semantic promotion still requires review/evaluation.`);
