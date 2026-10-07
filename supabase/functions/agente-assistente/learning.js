// POL-AI-LEARN-001 — privacy-minimized learning event contract.
// Persistence is intentionally separate: this module cannot receive raw chat
// text or clinical content and is safe to exercise in shadow mode.
export const LEARNING_EVENT_VERSION='poliedron-learning-event-v1';

const short=(v,n)=>v==null?null:String(v).slice(0,n);
export function buildLearningEvent(input={}){
  const d=input.decision||{};
  return {
    schema_version:LEARNING_EVENT_VERSION,
    occurred_at:input.occurred_at||new Date().toISOString(),
    vertical:short(input.vertical||'unknown',40),
    action:short(input.action||'unknown',80),
    decision:short(d.decision||'BLOCKED',24),
    decision_reason:short(d.reason||'unknown',80),
    confidence_version:short(d.version||'unknown',80),
    factors:d.factors&&typeof d.factors==='object'?{
      supported:Boolean(d.factors.supported),
      protected:Boolean(d.factors.protected),
      domain_validated:Boolean(d.factors.domain_validated),
      warning:Boolean(d.factors.warning),
      error:Boolean(d.factors.error),
    }:{},
    entity_types:[...new Set((input.entity_types||[]).map(v=>short(v,40)))].slice(0,20),
    match_counts:Object.fromEntries(Object.entries(input.match_counts||{}).slice(0,20).map(([k,v])=>[short(k,40),Math.max(0,Math.min(999,Number(v)||0))])),
    outcome:short(input.outcome||'observed',40),
    correction:input.correction?{
      kind:short(input.correction.kind||'corrected',40),
      from_intent:short(input.correction.from_intent,80),
      to_intent:short(input.correction.to_intent,80),
    }:null,
    model:input.model?{
      provider:short(input.model.provider,40),
      name:short(input.model.name,80),
      version:short(input.model.version,80),
    }:null,
  };
}

export function assertLearningEventSafe(event){
  const serialized=JSON.stringify(event);
  const forbidden=['patient_name','nome_paziente','raw_prompt','raw_chat','diagnosis','diagnosi','clinical_note','prescription','document_text'];
  for(const key of forbidden) if(serialized.toLocaleLowerCase('it-IT').includes('\"'+key+'\"')) throw new Error('Learning event contains forbidden raw-data field.');
  return event;
}
