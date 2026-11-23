// POL-AI-GEMINI: Gemini adapter of Poliedron (studio). The model output must
// reach the existing tool/permission/confirmation layer in the same shape as
// Claude's, and the key must never appear in the URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  callGemini, geminiModel, GEMINI_DEFAULT_MODEL, GEMINI_SKIP_SIGNATURE,
  jsonSchemaToGemini, anthropicToolsToGemini, anthropicConversationToGemini,
  geminiResponseToAnthropic, geminiErrorKind, providerOrder, runProviderChain, providerFailure,
} from '../supabase/functions/agente-assistente/provider.js';

const withFetch = async (impl, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = original; }
};
const jsonResponse = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } });

test('model id is configurable but only a plain id reaches the URL', () => {
  assert.equal(geminiModel(undefined), GEMINI_DEFAULT_MODEL);
  assert.equal(geminiModel('gemini-3.8-flash'), 'gemini-3.8-flash');
  assert.equal(geminiModel('../../x?key=1'), GEMINI_DEFAULT_MODEL);
});

test('tool schemas become the OpenAPI subset Gemini accepts', () => {
  const out = jsonSchemaToGemini({
    type: 'object', additionalProperties: false,
    properties: { id: { type: 'string', format: 'uuid' }, nota: { type: ['string', 'null'] }, voci: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, properties: { importo: { type: 'number', minimum: 0 } } } } },
    required: ['id', 'mancante'],
  });
  assert.deepEqual(out, {
    type: 'object',
    properties: { id: { type: 'string' }, nota: { type: 'string', nullable: true }, voci: { type: 'array', minItems: 1, items: { type: 'object', properties: { importo: { type: 'number', minimum: 0 } } } } },
    required: ['id'],
  });
  const [decl] = anthropicToolsToGemini([{ name: 'cerca_pazienti', description: 'Cerca', input_schema: { type: 'object' } }]);
  assert.deepEqual(decl.functionDeclarations[0], { name: 'cerca_pazienti', description: 'Cerca', parameters: { type: 'object', properties: {} } });
  assert.deepEqual(anthropicToolsToGemini([]), []);
});

test('a tool round trip keeps names, results, attachments and roles', () => {
  const call = geminiResponseToAnthropic({ candidates: [{ content: { parts: [
    { text: 'ragiono', thought: true },
    { functionCall: { name: 'cerca_pazienti', args: { query: 'Mario Rossi' } }, thoughtSignature: 'sig-1' },
  ] } }] });
  assert.equal(call.content.length, 1, 'thought summaries are not answers');
  const [tu] = call.content;
  assert.equal(tu.type, 'tool_use'); assert.equal(tu.name, 'cerca_pazienti'); assert.deepEqual(tu.input, { query: 'Mario Rossi' });
  assert.ok(!JSON.stringify(tu).includes('sig-1'), 'the signature never leaks into a JSON body (Claude/OpenAI fallback)');

  const contents = anthropicConversationToGemini([
    { role: 'user', content: [{ type: 'text', text: 'Chi è?' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } }] },
    { role: 'assistant', content: call.content },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ risultati: [{ nome: 'Mario Rossi' }] }) }] },
    { role: 'user', content: 'e il telefono?' },
  ]);
  assert.deepEqual(contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.deepEqual(contents[0].parts[1], { inlineData: { mimeType: 'image/png', data: 'AAA' } });
  assert.deepEqual(contents[1].parts[0], { functionCall: { name: 'cerca_pazienti', args: { query: 'Mario Rossi' } }, thoughtSignature: 'sig-1' });
  assert.deepEqual(contents[2].parts[0], { functionResponse: { name: 'cerca_pazienti', response: { risultati: [{ nome: 'Mario Rossi' }] } } });
  assert.deepEqual(contents[2].parts[1], { text: 'e il telefono?' }, 'consecutive user turns are merged');
});

