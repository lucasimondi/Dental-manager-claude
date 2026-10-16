import test from 'node:test';
import assert from 'node:assert/strict';
import { studioDb, salvaImpegno, impegniTra } from '../personal/src/lib/studio.js';

test('Personal saves the required numeric id and reloads the authoritative record; missing tenant fails closed', async () => {
 const getSession=studioDb.auth.getSession,from=studioDb.from;
 let session={user:{id:'test-user',app_metadata:{studio_id:'test-studio'}}};
 let rows=[],updates=0;
 studioDb.auth.getSession=async()=>({data:{session}});
 studioDb.from=table=>{
  assert.equal(table,'impegni_personali');
  let row=null,updating=false;
  const query={
   insert(r){ assert.ok(Number.isSafeInteger(r.id));assert.equal(r.studio_id,'test-studio');assert.equal(r.user_id,'test-user');rows.push(r);row=r;return this; },
   update(r){updates++;updating=true;row=r;return this;},
   eq(key,id){if(updating){rows=rows.map(r=>r.id===id?{...r,...row}:r);row=rows.find(r=>r.id===id);}return this;},
   select(){return this;},single(){return Promise.resolve({data:row,error:null});},
   lte(){return this;},gte(){return this;},order(){return Promise.resolve({data:rows,error:null});},
  };return query;
 };
 try{
  const input={titolo:'Cena',tipo:'personale',data_inizio:'2026-10-16',data_fine:'2026-10-16',tutto_il_giorno:false,ora_inizio:'23:30',ora_fine:'23:59'};
  const saved=await salvaImpegno(input);assert.ok(saved.id);
  assert.equal((await impegniTra('2026-10-16','2026-10-16'))[0].id,saved.id);
  await salvaImpegno({...input,id:saved.id,titolo:'Cena aggiornata'});
  assert.equal(rows.length,1);assert.equal(updates,1);assert.equal(rows[0].titolo,'Cena aggiornata');
  session={user:{id:'test-user',app_metadata:{}}};
  await assert.rejects(salvaImpegno(input),/senza studio associato/);assert.equal(rows.length,1);
 }finally{studioDb.auth.getSession=getSession;studioDb.from=from;}
});
