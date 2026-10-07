import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProvider, anthropicToolsToOpenAI, anthropicConversationToOpenAI, openAIResponseToAnthropic } from '../supabase/functions/agente-assistente/provider.js';

test('provider selector defaults safely to anthropic', () => {
  assert.equal(normalizeProvider('openai'), 'openai');
  assert.equal(normalizeProvider('gemini'), 'gemini');
  assert.equal(normalizeProvider('test'), 'anthropic');
  assert.equal(normalizeProvider(null), 'anthropic');
});

test('OpenAI adapter preserves Poliedron tool schemas', () => {
  const [tool] = anthropicToolsToOpenAI([{ name: 'crea_paziente', description: 'Crea', input_schema: { type: 'object', properties: { nome: { type: 'string' } } } }]);
  assert.equal(tool.type, 'function');
  assert.equal(tool.name, 'crea_paziente');
  assert.equal(tool.parameters.properties.nome.type, 'string');
});

test('conversation conversion preserves tool call and result ids', () => {
  const input = anthropicConversationToOpenAI([
    { role: 'user', content: 'crea Mario' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'call_1', name: 'crea_paziente', input: { nome: 'Mario' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: '{"ok":true}' }] },
  ]);
  assert.deepEqual(input[1], { type: 'function_call', call_id: 'call_1', name: 'crea_paziente', arguments: '{"nome":"Mario"}' });
  assert.deepEqual(input[2], { type: 'function_call_output', call_id: 'call_1', output: '{"ok":true}' });
});

test('OpenAI response normalizes to existing Poliedron blocks', () => {
  const out = openAIResponseToAnthropic({
    output: [
      { type: 'message', content: [{ type: 'output_text', text: 'Procedo.' }] },
      { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'crea_paziente', arguments: '{"nome":"Mario"}' },
    ],
    usage: { input_tokens: 12, output_tokens: 4, input_tokens_details: { cached_tokens: 3 } },
  });
  assert.equal(out.content[0].text, 'Procedo.');
  assert.deepEqual(out.content[1], { type: 'tool_use', id: 'call_1', name: 'crea_paziente', input: { nome: 'Mario' } });
  assert.equal(out.usage.input_tokens, 12);
});