test('a copied tool_use without signature gets the documented placeholder on the first call only', () => {
  const contents = anthropicConversationToGemini([{ role: 'assistant', content: [
    { type: 'tool_use', id: 'a', name: 'x', input: {} }, { type: 'tool_use', id: 'b', name: 'y', input: {} },
  ] }]);
  assert.equal(contents[0].parts[0].thoughtSignature, GEMINI_SKIP_SIGNATURE);
  assert.equal(contents[0].parts[1].thoughtSignature, undefined);
});

test('non-object tool results are wrapped as Gemini requires', () => {
  const c = anthropicConversationToGemini([
    { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'conta', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: '[1,2]' }, { type: 'tool_result', tool_use_id: 't', content: 'testo' }] },
  ]);
  assert.deepEqual(c[1].parts[0].functionResponse.response, { result: [1, 2] });
  assert.deepEqual(c[1].parts[1].functionResponse.response, { result: 'testo' });
});

test('callGemini sends the key in a header and normalizes text and usage', async () => {
  const seen = [];
  const out = await withFetch(async (url, init) => {
    seen.push({ url, init });
    return jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'Domani hai 3 appuntamenti.' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 5 } });
  }, () => callGemini({ apiKey: 'k-test', model: 'gemini-2.5-flash', system: [{ type: 'text', text: 'Sei Poliedron' }], messages: [{ role: 'user', content: 'domani?' }], tools: [{ name: 'appuntamenti', input_schema: { type: 'object', properties: {} } }] }));
  assert.equal(out.ok, true);
  assert.deepEqual(out.data.content, [{ type: 'text', text: 'Domani hai 3 appuntamenti.' }]);
  assert.deepEqual(out.data.usage, { input_tokens: 100, output_tokens: 15, cache_read_input_tokens: 0 });
  assert.equal(seen[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  assert.equal(seen[0].init.headers['x-goog-api-key'], 'k-test');
  const body = JSON.parse(seen[0].init.body);
  assert.equal(body.systemInstruction.parts[0].text, 'Sei Poliedron');
  assert.equal(body.tools[0].functionDeclarations[0].name, 'appuntamenti');
  assert.equal(body.toolConfig.functionCallingConfig.mode, 'AUTO');
});

test('errors map to the same retry rules as the other providers', async () => {
  assert.equal(geminiErrorKind(429), 'rate_limit_or_quota');
  assert.equal(geminiErrorKind(503), 'provider_unavailable');
  assert.equal(geminiErrorKind(400, { error: { details: [{ reason: 'API_KEY_INVALID' }] } }), 'provider_auth');
  assert.equal(geminiErrorKind(400, {}), 'provider_error');
  const quota = await withFetch(async () => jsonResponse(429, { error: { status: 'RESOURCE_EXHAUSTED' } }), () => callGemini({ apiKey: 'k', messages: [] }));
  assert.equal(quota.ok, false); assert.equal(quota.failure.retryable, true);
  const missing = await callGemini({ apiKey: '', messages: [] });
  assert.equal(missing.failure.kind, 'provider_not_configured');
  const blocked = await withFetch(async () => jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }), () => callGemini({ apiKey: 'k', messages: [] }));
  assert.equal(blocked.ok, false); assert.equal(blocked.failure.retryable, false);
});

test('Gemini first when chosen; free quota exhausted falls back to Claude', async () => {
  const configured = { openai: false, anthropic: true, gemini: true };
  assert.deepEqual(providerOrder({ preferred: 'gemini', configured }), ['gemini', 'anthropic']);
  assert.deepEqual(providerOrder({ preferred: 'auto', configured }), ['anthropic', 'gemini']);
  assert.deepEqual(providerOrder({ preferred: 'gemini', configured: { gemini: true, anthropic: false, openai: false } }), ['gemini']);
  const seen = [];
  const out = await runProviderChain({ providers: ['gemini', 'anthropic'], invoke: async (p) => { seen.push(p); return p === 'gemini' ? { ok: false, failure: providerFailure(p, 429, 'rate_limit_or_quota') } : { ok: true, data: { content: [] } }; } });
  assert.deepEqual(seen, ['gemini', 'anthropic']); assert.equal(out.provider, 'anthropic');
});
