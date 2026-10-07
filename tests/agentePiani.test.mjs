import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePiani, executePiani } from '../supabase/functions/agente-assistente/piani.js';

function q(data,error=null){return {select(){return this},eq(){return this},limit(){return Promise.resolve({data,error})},single(){return Promise.resolve({data,error})},insert(){return this}}}
function client({patient={id:7,nome:'Mario',cognome:'Rossi'},similar=[],inserted={id:99}}={}){
  return {from(t){
    if(t==='patients') return q(patient);
    if(t==='plans'){
      const x=q(similar); x.insert=(row)=>{x.row=row; x.select=()=>x; x.single=()=>Promise.resolve({data:{...inserted,...row},error:null}); return x}; return x;
    }
    if(t==='poliedron_action_claims'){return {insert:()=>Promise.resolve({error:null})}}
    throw new Error(t);
  }};
}
const observed={patients:new Set([7]),appointments:new Set()};
const input={paziente_id:7,titolo:'Piano implantare',voci:[{prestazione:'Impianto',prezzo:1000,dente:'16'},{prestazione:'Corona',prezzo:500,dente:'16'}],sconto:10,sconto_tipo:'pct'};

test('prepare builds the same plan shape and a confirmation summary',async()=>{
  const p=await preparePiani(client(),'crea_piano_cura',input,'studio',observed);
  assert.equal(p.dati.stato,'attivo'); assert.equal(p.dati.voci[0].eseguita,false);
  assert.match(p.summary,/1\.350,00/); assert.equal(p.confermaSempre,true);
});
test('patient must have been observed',async()=>{await assert.rejects(()=>preparePiani(client(),'crea_piano_cura',input,'studio',{patients:new Set()}),/Cerca prima/)});
test('empty plans are refused',async()=>{await assert.rejects(()=>preparePiani(client(),'crea_piano_cura',{...input,voci:[]},'studio',observed),/1 a 100/)});
test('invalid discounts are refused',async()=>{await assert.rejects(()=>preparePiani(client(),'crea_piano_cura',{...input,sconto:101},'studio',observed),/Sconto/)});
test('duplicate title produces warning',async()=>{const p=await preparePiani(client({similar:[{id:1,titolo:input.titolo}]}),'crea_piano_cura',input,'studio',observed);assert.match(p.avviso,/già un piano/)});
test('execute writes only the confirmed proposal',async()=>{const prepared=await preparePiani(client(),'crea_piano_cura',input,'studio',observed);const out=await executePiani(client(),{id:'claim',studioId:'studio',userId:'user',piani:prepared});assert.deepEqual(out.changed,['plans']);assert.equal(out.records.plans[0].titolo,input.titolo)});
