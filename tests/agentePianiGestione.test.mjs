import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePiani } from '../supabase/functions/agente-assistente/piani.js';

function chain(result){
  return {select(){return this},eq(){return this},limit(){return Promise.resolve({data:result,error:null})},single(){return Promise.resolve({data:result,error:null})}};
}
function db(plan){
  return {from(t){
    if(t==='patients') return chain({id:7,nome:'Mario',cognome:'Rossi'});
    if(t==='plans') return chain(plan);
    throw new Error(t);
  }};
}
const observed={patients:new Set([7])};
const plan={id:22,paziente_id:7,titolo:'Piano 2026',stato:'attivo',voci:[
  {prestazione:'Otturazione',dente:'16',prezzo:120,eseguita:false,incassata:false},
  {prestazione:'Igiene',dente:'',prezzo:90,eseguita:false,incassata:false},
]};

test('accepting a plan is prepared deterministically without mandatory confirmation',async()=>{
  const p=await preparePiani(db(plan),'imposta_stato_piano',{paziente_id:7,piano_id:22,stato:'accettato'},'s',observed);
  assert.equal(p.dati.stato,'accettato'); assert.equal(p.before.stato,'attivo'); assert.equal(p.confermaSempre,undefined);
});
test('rejecting a plan is supported',async()=>{
  const p=await preparePiani(db(plan),'imposta_stato_piano',{paziente_id:7,piano_id:22,stato:'rifiutato'},'s',observed);
  assert.match(p.summary,/rifiutato/);
});
test('marking a treatment item completed stamps execution date without changing other items',async()=>{
  const p=await preparePiani(db(plan),'segna_prestazione_eseguita',{paziente_id:7,piano_id:22,voce_index:0},'s',observed);
  assert.equal(p.dati.voci[0].eseguita,true); assert.ok(p.dati.voci[0].dataEsec); assert.equal(p.dati.voci[1].eseguita,false);
});
test('already completed treatment is idempotently refused',async()=>{
  const done={...plan,voci:[{...plan.voci[0],eseguita:true},plan.voci[1]]};
  await assert.rejects(()=>preparePiani(db(done),'segna_prestazione_eseguita',{paziente_id:7,piano_id:22,voce_index:0},'s',observed),/già eseguita/);
});
test('unknown treatment index is refused',async()=>{
  await assert.rejects(()=>preparePiani(db(plan),'segna_prestazione_eseguita',{paziente_id:7,piano_id:22,voce_index:9},'s',observed),/non trovata/);
});

test('adding an unambiguous treatment item prepares an app-compatible append',async()=>{
  const p=await preparePiani(db(plan),'aggiungi_prestazione_piano',{paziente_id:7,piano_id:22,prestazione:'Devitalizzazione',dente:'26',prezzo:350},'s',observed);
  assert.equal(p.avviso,null);
  assert.equal(p.dati.voci.length,3);
  assert.deepEqual(p.dati.voci[2],{prestazione:'Devitalizzazione',dente:'26',prezzo:350,eseguita:false,incassata:false});
});
test('possible duplicate treatment item is flagged and never silently appended',async()=>{
  const p=await preparePiani(db(plan),'aggiungi_prestazione_piano',{paziente_id:7,piano_id:22,prestazione:'Otturazione',dente:'16',prezzo:120},'s',observed);
  assert.match(p.avviso,/esiste già/);
});
