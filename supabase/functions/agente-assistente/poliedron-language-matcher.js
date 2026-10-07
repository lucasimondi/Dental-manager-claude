import { ITALIAN_OPERATIONAL_EXAMPLES } from './poliedron-language-data.js';
import { normalizeItalianOperational } from './poliedron-language.js';

const STOP=new Set(['il','lo','la','i','gli','le','un','uno','una','di','del','della','dei','delle','a','al','alla','da','in','con','per','e','mi']);
const tokens=(s)=>new Set(normalizeItalianOperational(s).replace(/[^a-zà-ÿ0-9' ]/gi,' ').split(/\s+/).filter(x=>x.length>1&&!STOP.has(x)));
const score=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.sqrt(A.size*B.size)};

export function matchItalianIntent(text=''){
 const byIntent=new Map();
 for(const row of ITALIAN_OPERATIONAL_EXAMPLES)for(const example of row.utterances){const s=score(text,example);const prev=byIntent.get(row.intent);if(!prev||s>prev.score)byIntent.set(row.intent,{intent:row.intent,score:s,example})}
 const ranked=[...byIntent.values()].sort((a,b)=>b.score-a.score);
 const best=ranked[0]||{intent:'UNKNOWN',score:0,example:null};
 const alternative=ranked[1]?.score||0;
 const margin=best.score-alternative;
 // Compare competing intents, not paraphrases of the same intent.
 // Similarity can route/clarify; it never authorizes a write.
 const accepted=best.score>=0.72&&margin>=0.08;
 return {...best,margin,accepted};
}
