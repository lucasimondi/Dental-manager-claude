import test from 'node:test';
import assert from 'node:assert/strict';
import { signProposal, verifyProposal, claimProposal, studioToday } from '../supabase/functions/agente-assistente/confirmation.js';
import { hasConflict, validateAppointment, prepareAgenda, executeAgenda } from '../supabase/functions/agente-assistente/agenda.js';
import { runModelTask } from '../src/lib/poliedron/modelGateway.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';

const secret = 'synthetic-test-only';
const proposal = { id: 'p1', userId: 'u1', studioId: 's1', name: 'crea_appuntamento', expiresAt: 5000 };
const context = { userId: 'u1', studioId: 's1', allowedNames: new Set(['crea_appuntamento']), now: 1000 };
test('confirmation signature rejects tampering, wrong tenant/user, expiry and downgraded plan', async () => {
  const token = await signProposal(proposal,secret);
  assert.deepEqual(await verifyProposal(token,secret,context),proposal);
  for (const ctx of [{ ...context,userId:'u2' },{ ...context,studioId:'s2' },{ ...context,now:5000 },{ ...context,allowedNames:new Set() }]) {
    await assert.rejects(verifyProposal(token,secret,ctx));
  }
  const [body,sig] = token.split('.');
  const forged = btoa(JSON.stringify({ ...proposal,name:'registra_pagamento' }))+'.'+sig;
  await assert.rejects(verifyProposal(forged,secret,context));
  await assert.rejects(verifyProposal(body+'.'+sig,'other-key',context));
  await assert.rejects(verifyProposal('invalid',secret,context));
});
test('simultaneous claims cannot both consume a confirmation and storage failure is fail-closed', async () => {
  const seen = new Set();
  const client = { from: () => ({ insert: async (row) => {
    if(seen.has(row.id)) return { error:{code:'23505'} };
    seen.add(row.id); return {error:null};
  } }) };
  const outcomes = await Promise.allSettled([claimProposal(client,proposal),claimProposal(client,proposal)]);
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  await assert.rejects(claimProposal({from:()=>({insert:async()=>({error:{code:'42501'}})})},proposal));
});
test('studio date uses Rome across midnight and daylight saving', () => {
  assert.equal(studioToday(new Date('2026-10-04T22:30:00Z')),'2026-10-05');
  assert.equal(studioToday(new Date('2026-12-04T23:30:00Z')),'2026-12-05');
});
const row = {id:1,paziente_id:1,data:'2099-10-04',ora:'09:00',durata:30,tipo:'Controllo',stato:'confermato',operatore_id:1};
test('conflicts exclude cancelled/self, distinguish operators, include unassigned and personal blocks', () => {
  assert.equal(hasConflict(row,[row],[]),false);
  assert.equal(hasConflict(row,[{...row,id:2,stato:'annullato'}],[]),false);
  assert.equal(hasConflict(row,[{...row,id:2,operatore_id:2}],[]),false);
  assert.equal(hasConflict(row,[{...row,id:2,operatore_id:null}],[]),true);
  assert.equal(hasConflict(row,[{...row,id:2,ora:'09:15'}],[]),true);
  assert.equal(hasConflict(row,[],[{tutto_il_giorno:true}]),true);
  assert.equal(hasConflict(row,[],[{ora_inizio:'09:15',ora_fine:'09:45'}]),true);
});
test('invalid or incomplete model arguments cannot become writes', () => {
  validateAppointment(row);
  for(const patch of [{ora:'24:00'},{data:'2099-02-30'},{durata:0},{durata:1.5},{stato:'inventato'},{paziente_id:null},{tipo:''}]) assert.throws(()=>validateAppointment({...row,...patch}));
});
test('model cannot invent appointment or patient IDs without an authoritative lookup', async () => {
  const forbidden = new Proxy({}, {get(){throw new Error('must not read');}});
  const observed = {appointments:new Set(),patients:new Set()};
  await assert.rejects(prepareAgenda(forbidden,'modifica_appuntamento',{appuntamento_id:1},'s1',observed),/Cerca prima/);
  await assert.rejects(prepareAgenda(forbidden,'crea_appuntamento',{paziente_id:1},'s1',observed),/Cerca prima/);
});
test('confirmed execution delegates the entire write to the user-scoped atomic RPC', async () => {
  let called;
  const p = {...proposal,agenda:{before:null,after:row,summary:'Sintesi'}};
  const result = await executeAgenda({rpc:async(name,args)=>{called={name,args};return{data:25,error:null};}},p);
  assert.equal(called.name,'poliedron_execute_agenda_v1');
  assert.equal(called.args.p_id,'p1');
  assert.equal(result.appointmentId,25);
  await assert.rejects(executeAgenda({rpc:async()=>({error:{message:'conflict'}})},p),/conflict/);
});
test('gateway can submit a confirmation without inventing a new user question', async () => {
  let body;
  const result = await runModelTask({confirm:{token:'signed',cancelled:true},supabaseClient:{functions:{invoke:async(_,args)=>{body=args.body;return{data:{text:'Annullato'}};}}}});
  assert.deepEqual(body.confirm,{token:'signed',cancelled:true});
  assert.equal(result.text,'Annullato');
});
test('explicit agenda submission exposes the signed preview; typing does not call the server', async () => {
  let calls=0;
  const client={functions:{invoke:async()=>{calls++;return{data:{text:'Controlla',needsConfirmation:{token:'signed',summary:'Paziente di prova'}}};}}};
  const result=await processQuery({query:'Sposta appuntamento Rossi a domani',supabaseClient:client});
  assert.equal(result.modelConfirmation.token,'signed');
  await processQuery({query:'Sposta appuntamento Rossi a domani',supabaseClient:client,allowModel:false});
  assert.equal(calls,1);
});
test('patient commands go to Poliedron only when the studio agent may write; the result carries what changed', async () => {
  let calls=0;
  const client={functions:{invoke:async()=>{calls++;return{data:{text:'Fatto. Nota aggiunta',changed:['patients']}};}}};
  const premium={features:{assistente_ai:'premium'}};
  for (const query of ['Aggiungi una nota a Mario Rossi: allergico','Ricordami di chiamare il laboratorio domani','Metti ferie dal 10 al 15 agosto','Il telefono di Mario Rossi è 333111']) {
    const result=await processQuery({query,context:premium,supabaseClient:client});
    assert.equal(result.intent,'AGENT',query);assert.deepEqual(result.dataChanged,['patients']);
  }
  assert.equal(calls,4);
  // Consulente, plans and payments and keystroke previews never reach the agent.
  await processQuery({query:'Aggiungi una nota a Mario Rossi',context:{features:{assistente_ai:'premium',agente_azione:'consulente'}},supabaseClient:client});
  await processQuery({query:'Aggiungi una nota a Mario Rossi',context:{features:{assistente_ai:'pro'}},supabaseClient:client});
  await processQuery({query:'Registra un pagamento di 100 euro per Mario Rossi',context:premium,supabaseClient:client});
  await processQuery({query:'Aggiungi una nota a Mario Rossi',context:premium,supabaseClient:client,allowModel:false});
  assert.equal(calls,4);
});
