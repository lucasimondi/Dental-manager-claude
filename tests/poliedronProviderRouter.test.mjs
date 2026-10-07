import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProvider, providerFailure, shouldFallback, anthropicToolsToOpenAI, openAIResponseToAnthropic, providerOrder, runProviderChain } from '../supabase/functions/agente-assistente/provider.js';

test('provider selector accepts explicit providers and auto', () => {
  assert.equal(normalizeProvider('openai'), 'openai');
  assert.equal(normalizeProvider('anthropic'), 'anthropic');
  assert.equal(normalizeProvider('gemini'), 'gemini');
  assert.equal(normalizeProvider('auto'), 'auto');
  assert.equal(normalizeProvider('unknown'), 'anthropic');
});

test('fallback is limited to transient provider failures', () => {
  assert.equal(shouldFallback({ ok:false, failure:providerFailure('openai',429,'rate_limit_or_quota') }), true);
  assert.equal(shouldFallback({ ok:false, failure:providerFailure('openai',503,'provider_unavailable') }), true);
  assert.equal(shouldFallback({ ok:false, failure:providerFailure('openai',503,'network_error') }), true);
  assert.equal(shouldFallback({ ok:false, failure:providerFailure('openai',503,'timeout') }), true);
  assert.equal(shouldFallback({ ok:false, failure:providerFailure('openai',400,'provider_error') }), false);
  assert.equal(shouldFallback({ ok:false, failure:providerFailure('openai',401,'provider_auth') }), false);
});

test('OpenAI tool conversion preserves schema', () => {
  const [tool] = anthropicToolsToOpenAI([{name:'cerca_pazienti',description:'x',input_schema:{type:'object',properties:{query:{type:'string'}}}}]);
  assert.equal(tool.type,'function'); assert.equal(tool.name,'cerca_pazienti'); assert.equal(tool.parameters.type,'object');
});

test('OpenAI function calls normalize to Poliedron tool_use', () => {
  const out=openAIResponseToAnthropic({output:[{type:'function_call',call_id:'c1',name:'cerca_pazienti',arguments:'{"query":"Mario"}'}]});
  assert.deepEqual(out.content[0],{type:'tool_use',id:'c1',name:'cerca_pazienti',input:{query:'Mario'}});
});


test('auto provider order is capability based and skips unconfigured providers', () => {
  assert.deepEqual(providerOrder({ preferred:'auto', capability:'tool_use', configured:{openai:true,anthropic:true,gemini:false} }), ['openai','anthropic']);
});

test('provider chain falls through transient failures', async () => {
  const seen=[];
  const out=await runProviderChain({providers:['openai','anthropic'],invoke:async(p)=>{seen.push(p);return p==='openai'?{ok:false,failure:providerFailure(p,429,'rate_limit_or_quota')}:{ok:true,data:{content:[]}}}});
  assert.deepEqual(seen,['openai','anthropic']); assert.equal(out.ok,true); assert.equal(out.provider,'anthropic');
});

test('provider chain never replays when replay is unsafe', async () => {
  const seen=[];
  const out=await runProviderChain({providers:['openai','anthropic'],canReplay:false,invoke:async(p)=>{seen.push(p);return {ok:false,failure:providerFailure(p,503,'provider_unavailable')}}});
  assert.deepEqual(seen,['openai']); assert.equal(out.ok,false);
});
