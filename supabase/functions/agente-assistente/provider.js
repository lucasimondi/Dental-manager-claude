// Provider adapters for Poliedron. They normalize every model to the existing
// Anthropic-shaped { content: [{type:'text'|'tool_use', ...}], usage } contract.
// This keeps authorization, confirmations and DB writes provider-independent.

export const normalizeProvider = (value) => {
  const v = String(value || '').trim().toLowerCase();
  return ['anthropic', 'openai', 'gemini', 'auto'].includes(v) ? v : 'anthropic';
};

export const providerFailure = (provider, status, kind, requestId = null) => ({
  provider, status, kind, requestId,
  retryable: status === 429 || status >= 500 || kind === 'network_error' || kind === 'timeout',
});

export const shouldFallback = (result) => Boolean(!result?.ok && result?.failure?.retryable);

export const anthropicToolsToOpenAI = (tools = []) => tools.map((t) => ({
  type: 'function',
  name: t.name,
  description: t.description || '',
  parameters: t.input_schema || { type: 'object', properties: {} },
}));

export const anthropicConversationToOpenAI = (messages = []) => {
  const input = [];
  for (const m of messages) {
    if (typeof m.content === 'string') {
      input.push({ role: m.role, content: m.content });
      continue;
    }
    const blocks = Array.isArray(m.content) ? m.content : [];
    const texts = blocks.filter((b) => b?.type === 'text').map((b) => b.text).filter(Boolean);
    if (texts.length) input.push({ role: m.role, content: texts.join('\n') });
    for (const b of blocks) {
      if (b?.type === 'tool_use') {
        input.push({ type: 'function_call', call_id: b.id, name: b.name, arguments: JSON.stringify(b.input || {}) });
      } else if (b?.type === 'tool_result') {
        input.push({ type: 'function_call_output', call_id: b.tool_use_id, output: String(b.content ?? '') });
      }
    }
  }
  return input;
};

export const openAIResponseToAnthropic = (response = {}) => {
  const content = [];
  for (const item of response.output || []) {
    if (item?.type === 'message') {
      for (const part of item.content || []) {
        if (part?.type === 'output_text' && part.text) content.push({ type: 'text', text: part.text });
      }
    } else if (item?.type === 'function_call') {
      let input = {};
      try { input = JSON.parse(item.arguments || '{}'); } catch { input = {}; }
      content.push({ type: 'tool_use', id: item.call_id || item.id, name: item.name, input });
    }
  }
  return {
    content,
    usage: response.usage ? {
      input_tokens: response.usage.input_tokens || 0,
      output_tokens: response.usage.output_tokens || 0,
      cache_read_input_tokens: response.usage.input_tokens_details?.cached_tokens || 0,
    } : undefined,
  };
};

export async function callOpenAI({ apiKey, model, system, messages, tools, signal }) {
  if (!apiKey) return { ok: false, failure: providerFailure('openai', 503, 'provider_not_configured') };
  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions: system,
      input: anthropicConversationToOpenAI(messages),
      ...(tools?.length ? { tools: anthropicToolsToOpenAI(tools), tool_choice: 'auto' } : {}),
    }),
    signal,
  });
  if (!resp.ok) {
    const errText = await resp.text();
    const status = resp.status;
    const kind = status === 429 ? 'rate_limit_or_quota' : status >= 500 ? 'provider_unavailable' : status === 401 || status === 403 ? 'provider_auth' : 'provider_error';
    console.error('llm_provider_error', JSON.stringify({ provider: 'openai', status, kind, requestId: resp.headers?.get?.('x-request-id') || null }));
    return { ok: false, failure: providerFailure('openai', status, kind, resp.headers?.get?.('x-request-id') || null) };
  }
  const raw = await resp.json();
  return { ok: true, data: openAIResponseToAnthropic(raw), raw };
}
