const clean=(v='')=>String(v).trim().replace(/\s+/g,' ');
export function deriveContext(messages=[]){
  const recent=messages.slice(-10);let patientQuery=null,pending=null;
  for(const m of recent){
    if(m.role==='user'){
      const q=clean(m.content);
      const p=q.match(/(?:cerca|trova|apri|scheda)\s+(?:il\s+)?(?:paziente\s+)?([a-zà-ÿ' -]{3,80})$/i);
      if(p)patientQuery=p[1].trim().toLocaleLowerCase('it-IT');
    }
    if(m.role==='assistant'){
      const missing=[...String(m.content).matchAll(/Per quale (paziente|giorno)|A che ora|Che tipo di appuntamento/gi)];
      if(missing.length)pending=true;
    }
  }
  return{patient_query:patientQuery,pending_clarification:Boolean(pending)};
}
export function enrichWithContext(parsed,context={}){
  if(!parsed||parsed.intent==='UNKNOWN')return parsed;
  const entities={...parsed.entities};let missing=[...(parsed.missing||[])];
  if(missing.includes('patient')&&context.patient_query){entities.patient_query=context.patient_query;missing=missing.filter(x=>x!=='patient');}
  return{...parsed,entities,missing,context_used:missing.length!==(parsed.missing||[]).length};
}
