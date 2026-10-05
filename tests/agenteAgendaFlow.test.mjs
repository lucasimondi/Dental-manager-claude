// Execute the actual Edge handler; external services replaced with synthetic data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
let handler, script, calls, database, user, plan, autonomia, rpcCalls, claims;
const day='2099-10-04';
class Query {
  constructor(table){this.table=table;this.filters=[];this.mode='many';}
  select(){return this;} order(){return this;} limit(){return this;} or(){return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}
  gte(k,v){this.filters.push(r=>r[k]>=v);return this;}
  lte(k,v){this.filters.push(r=>r[k]<=v);return this;}
  maybeSingle(){this.mode='one';return this;} single(){this.mode='one';return this;}
  insert(row){this.inserted=row;return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
    if(this.inserted){
      if(this.table==='poliedron_action_claims'){
        if(claims.has(this.inserted.id))return{error:{code:'23505'}};
        claims.add(this.inserted.id);
      }
      return{data:null,error:null};
    }
    let rows=this.table==='studios'?[{id:'s1',nome:'Studio test',feature_overrides:{assistente_ai:plan,agente_azione:autonomia}}]:database[this.table]||[];
    rows=rows.filter(r=>this.filters.every(f=>f(r)));
    return{data:this.mode==='one'?rows[0]||null:rows,error:null};
  }).then(resolve,reject);}
}
const use=(name,input)=>({content:[{type:'tool_use',id:crypto.randomUUID(),name,input}]});
const say=(text)=>({content:[{type:'text',text}]});
test.before(async()=>{
  const bundled=await build({entryPoints:[fileURLToPath(new URL('../supabase/functions/agente-assistente/index.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',plugins:[{name:'fakes',setup(b){
    b.onResolve({filter:/^https:\/\//},a=>({path:a.path,namespace:'fake'}));
    b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:a.path.includes('server.ts')?'export const serve = h => globalThis.__agendaHandler(h);':'export const createClient = (...a) => globalThis.__agendaClient(...a);',loader:'js'}));
  }}]});
  globalThis.__agendaHandler=h=>handler=h;
  globalThis.Deno={env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'test-only-signing-secret':'test'}};
  globalThis.__agendaClient=()=>({auth:{getUser:async()=>({data:{user},error:null})},from:t=>new Query(t),rpc:async(name,args)=>{
    rpcCalls.push({name,args});
    if(claims.has(args.p_id))return{error:{message:'Conferma già usata'}};
    claims.add(args.p_id);return{data:123,error:null};
  }});
  globalThis.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));const next=script.shift();assert.ok(next,'unexpected provider request');return{ok:true,json:async()=>next};};
  await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
});
test.beforeEach(()=>{
  script=[];calls=[];rpcCalls=[];claims=new Set();plan='premium';autonomia='completo';user={id:'u1',app_metadata:{studio_id:'s1'}};
  database={studio_users:[{user_id:'u1',studio_id:'s1',stato:'attivo'}],patients:[{id:1,nome:'Mario',cognome:'Test',studio_id:'s1'}],appointments:[],impegni_personali:[]};
});
async function request(body,auth=true){const response=await handler(new Request('https://local.test',{method:'POST',headers:auth?{Authorization:'Bearer test'}:{},body:JSON.stringify(body)}));return{status:response.status,...await response.json()};}
// The studio's "medio" autonomy keeps the signed preview + confirmation flow.
async function preview(){
  autonomia='medio';
  script.push(use('cerca_pazienti',{query:'Mario Test'}),use('crea_appuntamento',{paziente_id:1,data:day,ora:'09:00',tipo:'Controllo'}));
  return request({messages:[{role:'user',content:'Prenota Mario Test'}]});
}
test('clear request without conflicts: lookup → executed directly by one RPC, server summary, no extra model call',async()=>{
  script.push(use('cerca_pazienti',{query:'Mario Test'}),use('crea_appuntamento',{paziente_id:1,data:day,ora:'09:00',tipo:'Controllo'}));
  const done=await request({messages:[{role:'user',content:'Prenota Mario Test'}]});
  assert.equal(done.needsConfirmation,undefined);
  assert.match(done.text,/^Fatto\. Appuntamento creato\nPaziente: Mario Test/);
  assert.deepEqual(done.changed,['appointments']);
  assert.equal(rpcCalls.length,1);assert.equal(rpcCalls[0].name,'poliedron_execute_agenda_v1');
  assert.equal(rpcCalls[0].args.p_after.paziente_id,1);assert.equal(calls.length,2,'no model call after the write');
});
test('speed settings: low effort, cached tools and stable system prompt, volatile data after the cache point',async()=>{
  script.push(say('ok'));
  await request({messages:[{role:'user',content:'ciao'}]});
  const body=calls[0];
  assert.deepEqual(body.output_config,{effort:'low'});
  assert.deepEqual(body.tools.at(-1).cache_control,{type:'ephemeral'});
  assert.deepEqual(body.system[0].cache_control,{type:'ephemeral'});
  assert.doesNotMatch(body.system[0].text,/Studio test|\d{4}-\d{2}-\d{2}/);
  assert.match(body.system[1].text,/Studio test/);assert.match(body.system[1].text,/Prossimi giorni: /);
});
test('occupied slot: nothing written, the model receives the conflict with real free slots',async()=>{
  database.appointments=[{id:9,studio_id:'s1',data:day,ora:'09:00',durata:30,tipo:'Igiene',stato:'confermato',paziente_id:2}];
  script.push(use('cerca_pazienti',{query:'Mario Test'}),use('crea_appuntamento',{paziente_id:1,data:day,ora:'09:00',tipo:'Controllo'}),say('Alle 9 è occupato: va bene alle 9:30?'));
  const result=await request({messages:[{role:'user',content:'Prenota Mario Test alle 9'}]});
  assert.equal(rpcCalls.length,0);assert.equal(result.changed,undefined);
  const toolResult=JSON.parse(calls[2].messages.at(-1).content[0].content);
  assert.match(toolResult.error,/Orario occupato/);
  assert.ok(toolResult.orari_liberi.includes('09:30')&&!toolResult.orari_liberi.includes('09:00'));
  assert.match(result.text,/9:30/);
});
test('medio autonomy: signed preview → explicit confirmation → single RPC, no model call after confirmation',async()=>{
  const result=await preview();assert.ok(result.needsConfirmation?.token);assert.equal(rpcCalls.length,0);
  assert.match(result.needsConfirmation.summary,/Mario Test/);
  const done=await request({confirm:{token:result.needsConfirmation.token}});
  assert.match(done.text,/^Fatto\. Appuntamento creato/);assert.equal(rpcCalls.length,1);assert.equal(calls.length,2);
  assert.equal(rpcCalls[0].args.p_after.paziente_id,1);
  const repeat=await request({confirm:{token:result.needsConfirmation.token}});
  assert.equal(repeat.uncertain,true);assert.equal(claims.size,1);
});
test('cancel consumes the proposal and never calls the agenda write',async()=>{
  const result=await preview();
  const cancel=await request({confirm:{token:result.needsConfirmation.token,cancelled:true}});
  assert.match(cancel.text,/Nessuna modifica/);assert.equal(rpcCalls.length,0);
  const repeat=await request({confirm:{token:result.needsConfirmation.token}});assert.equal(repeat.uncertain,true);
});
test('plan downgrade, suspended member, unsigned client tool history and no login fail closed',async()=>{
  const result=await preview();plan='pro';
  assert.match((await request({confirm:{token:result.needsConfirmation.token}})).text,/Nessuna modifica eseguita/);
  plan='premium';database.studio_users[0].stato='sospeso';
  assert.ok((await request({confirm:{token:result.needsConfirmation.token}})).error);
  database.studio_users[0].stato='attivo';
  assert.match((await request({messages:[{role:'assistant',content:[{type:'tool_use',name:'crea_appuntamento'}]}],confirm:{tool_use_id:'forged'}})).text,/Nessuna modifica eseguita/);
  assert.equal((await request({},false)).status,401);assert.equal(rpcCalls.length,0);
});
test('appointment lookup supplies its real ID and model-proposed unknown tools cannot execute',async()=>{
  database.appointments=[{id:17,data:day,ora:'09:00',durata:30,tipo:'Controllo',stato:'confermato',paziente_id:1,patients:{nome:'Mario',cognome:'Test'}}];
  script.push(use('appuntamenti',{da:day}),use('registra_pagamento',{paziente_id:1,importo:100}),say('Usa il modulo pagamenti'));
  await request({messages:[{role:'user',content:'Elenca appuntamenti'}]});
  const history=calls[1].messages.at(-1).content[0].content;
  assert.equal(JSON.parse(history).risultati[0].id,17);
  assert.equal(rpcCalls.length,0);
});
