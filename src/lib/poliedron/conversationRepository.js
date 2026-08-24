export const CHAT_PAGE_SIZE = 40;
export const MODEL_HISTORY_MAX_MESSAGES = 20;
export const MODEL_HISTORY_MAX_CHARS = 12000;

const CONVERSATION_FIELDS = 'id, studio_id, user_id, conversation_kind, created_at, updated_at';
const MESSAGE_FIELDS = 'id, conversation_id, request_id, role, content, delivery_status, read_at, metadata, created_at';

const requireIdentity = (studioId, userId) => {
  if (!studioId || !userId) throw new Error('CHAT_IDENTITY_REQUIRED');
};

const requireClient = (client) => {
  if (!client?.from) throw new Error('CHAT_SUPABASE_CLIENT_REQUIRED');
};

export function createChatRequestId() {
  const requestId = globalThis.crypto?.randomUUID?.();
  if (!requestId) throw new Error('CHAT_REQUEST_ID_UNAVAILABLE');
  return requestId;
}

export async function getOrCreatePrimaryConversation({ client, studioId, userId }) {
  requireClient(client);
  requireIdentity(studioId, userId);

  const find = () => client
    .from('poliedron_conversations')
    .select(CONVERSATION_FIELDS)
    .eq('studio_id', studioId)
    .eq('user_id', userId)
    .eq('conversation_kind', 'primary')
    .maybeSingle();

  const existing = await find();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await client
    .from('poliedron_conversations')
    .insert({ studio_id: studioId, user_id: userId, conversation_kind: 'primary' })
    .select(CONVERSATION_FIELDS)
    .single();
  if (!created.error) return created.data;

  // Two tabs may race to create the unique primary thread. Re-read only for
  // that expected conflict; every other database/RLS error remains explicit.
  if (created.error.code !== '23505') throw created.error;
  const raced = await find();
  if (raced.error) throw raced.error;
  if (!raced.data) throw created.error;
  return raced.data;
}

export async function loadConversationMessages({
  client,
  conversationId,
  beforeId = null,
  limit = CHAT_PAGE_SIZE,
}) {
  requireClient(client);
  if (!conversationId) throw new Error('CHAT_CONVERSATION_REQUIRED');

  const boundedLimit = Math.max(1, Math.min(Number(limit) || CHAT_PAGE_SIZE, 100));
  let query = client
    .from('poliedron_messages')
    .select(MESSAGE_FIELDS)
    .eq('conversation_id', conversationId)
    .order('id', { ascending: false })
    .limit(boundedLimit);
  if (beforeId != null) query = query.lt('id', beforeId);

  const { data, error } = await query;
  if (error) throw error;
  const descending = data || [];
  return {
    messages: [...descending].reverse(),
    hasOlder: descending.length === boundedLimit,
  };
}

export async function appendConversationMessage({
  client,
  conversationId,
  requestId,
  role,
  content,
  deliveryStatus = 'sent',
  readAt = null,
  metadata = {},
}) {
  requireClient(client);
  if (!conversationId || !requestId) throw new Error('CHAT_MESSAGE_IDENTITY_REQUIRED');
  const normalizedContent = String(content || '').trim();
  if (!normalizedContent) throw new Error('CHAT_MESSAGE_CONTENT_REQUIRED');

  const { data, error } = await client
    .from('poliedron_messages')
    .insert({
      conversation_id: conversationId,
      request_id: requestId,
      role,
      content: normalizedContent,
      delivery_status: deliveryStatus,
      read_at: readAt,
      metadata,
    })
    .select(MESSAGE_FIELDS)
    .single();
  if (error?.code === '23505') {
    const existing = await client
      .from('poliedron_messages')
      .select(MESSAGE_FIELDS)
      .eq('conversation_id', conversationId)
      .eq('request_id', requestId)
      .eq('role', role)
      .single();
    if (existing.error) throw existing.error;
    return existing.data;
  }
  if (error) throw error;
  return data;
}

export async function updateMessageDeliveryStatus({ client, messageId, deliveryStatus }) {
  requireClient(client);
  if (!messageId) throw new Error('CHAT_MESSAGE_REQUIRED');
  const { data, error } = await client
    .from('poliedron_messages')
    .update({ delivery_status: deliveryStatus })
    .eq('id', messageId)
    .select(MESSAGE_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function markMessagesRead({ client, messageIds, readAt = new Date().toISOString() }) {
  requireClient(client);
  const ids = [...new Set((messageIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await client
    .from('poliedron_messages')
    .update({ read_at: readAt })
    .in('id', ids)
    .is('read_at', null)
    .select(MESSAGE_FIELDS);
  if (error) throw error;
  return data || [];
}

export async function countUnreadMessages({ client, conversationId }) {
  requireClient(client);
  if (!conversationId) return 0;
  const { count, error } = await client
    .from('poliedron_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .in('role', ['assistant', 'system'])
    .is('read_at', null);
  if (error) throw error;
  return count || 0;
}

export function subscribeToConversation({ client, conversationId, onChange, onSubscribed }) {
  if (!client?.channel || !conversationId || typeof onChange !== 'function') return () => {};
  const channel = client
    .channel(`poliedron-conversation-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'poliedron_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      onChange
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onSubscribed?.();
    });
  return () => {
    client.removeChannel?.(channel);
  };
}

export function normalizeModelHistory(
  messages,
  {
    excludeRequestId = null,
    maxMessages = MODEL_HISTORY_MAX_MESSAGES,
    maxChars = MODEL_HISTORY_MAX_CHARS,
  } = {}
) {
  const eligible = (messages || []).filter((message) =>
    (message.role === 'user' || message.role === 'assistant')
    && message.delivery_status === 'sent'
    && message.request_id !== excludeRequestId
    && typeof message.content === 'string'
    && message.content.trim()
  );

  const selected = [];
  let chars = 0;
  for (let index = eligible.length - 1; index >= 0 && selected.length < maxMessages; index -= 1) {
    const message = eligible[index];
    let content = message.content.trim();
    if (!selected.length && content.length > maxChars) {
      content = content.slice(0, maxChars);
    }
    if (selected.length && chars + content.length > maxChars) break;
    selected.push({ role: message.role, content });
    chars += content.length;
  }
  return selected.reverse();
}
