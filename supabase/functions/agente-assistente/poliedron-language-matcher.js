import { ITALIAN_OPERATIONAL_EXAMPLES } from './poliedron-language-data.js';
import { normalizeItalianOperational } from './poliedron-language.js';

const STOP=new Set(['il','lo','la','i','gli','le','un','uno','una','di','del','della','dei','delle','a','al','alla','da','in','con','per','e','mi']);
const tokens=(s)=>new Set(normalizeItalianOperational(s).replace(/[^a-zà-ÿ0-9' ]/gi,' ').split(/\s+/).filter(x=>x.length>1&&!STOP.has(x)));
const score=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.sqrt(A.size*B.size)};

export function matchItalianIntent(text=''){
 let best={intent:'UNKNOWN',score:0,example:null},second=0;
 for(const row of ITALIAN_OPERATIONAL_EXAMPLES)for(const example of row.utterances){const s=score(text,example);if(s>best.score){second=best.score;best={intent:row.intent,score:s,example}}else if(s>second)second=s}
 const margin=best.score-second;
 // Language similarity may route/clarify; it never authorizes a write.
 const accepted=best.score>=0.72&&margin>=0.08;
 return {...best,margin,accepted};
}
