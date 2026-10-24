import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpHandler, connectorConfig, checkClaims, authenticateConnector } from '../server/connectorMcp.js';
const env = { POLIEDRA_MCP_URL: 'https://clinic.example/api/mcp', SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'public-test-key' };
const claims = () => ({ sub:'u1', client_id:'c1', session_id:'s', role:'authenticated', iss:'https://db.example/auth/v1', aud:['authenticated','https://clinic.example/api/mcp'], app_metadata:{studio_id:'s1'}, exp:Date.now()/1000+600 });
function setup({ patch={}, grants=[{client:{id:'c1'}}], disabled=false, upstreamError=false, currentStudio='s1' }={}) {
  const calls=[];
  const createClient=()=>({ auth: { getClaims:async()=>({data:{claims:{...claims(),...patch}}}),getUser:async()=>({data:{user:{id:'u1',app_metadata:{studio_id:currentStudio}}}}) }, from:()=>({select(){return this},eq(){return this},single:async()=>disabled?{error:true}:{data:{resource_uri:env.POLIEDRA_MCP_URL}}}) });
  const fetchImpl=async(url,options)=>{ calls.push({url,options}); if(url.endsWith('/oauth/grants'))return {ok:true,json:async()=>grants}; if(upstreamError)throw Error('lost');return {ok:true,json:async()=>JSON.parse(options.body).connector.operation==='tools'?{tools:[]}:{status:'pending',review_url:'https://clinic.example/connector/review?id=test'}}; };
  return {handler:createMcpHandler({env,createClient,fetchImpl}),calls,createClient,fetchImpl};
}
async function request(handler, body={jsonrpc:'2.0',id:1,method:'tools/list'},headers={authorization:'Bearer test','content-type':'application/json'},method='POST'){
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this},end(){return this}};
 await handler({method,headers,body},res);return res;
}
test('resource metadata uses canonical config and rejects missing/non-HTTPS config',()=>{
 assert.equal(connectorConfig(env).resource,env.POLIEDRA_MCP_URL);
 for(const patch of [{POLIEDRA_MCP_URL:''},{POLIEDRA_MCP_URL:'http://clinic.example/api/mcp'},{POLIEDRA_MCP_URL:'https://clinic.example/other'},{SUPABASE_ANON_KEY:''}])assert.throws(()=>connectorConfig({...env,...patch}));
});
test('claims bind signature result to resource, issuer, identity, tenant and expiry',()=>{
 checkClaims(claims(),connectorConfig(env));
 for(const patch of [{aud:'authenticated'},{iss:'https://evil.test'},{exp:0},{nbf:Date.now()/1000+600},{client_id:null},{role:'service_role'},{session_id:null},{app_metadata:{}}])assert.throws(()=>checkClaims({...claims(),...patch},connectorConfig(env)));
});
test('live grant revocation, disabled client and tenant change fail closed',async()=>{
 for(const options of [{grants:[]},{disabled:true},{currentStudio:'s2'},{patch:{aud:'authenticated'}}]){
 const s=setup(options);await assert.rejects(()=>authenticateConnector('test',connectorConfig(env),s.createClient,s.fetchImpl));}
});
test('unauthenticated and foreign origins cannot call tools',async()=>{
 const s=setup();const missing=await request(s.handler,undefined,{});assert.equal(missing.code,401);assert.match(missing.headers['WWW-Authenticate'],/oauth-protected-resource/);
 const foreign=await request(s.handler,undefined,{authorization:'Bearer test',origin:'https://evil.test'});assert.equal(foreign.code,403);assert.equal(s.calls.length,0);
});
test('initialize and tool list are standard MCP, no model API involved',async()=>{
 const s=setup();let out=await request(s.handler,{jsonrpc:'2.0',id:0,method:'initialize',params:{protocolVersion:'2025-06-18'}});assert.equal(out.body.id,0);assert.equal(out.body.result.protocolVersion,'2025-06-18');
 out=await request(s.handler);assert.deepEqual(out.body.result,{tools:[]});assert.equal(s.calls.filter(x=>x.url.includes('functions/v1')).length,1);
});
test('one structured call forwards only delegated auth and arguments; a timeout never retries',async()=>{
 const s=setup();const out=await request(s.handler,{jsonrpc:'2.0',id:'x',method:'tools/call',params:{name:'prepara_impianti',arguments:{paziente_id:7}}});
 assert.equal(out.body.result.structuredContent.status,'pending');assert.equal(s.calls.filter(x=>x.url.includes('functions/v1')).length,1);
 assert.deepEqual(JSON.parse(s.calls.at(-1).options.body),{connector:{operation:'call',name:'prepara_impianti',arguments:{paziente_id:7}}});
 const lost=setup({upstreamError:true});const failed=await request(lost.handler,{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'prepara_impianti',arguments:{}}});assert.equal(failed.body.result.isError,true);assert.equal(lost.calls.filter(x=>x.url.includes('functions/v1')).length,1);
});
test('malformed, batch, oversized, notification and unsupported requests never execute actions',async()=>{
 const s=setup();assert.equal((await request(s.handler,[])).body.error.code,-32600);
 assert.equal((await request(s.handler,{jsonrpc:'2.0',method:'tools/call',params:{name:'prepara_impianti'}})).body.error.code,-32600);
 assert.equal((await request(s.handler,'bad-json')).code,400);
 assert.equal((await request(s.handler,'a'.repeat(65537))).code,413);
 assert.equal((await request(s.handler,{jsonrpc:'2.0',method:'notifications/initialized'})).code,202);
 assert.equal((await request(s.handler,undefined,undefined,'GET')).code,405);
 assert.equal(s.calls.filter(x=>x.url.includes('functions/v1')).length,0);
});
