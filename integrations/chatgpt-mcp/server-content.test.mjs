import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
process.env.POLIEDRON_SUPABASE_URL='https://synthetic.supabase.co';
process.env.POLIEDRON_SUPABASE_PUBLISHABLE_KEY='synthetic-publishable';
process.env.POLIEDRON_ARCHIVE_ENDPOINT='https://archive.example/exec';
const {handler}=await import('./server.mjs?content-tests');
const fetchReal=globalThis.fetch;
const id='c092682e-59fc-4a90-a320-a751183ade65';
const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('HTTP content respects auth, RLS denial and clinical exclusion; emits image blocks',async()=>{
 let rows=[],driveCalls=0;
 globalThis.fetch=async(input,init)=>{
  const url=new URL(input);
  if(url.hostname==='127.0.0.1')return fetchReal(input,init);
  if(url.pathname==='/auth/v1/user')return init.headers.authorization==='Bearer valid-synthetic'?Response.json({id:'owner-test'}):Response.json({}, {status:401});
  if(url.hostname==='archive.example'){driveCalls++;assert.equal(JSON.parse(init.body).azione,'file');return Response.json({ok:true,mime:'image/png',nome:'synthetic.png',dati:image});}
  assert.match(url.searchParams.get('select'),/drive_file_id/);
  assert.equal(url.searchParams.get('fascicolo'),'neq.clinico_pazienti');
  assert.equal(init.headers.authorization,'Bearer valid-synthetic');
  return Response.json(rows);
 };
 const server=createServer(handler());await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=async(token,args)=>{
  const response=await fetchReal(`http://127.0.0.1:${server.address().port}/mcp`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_document',arguments:{id,...args}}})});
  return {status:response.status,body:await response.json()};
 };
 try{
  assert.equal((await call(null,{})).status,401);assert.equal((await call('wrong',{})).status,401);assert.equal(driveCalls,0);
  let response=await call('valid-synthetic',{});assert.match(response.body.result.content[0].text,/non disponibile/);assert.equal(driveCalls,0);
  rows=[{id,fascicolo:'clinico_pazienti',drive_file_id:'synthetic_file_id'}];response=await call('valid-synthetic',{});assert.match(response.body.result.content[0].text,/non disponibile/);assert.equal(driveCalls,0);
  rows=[{id,fascicolo:'altro',titolo:'synthetic',drive_file_id:'synthetic_file_id'}];response=await call('valid-synthetic',{include_content:false});assert.equal(response.body.result.content.length,1);assert.equal(driveCalls,0);
  response=await call('valid-synthetic',{});assert.equal(response.body.result.content[1].type,'image');assert.equal(response.body.result.content[1].data,image);assert.equal(driveCalls,1);assert.ok(!response.body.result.content[0].text.includes('drive_file_id'));
 }finally{globalThis.fetch=fetchReal;await new Promise(r=>server.close(r));}
});
