import fs from 'node:fs';
import path from 'node:path';

const OUT=path.resolve('academy/datasets/synthetic/dental-it-factory-v1.jsonl');
const FIRST=['Mario','Andrea','Giulia','Luca','Sara','Paolo','Elena','Marco','Anna','Davide','Chiara','Stefano'];
const LAST=['Rossi','Bianchi','Verdi','Gallo','Romano','Ferri','Costa','Riva','Fontana','Marino','Greco','Conti'];
const NAMES=FIRST.flatMap(first=>LAST.map(last=>`${first} ${last}`));
const SURNAMES=NAMES.map(x=>x.split(' ')[1]);
const AMOUNTS=[50,80,90,120,150,200,250,300,350,500];
const TEETH=['11','16','21','26','36','46'];
const PAYMENTS=[['carta','Carta'],['cash','Contanti'],['contanti','Contanti'],['bonifico','Bonifico'],['pos','POS'],['bancomat','Carta'],['con la carta','Carta'],['in contanti','Contanti']];
const TREATMENTS=[['igiene','igiene'],['ablazione','igiene'],['pulizia','igiene'],['detartrasi','igiene'],['endo','endodonzia'],['devitalizzazione','endodonzia'],['dev','endodonzia'],['terapia canalare','endodonzia'],['otturazione','otturazione'],['conservativa','otturazione'],['composito','otturazione'],['estrazione','estrazione'],['exo','estrazione'],['avulsione','estrazione']];
const rows=[]; let seq=1;
const add=(utterance,expected,tags=[])=>rows.push({schema_version:'poliedron-academy-example-v1',id:`dental-factory-${String(seq++).padStart(6,'0')}`,split:'train_synthetic',source:'synthetic_factory_v1',vertical:'dental',locale:'it-IT',utterance,context:[],expected,tags});
const ambiguity=(is_ambiguous=false,reasons=[])=>({is_ambiguous,reasons});

// Payments: natural + terse + word-order variants.
for(const name of NAMES)for(const amount of AMOUNTS)for(const [spoken,canonical] of PAYMENTS){
 const base={intent:'registra_pagamento_paziente',entities:{patient_reference:name,amount_eur:amount,payment_method:canonical},missing_fields:[],ambiguity:ambiguity(false),decision:'NEEDS_DATA',clarification:null};
 add(`${name} ha pagato ${amount} euro con ${spoken}`,base,['payment','natural']);
 add(`segna ${amount} ${spoken} a ${name}`,base,['payment','terse']);
 add(`${amount} euro da ${name}, ${spoken}`,base,['payment','front-desk']);
}
// Surname-only forces authoritative resolution.
for(const surname of SURNAMES)for(const amount of [100,200,300]){
 add(`${surname} mi ha dato ${amount} cash`,{intent:'registra_pagamento_paziente',entities:{patient_reference:surname,amount_eur:amount,payment_method:'Contanti'},missing_fields:[],ambiguity:ambiguity(true,['surname_only_requires_resolution']),decision:'NEEDS_DATA',clarification:null},['payment','surname-only','colloquial']);
}
// Plan treatments with synonyms/abbreviations.
for(const name of NAMES)for(const [spoken,canonical] of TREATMENTS)for(const tooth of TEETH){
 add(`aggiungi ${spoken} ${tooth} al piano di ${name}`,{intent:'aggiungi_prestazione_piano',entities:{patient_reference:name,treatment:canonical,tooth},missing_fields:['authoritative_patient_id','authoritative_plan_id','authoritative_price'],ambiguity:ambiguity(false),decision:'NEEDS_DATA',clarification:null},['plan','treatment','terminology']);
 add(`${name}: ${spoken} sul ${tooth} nel preventivo`,{intent:'aggiungi_prestazione_piano',entities:{patient_reference:name,treatment:canonical,tooth},missing_fields:['authoritative_patient_id','authoritative_plan_id','authoritative_price'],ambiguity:ambiguity(false),decision:'NEEDS_DATA',clarification:null},['plan','treatment','terse']);
}
// Executed treatment: missing patient is intentionally incomplete.
for(const [spoken,canonical] of TREATMENTS)for(const tooth of TEETH){
 add(`${spoken} ${tooth} fatta`,{intent:'segna_prestazione_eseguita',entities:{treatment:canonical,tooth},missing_fields:['patient','plan'],ambiguity:ambiguity(true,['patient_missing','plan_missing']),decision:'NEEDS_DATA',clarification:`Per quale paziente e piano devo segnare eseguita la prestazione sul ${tooth}?`},['clinical-operation','terse','missing-context']);
}
// Hard negatives: same tokens, unclear action.
for(const surname of SURNAMES)for(const amount of AMOUNTS){
 add(`${surname} ${amount}`,{intent:'unknown',entities:{patient_reference:surname,amount_eur:amount},missing_fields:['intent'],ambiguity:ambiguity(true,['action_unclear']),decision:'AMBIGUOUS',clarification:`Cosa devo fare con i ${amount} euro per ${surname}?`},['hard-negative','minimal']);
 add(`metti ${amount} a ${surname}`,{intent:'unknown',entities:{patient_reference:surname,amount_eur:amount},missing_fields:['intent'],ambiguity:ambiguity(true,['amount_role_unclear','action_unclear']),decision:'AMBIGUOUS',clarification:'È un pagamento ricevuto o un importo da aggiungere al piano?'},['hard-negative','ambiguity']);
}
// Protected destructive language.
for(const name of NAMES){
 add(`cancella definitivamente il piano di ${name}`,{intent:'elimina_piano',entities:{patient_reference:name},missing_fields:['authoritative_plan_id'],ambiguity:ambiguity(false),decision:'PROTECTED',clarification:null},['destructive','protected']);
 add(`storna l'ultimo pagamento di ${name}`,{intent:'storna_pagamento',entities:{patient_reference:name},missing_fields:['authoritative_payment_id'],ambiguity:ambiguity(false),decision:'PROTECTED',clarification:null},['destructive','protected','payment']);
}
// Dictation/typo variants are explicit, deterministic perturbations.
const typoSeeds=[['pagato','pagto'],['aggiungi','agiungi'],['preventivo','preventvo'],['devitalizzazione','devitalizazione'],['contanti','cotanti']];
for(const [good,bad] of typoSeeds)for(const name of NAMES.slice(0,4)){
 const utterance=`${name} ${good==='pagato'?'ha pagato 120 euro':good==='contanti'?'ha pagato 120 euro contanti':good==='aggiungi'?'aggiungi igiene al preventivo':good==='preventivo'?'aggiungi igiene al preventivo':'devitalizzazione 26 fatta'}`.replace(good,bad);
 add(utterance,{intent:'unknown',entities:{patient_reference:name},missing_fields:[],ambiguity:ambiguity(true,['noisy_input_requires_interpretation']),decision:'NEEDS_DATA',clarification:null},['noise','typo']);
}

fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,rows.map(JSON.stringify).join('\n')+'\n');
const counts=rows.reduce((a,x)=>(a[x.expected.decision]=(a[x.expected.decision]||0)+1,a),{});
console.log(JSON.stringify({output:OUT,examples:rows.length,decisions:counts},null,2));
