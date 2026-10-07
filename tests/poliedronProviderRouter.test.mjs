import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProvider, providerFailure, shouldFallback, anthropicToolsToOpenAI, openAIResponseToAnthropic } from '../supabase/functions/agente-assistente/provider.js';

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
