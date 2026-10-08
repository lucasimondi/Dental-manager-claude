import { understandPoliedron, parseItalianDay, parseItalianTime } from './poliedron-core.js';
import { normalizeItalianOperational } from './poliedron-language.js';

const TTL_MESSAGES=6;
const TYPES=['igiene','controllo','visita','devitalizzazione','estrazione','implantologia','ortodonzia'];
const typeFrom=(q)=>TYPES.find(x=>new RegExp('\\b'+x+'\\b','i').test(q))||null;

export function deriveConversationState(messages=[]){
 const recent=messages.slice(-TTL_MESSAGES);
 let pending=null;
 for(let i=recent.length-1;i>=0;i--){
   const m=recent[i]; if(m.role!=='user')continue;
   const parsed=understandPoliedron(m.content||'');
   if(parsed.intent!=='UNKNOWN'&&parsed.missing?.length){pending={intent:parsed.intent,entities:{...parsed.entities},missing:[...parsed.missing],source_index:i};break}
 }
 return {pending};
}

export function completeConversationalTurn(text='',state={}){
 const direct=understandPoliedron(text);
 if(direct.intent!=='UNKNOWN')return {...direct,conversation_completed:false};
 const pending=state.pending;if(!pending)return direct;
 const q=normalizeItalianOperational(text);const entities={...pending.entities};
 const day=parseItalianDay(q);const time=parseItalianTime(q);const tipo=typeFrom(q);
 if(day)Object.assign(entities,day);if(time)Object.assign(entities,time);if(tipo)entities.tipo=tipo;
 let missing=[...pending.missing];
 if(day)missing=missing.filter(x=>x!=='day');if(time)missing=missing.filter(x=>x!=='time');if(tipo)missing=missing.filter(x=>x!=='type');if(day||time)missing=missing.filter(x=>x!=='target');
 // Never infer a patient from pronouns or free text here: identity resolution stays authoritative.
 return {intent:pending.intent,confidence:.93,entities,missing,conversation_completed:true};
}

export function conversationalReference(text='',context={}){
 const q=normalizeItalianOperational(text);
 const correction=/\b(?:no|anzi|correggo|intendevo)\b/i.test(q);
 const refersBack=/\b(?:quello|quella|quello di prima|lui|lei|lo|la|spostalo|spostala|cancellalo|cancellala)\b/i.test(q);
 if(!correction&&!refersBack)return{kind:'NONE'};
 const appointments=Array.isArray(context.observed_appointments)?context.observed_appointments:[];
 const patients=Array.isArray(context.observed_patients)?context.observed_patients:[];
 if(/\bspostal[oa]\b/i.test(q)){
   if(appointments.length!==1)return{kind:'AMBIGUOUS_REFERENCE',target:'appointment',count:appointments.length};
   const day=parseItalianDay(q),time=parseItalianTime(q);
   return{kind:'APPOINTMENT_MOVE',appointment_id:appointments[0].id,...(day||{}),...(time||{}),missing:[...(!day?['day']:[]),...(!time?['time']:[])]};
 }
 if(/\bcancellal[oa]\b/i.test(q)){
   if(appointments.length!==1)return{kind:'AMBIGUOUS_REFERENCE',target:'appointment',count:appointments.length};
   return{kind:'APPOINTMENT_DELETE',appointment_id:appointments[0].id};
 }
 if(correction)return{kind:'CORRECTION',text:q};
 if(refersBack&&patients.length!==1&&appointments.length!==1)return{kind:'AMBIGUOUS_REFERENCE',target:'unknown',count:Math.max(patients.length,appointments.length)};
 return{kind:'REFERENCE',patient_id:patients.length===1?patients[0].id:null,appointment_id:appointments.length===1?appointments[0].id:null};
}

export function conversationEnvelope(messages=[]){
 const recent=messages.slice(-8);const refs={patient_ids:[],appointment_ids:[]};
 for(const m of recent){
   const meta=m&&typeof m==='object'?m.meta:null;
   if(meta?.patient_id&&!refs.patient_ids.includes(meta.patient_id))refs.patient_ids.push(meta.patient_id);
   if(meta?.appointment_id&&!refs.appointment_ids.includes(meta.appointment_id))refs.appointment_ids.push(meta.appointment_id);
 }
 return{version:1,patient_ids:refs.patient_ids.slice(-3),appointment_ids:refs.appointment_ids.slice(-3)};
}
export function observedContextFromEnvelope(envelope={}){
 return{observed_patients:(envelope.patient_ids||[]).map(id=>({id})),observed_appointments:(envelope.appointment_ids||[]).map(id=>({id}))};
}
