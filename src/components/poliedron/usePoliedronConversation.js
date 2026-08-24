import { useCallback, useEffect, useRef, useState } from 'react';
import {
  appendConversationMessage,
  countUnreadMessages,
  getOrCreatePrimaryConversation,
  loadConversationMessages,
  markMessagesRead,
  subscribeToConversation,
  updateMessageDeliveryStatus,
} from '../../lib/poliedron/conversationRepository.js';

const mergeMessages = (current, incoming) => {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id);
};

export default function usePoliedronConversation({ client, studioId, userId }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(null);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const unreadRefreshSeq = useRef(0);
  const recentRefreshSeq = useRef(0);
  const messageStateVersion = useRef(0);

  const refreshUnread = useCallback(async (conversationId = conversation?.id) => {
    if (!conversationId) return 0;
    const seq = ++unreadRefreshSeq.current;
    const count = await countUnreadMessages({ client, conversationId });
    if (seq === unreadRefreshSeq.current) setUnreadCount(count);
    return count;
  }, [client, conversation?.id]);

  const refreshRecent = useCallback(async (conversationId = conversation?.id) => {
    if (!conversationId) return;
    const seq = ++recentRefreshSeq.current;
    const stateVersion = messageStateVersion.current;
    const recent = await loadConversationMessages({ client, conversationId });
    if (seq !== recentRefreshSeq.current || stateVersion !== messageStateVersion.current) return;
    setMessages((current) => mergeMessages(current, recent.messages));
    setHasOlder(recent.hasOlder);
    await refreshUnread(conversationId);
  }, [client, conversation?.id, refreshUnread]);

  useEffect(() => {
    let cancelled = false;
    setConversation(null);
    setMessages([]);
    setHasOlder(false);
    setUnreadCount(0);
    unreadRefreshSeq.current += 1;
    recentRefreshSeq.current += 1;
    messageStateVersion.current += 1;
    setError(null);
    if (!client || !studioId || !userId) return undefined;

    setLoading(true);
    (async () => {
      try {
        const primary = await getOrCreatePrimaryConversation({ client, studioId, userId });
        const recent = await loadConversationMessages({ client, conversationId: primary.id });
        const unread = await countUnreadMessages({ client, conversationId: primary.id });
        if (cancelled) return;
        setConversation(primary);
        setMessages(recent.messages);
        setHasOlder(recent.hasOlder);
        setUnreadCount(unread);
      } catch (nextError) {
        if (!cancelled) setError(nextError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client, studioId, userId, initializationAttempt]);

  useEffect(() => {
    if (!conversation?.id) return undefined;
    return subscribeToConversation({
      client,
      conversationId: conversation.id,
      onChange: () => {
        refreshRecent(conversation.id).catch(setError);
      },
      // Close the load -> subscribe race: an authoritative snapshot after the
      // channel is live includes any event emitted between those two phases.
      onSubscribed: () => {
        refreshRecent(conversation.id).catch(setError);
      },
    });
  }, [client, conversation?.id, refreshRecent]);

  const loadOlder = useCallback(async () => {
    if (!conversation?.id || !messages.length || loadingOlder || !hasOlder) return;
    setLoadingOlder(true);
    try {
      const older = await loadConversationMessages({
        client,
        conversationId: conversation.id,
        beforeId: messages[0].id,
      });
      setMessages((current) => mergeMessages(older.messages, current));
      setHasOlder(older.hasOlder);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoadingOlder(false);
    }
  }, [client, conversation?.id, messages, loadingOlder, hasOlder]);

  const appendMessage = useCallback(async (message) => {
    if (!conversation?.id) throw new Error('CHAT_CONVERSATION_NOT_READY');
    const created = await appendConversationMessage({
      client,
      conversationId: conversation.id,
      ...message,
    });
    messageStateVersion.current += 1;
    setMessages((current) => mergeMessages(current, [created]));
    if ((created.role === 'assistant' || created.role === 'system') && !created.read_at) {
      setUnreadCount((count) => count + 1);
    }
    return created;
  }, [client, conversation?.id]);

  const setDeliveryStatus = useCallback(async (messageId, deliveryStatus) => {
    const updated = await updateMessageDeliveryStatus({ client, messageId, deliveryStatus });
    messageStateVersion.current += 1;
    setMessages((current) => mergeMessages(current, [updated]));
    return updated;
  }, [client]);

  const markVisibleMessagesRead = useCallback(async () => {
    const unreadIds = messages
      .filter((message) =>
        (message.role === 'assistant' || message.role === 'system') && !message.read_at
      )
      .map((message) => message.id);
    if (!unreadIds.length) {
      await refreshUnread();
      return;
    }
    try {
      const updated = await markMessagesRead({ client, messageIds: unreadIds });
      messageStateVersion.current += 1;
      setMessages((current) => mergeMessages(current, updated));
      await refreshUnread();
    } catch (nextError) {
      setError(nextError);
    }
  }, [client, messages, refreshUnread]);

  const retryInitialization = useCallback(() => {
    setInitializationAttempt((attempt) => attempt + 1);
  }, []);

  return {
    conversation,
    messages,
    hasOlder,
    loading,
    loadingOlder,
    unreadCount,
    error,
    setError,
    loadOlder,
    appendMessage,
    setDeliveryStatus,
    markVisibleMessagesRead,
    refreshUnread,
    retryInitialization,
  };
}
