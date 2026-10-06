// POL-AI-TEAM-002: the real Edge handler in team mode, external services faked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
let handler, calls, rpcCalls, inserts, plan, autonomia, router;
class Query {
  constructor(table){this.table=table;this.filters=[];this.mode='many';}
  select(){return this;} order(){return this;} limit(){return this;} or(){return this;} in(){return this;} not(){return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}
  gte(){return this;} lte(){return this;} lt(){return this;} gt(){return this;} ilike(){return this;}
  maybeSingle(){this.mode='one';return this;} single(){this.mode='one';return this;}
  insert(row){this.inserted=row;inserts.push({table:this.table,row});return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
    if(this.inserted)return{data:null,error:null};
    const db={studios:[{id:'s1',nome:'Studio test',feature_overrides:{assistente_ai:plan,agente_azione:autonomia}}],studio_users:[{user_id:'u1',studio_id:'s1',stato:'attivo'}]};
    let rows=(db[this.table]||[]).filter(r=>this.filters.every(f=>f(r)));
    return{data:this.mode==='one'?rows[0]||null:rows,error:null};
  }).then(resolve,reject);}
}
const use=(name,input)=>({content:[{type:'tool_use',id:crypto.randomUUID(),name,input}]});
const say=(text)=>({content:[{type:'text',text}]});
const who=(body)=>/Sei (Clinic Manager|Assistente \w+)/.exec(body.system[0].text)?.[1]||'Poliedron';
test.before(async()=>{
  const bundled=await build({entryPoints:[fileURLToPath(new URL('../supabase/functions/agente-assistente/index.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',plugins:[{name:'fakes',setup(b){
    b.onResolve({filter:/^https:\/\//},a=>({path:a.path,namespace:'fake'}));
    b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:a.path.includes('server.ts')?'export const serve = h => globalThis.__teamHandler(h);':'export const createClient = (...a) => globalThis.__teamClient(...a);',loader:'js'}));
  }}]});
  globalThis.__teamHandler=h=>handler=h;
  globalThis.Deno={env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'test-only-signing-secret':'test'}};
  globalThis.__teamClient=()=>({auth:{getUser:async()=>({data:{user:{id:'u1',app_metadata:{studio_id:'s1'}}},error:null})},from:t=>new Query(t),rpc:async(name,args)=>{rpcCalls.push({name,args});return{data:1,error:null};}});
  globalThis.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);calls.push(body);
    const next=router(who(body),body);
    if(next==='fail')return{ok:false,text:async()=>'errore'};
    assert.ok(next,'unexpected provider request for '+who(body));
    return{ok:true,json:async()=>next};
  };
  await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
});
test.beforeEach(()=>{calls=[];rpcCalls=[];inserts=[];plan='premium';autonomia='completo';router=()=>null;});
async function request(body){const response=await handler(new Request('https://local.test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(body)}));return{status:response.status,...await response.json()};}
const ask=(team,content='Come riempio i buchi di novembre?')=>request({messages:[{role:'user',content}],team});
const toolNames=(body)=>(body.tools||[]).map(t=>t.name);
const WRITES=['crea_appuntamento','modifica_appuntamento','elimina_appuntamento','crea_paziente','aggiungi_nota_paziente','crea_promemoria','registra_pagamento','crea_proposta_commerciale'];

test('a specialist gets only its own read tools and its role prompt; write tools are refused',async()=>{
  const script=[use('crea_appuntamento',{paziente_id:1,data:'2099-01-01',ora:'09:00'}),say('Ti consiglio una campagna di richiamo.')];
  router=()=>script.shift();
  const out=await ask({assistente:'marketing'});
  assert.deepEqual(toolNames(calls[0]).sort(),['andamento_kpi','appuntamenti','catalogo_prestazioni','kpi_controllo_gestione','richiami']);
  assert.match(calls[0].system[0].text,/Sei Assistente Marketing/);assert.match(calls[0].system[0].text,/sola lettura/);
  assert.deepEqual(calls[0].tools.at(-1).cache_control,{type:'ephemeral'});
  const refused=JSON.parse(calls[1].messages.at(-1).content[0].content);
  assert.equal(refused.error,'Strumento non consentito');
  assert.equal(rpcCalls.length,0);assert.equal(inserts.filter(i=>i.table==='poliedron_attivita').length,0);
  assert.equal(out.text,'Ti consiglio una campagna di richiamo.');assert.equal(out.changed,undefined);
});
test('the Clinic Manager consults specialists in parallel and returns their attributed opinions',async()=>{
  const manager=[use('consulta_specialisti',{consulti:[{specialista:'marketing',domanda:'Quali campagne?'},{specialista:'finance',domanda:'Quanto margine?'},{specialista:'marketing',domanda:'doppione'}]}),say('Sintesi: campagna di igiene, margine buono.')];
  router=(w)=>w==='Clinic Manager'?manager.shift():w==='Assistente Marketing'?say('Campagna igiene'):w==='Assistente Finanza'?say('Margine 40%'):null;
  const out=await ask({assistente:'clinic-manager'});
  const names=toolNames(calls[0]);
  assert.ok(names.includes('consulta_specialisti'));assert.ok(!names.some(n=>WRITES.includes(n)),'manager never gets write tools');
  assert.deepEqual(out.team.pareri.map(p=>[p.specialista,p.stato,p.parere]),[['marketing','ok','Campagna igiene'],['finance','ok','Margine 40%']]);
  const finance=calls.find(c=>who(c)==='Assistente Finanza');
  assert.deepEqual(toolNames(finance).sort(),['andamento_kpi','catalogo_prestazioni','kpi_controllo_gestione','situazione_economica']);
  assert.match(finance.messages[0].content,/Quanto margine/);
  assert.match(out.text,/^Sintesi/);assert.equal(rpcCalls.length,0);
});
test('a group limits who can be consulted and carries its shared objective',async()=>{
  const manager=[use('consulta_specialisti',{consulti:[{specialista:'finance',domanda:'x'}]}),say('Non posso consultare Finanza in questo gruppo.')];
  router=(w)=>w==='Clinic Manager'?manager.shift():null;
  const out=await ask({assistente:'clinic-manager',membri:['marketing','clinical'],titolo:'Crescita igiene',obiettivo:'+20% sedute di igiene entro marzo'});
  const consulta=calls[0].tools.find(t=>t.name==='consulta_specialisti');
  assert.deepEqual(consulta.input_schema.properties.consulti.items.properties.specialista.enum,['marketing','clinical']);
  assert.match(calls[0].system[1].text,/Gruppo "Crescita igiene"/);assert.match(calls[0].system[1].text,/\+20% sedute di igiene/);
  assert.equal(JSON.parse(calls[1].messages.at(-1).content[0].content).error,'Nessuno specialista valido da consultare');
  assert.deepEqual(out.team.pareri,[]);
});
test('an unavailable specialist yields an explicit partial result',async()=>{
  const manager=[use('consulta_specialisti',{consulti:[{specialista:'agenda',domanda:'buchi?'},{specialista:'clinical',domanda:'priorità?'}]}),say('Risposta parziale.')];
  router=(w)=>w==='Clinic Manager'?manager.shift():w==='Assistente Agenda'?'fail':say('Prima le urgenze');
  const out=await ask({assistente:'clinic-manager'});
  assert.deepEqual(out.team.pareri.map(p=>p.stato),['non_disponibile','ok']);
});
test('team access never exceeds the studio: PRO reads only, consulente reads only, BASE has no tools',async()=>{
  for(const [p,a] of [['pro','completo'],['premium','consulente']]){
    plan=p;autonomia=a;calls=[];router=()=>say('ok');
    await ask({assistente:'clinic-manager'});
    assert.ok(!toolNames(calls[0]).some(n=>WRITES.includes(n)));
  }
  plan='base';autonomia='completo';calls=[];router=()=>say('ok');
  await ask({assistente:'agenda'});
  assert.equal(calls[0].tools,undefined,'no data tools at all on BASE');
});
test('invalid team requests fail closed before any model call',async()=>{
  for(const team of [{assistente:'hacker'},{assistente:'marketing',membri:['finance']},{assistente:'clinic-manager',membri:['finance','finance']},{assistente:'clinic-manager',membri:['clinic-manager']},'marketing']){
    const out=await ask(team);assert.ok(out.error,JSON.stringify(team));
  }
  const confirm=await request({confirm:{token:'x'},team:{assistente:'marketing'}});
  assert.match(confirm.error,/non esegue azioni/);
  assert.equal(calls.length,0);
});
