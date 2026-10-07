import fs from 'node:fs';
import path from 'node:path';

const input=process.argv[2]||'academy/datasets/synthetic/dental-it-v1.jsonl';
const output=process.argv[3]||'academy/teacher/batches/dental-it-teacher-batch-v1.jsonl';
const rows=fs.readFileSync(input,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const batch=rows.map(x=>({
 schema_version:'poliedron-teacher-job-v1',
 job_id:`teacher-${x.id}`,
 source_example_id:x.id,
 locale:x.locale,
 vertical:x.vertical,
 source_utterance:x.utterance,
 locked_expected:x.expected,
 requested_styles:['spoken','front_desk','clinician_terse','dictation_noise','typos','word_order','colloquial'],
 requested_variants:8
}));
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,batch.map(JSON.stringify).join('\n')+'\n');
console.log(JSON.stringify({input,output,jobs:batch.length,requested_candidates:batch.length*8},null,2));
