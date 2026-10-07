// POL-AI-LEARN-001 — deterministic Confidence Engine.
export const CONFIDENCE_VERSION='poliedron-confidence-v1';
export const DECISION=Object.freeze({HIGH:'HIGH',NEEDS_DATA:'NEEDS_DATA',AMBIGUOUS:'AMBIGUOUS',BLOCKED:'BLOCKED',PROTECTED:'PROTECTED'});

export function classifyAction({supported=true,protectedAction=false,prepared=null,error=null}={}){
  const factors={supported:Boolean(supported),protected:Boolean(protectedAction),domain_validated:Boolean(prepared),warning:Boolean(prepared?.avviso),error:Boolean(error)};
  if(!factors.supported) return {version:CONFIDENCE_VERSION,decision:DECISION.BLOCKED,factors,reason:'unsupported_action'};
  if(factors.protected) return {version:CONFIDENCE_VERSION,decision:DECISION.PROTECTED,factors,reason:'protected_action'};
  if(error){
    const msg=String(error?.message||error).toLocaleLowerCase('it-IT');
    const ambiguous=/più|quale|omonim|scegli|ambig/.test(msg);
    const missing=/prima|manc|non trov|non disponibile|verific/.test(msg);
    return {version:CONFIDENCE_VERSION,decision:ambiguous?DECISION.AMBIGUOUS:missing?DECISION.NEEDS_DATA:DECISION.BLOCKED,factors,reason:ambiguous?'multiple_or_unclear_targets':missing?'missing_authoritative_data':'domain_validation_failed'};
  }
  if(!prepared) return {version:CONFIDENCE_VERSION,decision:DECISION.NEEDS_DATA,factors,reason:'not_domain_validated'};
  if(prepared.avviso) return {version:CONFIDENCE_VERSION,decision:DECISION.AMBIGUOUS,factors,reason:'domain_conflict_or_duplicate'};
  return {version:CONFIDENCE_VERSION,decision:DECISION.HIGH,factors,reason:'authoritative_checks_passed'};
}
