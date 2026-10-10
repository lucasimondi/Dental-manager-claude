export function planPoliedron(parsed){
  if(!parsed)return{steps:[],risk:'unknown',confidence:0};
  const c=Number(parsed.confidence||0);
  const plans={
    AGENDA_READ:[['READ_AGENDA','read']],
    AGENDA_AVAILABILITY:[['CHECK_AVAILABILITY','read']],
    PATIENT_SEARCH:[['SEARCH_PATIENT','read']],
    RECALLS_READ:[['READ_RECALLS','read']],
    KPI_READ:[['READ_KPI','read']],
    APPOINTMENT_CREATE:[['SEARCH_PATIENT','read'],['RESOLVE_PATIENT','read'],['CHECK_AVAILABILITY','read'],['PREPARE_APPOINTMENT','prepare'],['CONFIRM','confirm'],['WRITE_APPOINTMENT','write'],['VERIFY_WRITE','verify']],
    APPOINTMENT_MOVE:[['RESOLVE_APPOINTMENT','read'],['CHECK_AVAILABILITY','read'],['PREPARE_MOVE','prepare'],['CONFIRM','confirm'],['WRITE_MOVE','write'],['VERIFY_WRITE','verify']],
    // Core actions (poliedron-core-actions.js): prepared by the domain module, then written.
    ...Object.fromEntries(['APPOINTMENT_UPDATE','AGENDA_BLOCK','PATIENT_NOTE','PATIENT_CONTACT','PATIENT_CREATE','RECALL_CREATE','PAYMENT_CREATE'].map((i)=>[i,[['PREPARE','prepare'],['WRITE','write']]])),
    APPOINTMENT_DELETE:[['RESOLVE_APPOINTMENT','read'],['PREPARE_CANCEL','prepare'],['CONFIRM','confirm'],['WRITE_CANCEL','write'],['VERIFY_WRITE','verify']],
  };
  const steps=(plans[parsed.intent]||[]).map(([action,kind])=>({action,kind}));
  const risk=steps.some(s=>s.kind==='write')?'write':steps.length?'read':'unknown';
  return{intent:parsed.intent,steps,risk,confidence:c,missing:parsed.missing||[]};
}
export function confidenceDecision(parsed,plan){
  if(!parsed||!plan?.steps?.length)return{decision:'ESCALATE',reason:'unsupported'};
  if(parsed.missing?.length)return{decision:'CLARIFY',missing:parsed.missing};
  if(parsed.confidence<.90)return{decision:'ESCALATE',reason:'low_confidence'};
  if(plan.risk==='write')return{decision:'PREPARE_CONFIRM',reason:'write_requires_domain_validation'};
  return{decision:'EXECUTE',reason:'high_confidence_read'};
}
