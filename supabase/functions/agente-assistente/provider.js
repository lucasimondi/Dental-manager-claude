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
  strict: false,
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
  let resp;
  try {
    resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions: Array.isArray(system) ? system.map((part) => part?.text || '').filter(Boolean).join('\n\n') : String(system || ''),
      input: anthropicConversationToOpenAI(messages),
      ...(tools?.length ? { tools: anthropicToolsToOpenAI(tools), tool_choice: 'auto' } : {}),
    }),
      signal,
    });
  } catch (error) {
    const kind = error?.name === 'AbortError' ? 'timeout' : 'network_error';
    console.error('llm_provider_error', JSON.stringify({ provider: 'openai', status: 503, kind }));
    return { ok: false, failure: providerFailure('openai', 503, kind) };
  }
  if (!resp.ok) {
    const errText = await resp.text();
    const status = resp.status;
    let errorCode = null, errorParam = null, errorType = null;
    try { const parsed = JSON.parse(errText); errorCode = parsed?.error?.code || null; errorParam = parsed?.error?.param || null; errorType = parsed?.error?.type || null; } catch {}
    const kind = status === 429 ? 'rate_limit_or_quota' : status >= 500 ? 'provider_unavailable' : status === 401 || status === 403 ? 'provider_auth' : 'provider_error';
    console.error('llm_provider_error', JSON.stringify({ provider: 'openai', status, kind, errorCode, errorParam, errorType, requestId: resp.headers?.get?.('x-request-id') || null }));
    return { ok: false, failure: providerFailure('openai', status, kind, resp.headers?.get?.('x-request-id') || null) };
  }
  const raw = await resp.json();
  return { ok: true, data: openAIResponseToAnthropic(raw), raw };
}


export const PROVIDER_CAPABILITIES = Object.freeze({
  openai: new Set(['chat', 'tool_use', 'reasoning']),
  anthropic: new Set(['chat', 'tool_use', 'reasoning']),
  gemini: new Set(['chat', 'tool_use', 'reasoning']),
});

// The chosen provider goes first; every other configured one stays behind it
// as an automatic fallback (PO: "Devi farlo automaticamente" after OpenAI
// ran out of credit and Poliedron answered "servizi AI indisponibili").
export const providerOrder = ({ preferred = 'auto', capability = 'tool_use', configured = {} } = {}) => {
  const available = (name) => configured[name] !== false && PROVIDER_CAPABILITIES[name]?.has(capability);
  const all = ['openai', 'anthropic', 'gemini'].filter(available);
  if (preferred === 'auto' || !all.includes(preferred)) return all;
  return [preferred, ...all.filter((name) => name !== preferred)];
};

export async function runProviderChain({ providers, invoke, canReplay = true, onFallback = () => {} }) {
  let last = null;
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const result = await invoke(provider);
    last = result;
    if (result?.ok) return { ...result, provider };
    if (!canReplay || !shouldFallback(result) || i === providers.length - 1) return result;
    onFallback({ from: provider, to: providers[i + 1], failure: result?.failure || null });
  }
  return last || { ok: false, failure: providerFailure('router', 503, 'provider_not_configured') };
}

// ---------------------------------------------------------------------------
// Gemini (Google AI Studio API key). POL-AI-GEMINI, PO 2026-11-23: Gemini as
// a Poliedron model for the studio, patient names sent as they are (no
// pseudonymisation, explicit PO choice). Same contract as OpenAI above: the
// response becomes Anthropic-shaped content, so tools, permissions and signed
// confirmations stay exactly the ones Poliedron already uses.
// ---------------------------------------------------------------------------

export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';

// Only a plain model id may reach the request URL.
export const geminiModel = (value) => {
  const v = String(value || '').trim();
  return /^[a-z0-9][a-z0-9.\-]{0,62}$/i.test(v) ? v : GEMINI_DEFAULT_MODEL;
};

// Gemini 3 requires the thought signature of a function call to come back with
// it on the next turn. It is kept on the tool_use block as a NON-enumerable
// property: JSON.stringify drops it, so an Anthropic/OpenAI fallback in the same
// request never sees an unknown field. When it is missing (a block that was
// copied) Google's documented placeholder keeps validation from failing.
const SIGNATURE = 'geminiThoughtSignature';
export const GEMINI_SKIP_SIGNATURE = 'skip_thought_signature_validator';

const GEMINI_SCHEMA_KEYS = new Set([
  'type', 'description', 'enum', 'properties', 'required', 'items', 'nullable',
  'minItems', 'maxItems', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'anyOf', 'title',
]);

// Gemini's `parameters` accepts an OpenAPI subset: unknown keywords
// (additionalProperties, format: uuid, $schema...) are dropped and
// `type: ['string','null']` becomes `type: 'string', nullable: true`.
export const jsonSchemaToGemini = (schema) => {
  if (Array.isArray(schema)) return schema.map(jsonSchemaToGemini);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!GEMINI_SCHEMA_KEYS.has(key)) continue;
    if (key === 'type' && Array.isArray(value)) {
      const types = value.filter((t) => t !== 'null');
      out.type = types[0] || 'string';
      if (types.length !== value.length) out.nullable = true;
    } else if (key === 'properties') {
      out.properties = Object.fromEntries(Object.entries(value || {}).map(([k, v]) => [k, jsonSchemaToGemini(v)]));
    } else if (key === 'items' || key === 'anyOf') {
      out[key] = jsonSchemaToGemini(value);
    } else {
      out[key] = value;
    }
  }
  if (out.type === 'object' && !out.properties) out.properties = {};
  if (Array.isArray(out.required) && out.properties) out.required = out.required.filter((k) => k in out.properties);
  return out;
};

export const anthropicToolsToGemini = (tools = []) => tools.length ? [{
  functionDeclarations: tools.map((t) => ({
    name: t.name,
    description: t.description || '',
    parameters: jsonSchemaToGemini(t.input_schema || { type: 'object', properties: {} }),
  })),
}] : [];

const systemText = (system) => Array.isArray(system)
  ? system.map((part) => part?.text || '').filter(Boolean).join('\n\n')
  : String(system || '');

const toolResultValue = (content) => {
  const text = Array.isArray(content)
    ? content.map((b) => (b?.type === 'text' ? b.text : '')).join('\n')
    : String(content ?? '');
  try {
    const parsed = JSON.parse(text);
    // functionResponse.response must be an object.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { result: parsed };
  } catch {
    return { result: text };
  }
};

export const anthropicConversationToGemini = (messages = []) => {
  // A tool_result only carries the id: the name comes from the earlier tool_use.
  const names = new Map();
  for (const m of messages) {
    for (const b of Array.isArray(m?.content) ? m.content : []) if (b?.type === 'tool_use') names.set(b.id, b.name);
  }
  const contents = [];
  for (const m of messages) {
    const role = m?.role === 'assistant' ? 'model' : 'user';
    const parts = [];
    if (typeof m?.content === 'string') {
      if (m.content) parts.push({ text: m.content });
    } else {
      let firstCall = true;
      for (const b of Array.isArray(m?.content) ? m.content : []) {
        if (b?.type === 'text' && b.text) parts.push({ text: b.text });
        else if ((b?.type === 'image' || b?.type === 'document') && b.source?.type === 'base64') {
          parts.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
        } else if (b?.type === 'tool_use') {
          const part = { functionCall: { name: b.name, args: b.input || {} } };
          const signature = b[SIGNATURE] || (firstCall ? GEMINI_SKIP_SIGNATURE : null);
          if (signature) part.thoughtSignature = signature;
          firstCall = false;
          parts.push(part);
        } else if (b?.type === 'tool_result') {
          parts.push({ functionResponse: { name: names.get(b.tool_use_id) || 'strumento', response: toolResultValue(b.content) } });
        }
      }
    }
    if (!parts.length) continue;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else contents.push({ role, parts });
  }
  return contents;
};

let geminiCallSeq = 0;
const geminiCallId = () => `gm_${Date.now().toString(36)}_${(geminiCallSeq++).toString(36)}`;

export const geminiResponseToAnthropic = (response = {}) => {
  const content = [];
  const candidate = response.candidates?.[0];
  for (const part of candidate?.content?.parts || []) {
    if (part?.thought) continue; // reasoning summaries are not answers
    if (part?.functionCall) {
      const block = { type: 'tool_use', id: part.functionCall.id || geminiCallId(), name: part.functionCall.name, input: part.functionCall.args || {} };
      if (part.thoughtSignature) Object.defineProperty(block, SIGNATURE, { value: part.thoughtSignature, enumerable: false });
      content.push(block);
    } else if (typeof part?.text === 'string' && part.text) {
      content.push({ type: 'text', text: part.text });
    }
  }
  const u = response.usageMetadata;
  return {
    content,
    finishReason: candidate?.finishReason || response.promptFeedback?.blockReason || null,
    usage: u ? {
      input_tokens: u.promptTokenCount || 0,
      output_tokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
      cache_read_input_tokens: u.cachedContentTokenCount || 0,
    } : undefined,
  };
};

export const geminiErrorKind = (status, body = {}) => {
  const reason = (body?.error?.details || []).map((d) => d?.reason).find(Boolean) || null;
  if (status === 429) return 'rate_limit_or_quota';
  if (status >= 500) return 'provider_unavailable';
  if (status === 401 || status === 403 || reason === 'API_KEY_INVALID') return 'provider_auth';
  return 'provider_error';
};

export async function callGemini({ apiKey, model, system, messages, tools, signal, maxOutputTokens = 4096 }) {
  if (!apiKey) return { ok: false, failure: providerFailure('gemini', 503, 'provider_not_configured') };
  const id = geminiModel(model);
  const instruction = systemText(system);
  let resp;
  try {
    resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        ...(instruction ? { systemInstruction: { parts: [{ text: instruction }] } } : {}),
        contents: anthropicConversationToGemini(messages),
        ...(tools?.length ? { tools: anthropicToolsToGemini(tools), toolConfig: { functionCallingConfig: { mode: 'AUTO' } } } : {}),
        generationConfig: { maxOutputTokens },
      }),
      signal,
    });
  } catch (error) {
    const kind = error?.name === 'AbortError' ? 'timeout' : 'network_error';
    console.error('llm_provider_error', JSON.stringify({ provider: 'gemini', status: 503, kind }));
    return { ok: false, failure: providerFailure('gemini', 503, kind) };
  }
  if (!resp.ok) {
    const status = resp.status;
    let body = {};
    try { body = JSON.parse(await resp.text()); } catch {}
    const kind = geminiErrorKind(status, body);
    // Status and Google's error code only: never the prompt or the key.
    console.error('llm_provider_error', JSON.stringify({ provider: 'gemini', model: id, status, kind, errorStatus: body?.error?.status || null }));
    return { ok: false, failure: providerFailure('gemini', status, kind) };
  }
  const raw = await resp.json();
  const data = geminiResponseToAnthropic(raw);
  if (!data.content.length && raw?.promptFeedback?.blockReason) {
    console.error('llm_provider_error', JSON.stringify({ provider: 'gemini', model: id, status: 200, kind: 'provider_blocked', reason: raw.promptFeedback.blockReason }));
    return { ok: false, failure: providerFailure('gemini', 422, 'provider_blocked') };
  }
  return { ok: true, data, raw };
}
