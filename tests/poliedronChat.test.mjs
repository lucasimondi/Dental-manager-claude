import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  MODEL_HISTORY_MAX_CHARS,
  MODEL_HISTORY_MAX_MESSAGES,
  normalizeModelHistory,
} from '../src/lib/poliedron/conversationRepository.js';
import { runModelTask } from '../src/lib/poliedron/modelGateway.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';
import { buildContext } from '../src/lib/poliedron/contextEngine.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.jsx');
const controller = read('../src/components/poliedron/Poliedron.jsx');
const chatPage = read('../src/components/poliedron/PoliedronChatPage.jsx');
const dock = read('../src/components/poliedron/PoliedronMobileDock.jsx');
const css = read('../src/components/PremiumVisualSystem.css');
const searchEngine = read('../src/lib/poliedron/searchEngine.js');
const migration = read('../supabase/migrations/20260824030000_chat_polyedron.sql');
const rlsTest = read('../supabase/tests/chat_polyedron_rls.sql');
const conversationHook = read('../src/components/poliedron/usePoliedronConversation.js');
const conversationRepository = read('../src/lib/poliedron/conversationRepository.js');
const panel = read('../src/components/poliedron/PoliedronPanel.jsx');

test('model history is bounded, ordered, excludes failed/current messages, and keeps only conversational roles', () => {
  const messages = Array.from({ length: 28 }, (_, index) => ({
    id: index + 1,
    request_id: `request-${index}`,
    role: index % 2 ? 'assistant' : 'user',
    content: `message-${index}`,
    delivery_status: index === 26 ? 'failed' : 'sent',
  }));
  messages.push({
    id: 29,
    request_id: 'system-request',
    role: 'system',
    content: 'not model history',
    delivery_status: 'sent',
  });

  const history = normalizeModelHistory(messages, { excludeRequestId: 'request-27' });
  assert.ok(history.length <= MODEL_HISTORY_MAX_MESSAGES);
  assert.ok(history.reduce((sum, message) => sum + message.content.length, 0) <= MODEL_HISTORY_MAX_CHARS);
  assert.ok(history.every((message) => message.role === 'user' || message.role === 'assistant'));
  assert.ok(!history.some((message) => message.content === 'message-26'));
  assert.ok(!history.some((message) => message.content === 'message-27'));
  assert.equal(history.at(-1).content, 'message-25');
  const oversized = normalizeModelHistory([{
    request_id: 'oversized',
    role: 'assistant',
    content: 'x'.repeat(MODEL_HISTORY_MAX_CHARS + 4000),
    delivery_status: 'sent',
  }]);
  assert.equal(oversized[0].content.length, MODEL_HISTORY_MAX_CHARS);
});

test('model gateway sends bounded history and current input through the one existing Edge Function', async () => {
  let invocation = null;
  const result = await runModelTask({
    taskType: 'ASK',
    input: 'Cosa avevamo detto ieri?',
    history: [
      { role: 'user', content: 'Parlavamo dei richiami.' },
      { role: 'assistant', content: 'Ne risultavano sette.' },
    ],
    context: { page: 'chat', vertical: 'dentistico' },
    supabaseClient: {
      functions: {
        invoke: async (name, options) => {
          invocation = { name, options };
          return { data: { text: 'Avevamo parlato di sette richiami.' }, error: null };
        },
      },
    },
  });

  assert.equal(invocation.name, 'agente-assistente');
  assert.deepEqual(invocation.options.body.messages, [
    { role: 'user', content: 'Parlavamo dei richiami.' },
    { role: 'assistant', content: 'Ne risultavano sette.' },
    { role: 'user', content: 'Cosa avevamo detto ieri?' },
  ]);
  assert.equal(result.text, 'Avevamo parlato di sette richiami.');
});

test('processQuery preserves deterministic-first orchestration and forwards history only to model fallback', async () => {
  let body = null;
  const result = await processQuery({
    query: 'Cosa avevamo detto ieri?',
    context: buildContext({ page: 'chat' }),
    conversationHistory: [{ role: 'assistant', content: 'Promemoria precedente.' }],
    sources: { patients: [], navigationIndex: [], actions: [] },
    allowModel: true,
    supabaseClient: {
      functions: {
        invoke: async (_name, options) => {
          body = options.body;
          return { data: { text: 'Riprendo il promemoria precedente.' }, error: null };
        },
      },
    },
  });
  assert.equal(result.answer, 'Riprendo il promemoria precedente.');
  assert.deepEqual(body.messages, [
    { role: 'assistant', content: 'Promemoria precedente.' },
    { role: 'user', content: 'Cosa avevamo detto ieri?' },
  ]);
});

test('schema is additive, indexed, append-only, and fails closed by studio membership plus user ownership', () => {
  assert.match(migration, /CREATE TABLE public\.poliedron_conversations/);
  assert.match(migration, /CREATE TABLE public\.poliedron_messages/);
  assert.match(migration, /UNIQUE \(studio_id, user_id, conversation_kind\)/);
  assert.match(migration, /UNIQUE \(conversation_id, request_id, role\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(migration, /su\.stato = 'attivo'/);
  assert.match(migration, /pc\.user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /persisted message identity and content are append-only/);
  assert.doesNotMatch(migration, /completed|snoozed/i);
  for (const scenario of ['same-studio user', 'cross-tenant', 'suspended']) {
    assert.match(rlsTest, new RegExp(scenario, 'i'));
  }
});

test('one singleton controller owns quick submits, Chat, persistence, and unread state', () => {
  assert.equal((app.match(/<Poliedron\b/g) || []).length, 1);
  assert.equal((controller.match(/usePoliedronConversation\(/g) || []).length, 1);
  assert.match(controller, /runQuery\(query, \{ allowModel: true, persist: true \}\)/);
  assert.match(controller, /persistedRequestRef\.current/);
  assert.match(controller, /pendingPanelRequestRef/);
  assert.match(controller, /pendingChatRequestRef/);
  assert.match(controller, /readAssistant: \(\) => requestSeq\.current === seq && openRef\.current/);
  assert.match(controller, /summarizeStructuredResult\(result\)/);
  assert.match(controller, /richiede sempre una nuova conferma esplicita nella sessione attiva/);
  assert.match(controller, /ReactDOM\.createPortal\([\s\S]*<PoliedronChatPage/);
  assert.match(controller, /className=\{`poliedron-notification-bell/);
  assert.doesNotMatch(controller, /functions\.invoke\(/);
  assert.match(controller, /handleConfirmPanelActionPlan/);
  assert.match(controller, /handleConfirmChatActionPlan/);
  assert.match(controller, /panelActionRunResult/);
  assert.match(controller, /chatActionRunResult/);
  assert.match(controller, /actionExecutionRef\.current/);
  assert.match(panel, /interactionDisabled/);
});

test('unread count remains authoritative across pagination and initial Realtime subscription', () => {
  assert.match(conversationHook, /if \(!unreadIds\.length\) \{\s*await refreshUnread\(\);/);
  assert.match(conversationHook, /onSubscribed: \(\) => \{\s*refreshRecent\(conversation\.id\)/);
  assert.match(conversationHook, /stateVersion !== messageStateVersion\.current/);
  assert.match(conversationRepository, /status === 'SUBSCRIBED'/);
  assert.match(conversationHook, /retryInitialization/);
  assert.match(chatPage, /onRetryInitialization/);
});

test('Chat route is wired on desktop and replaces Setup in the mobile dock while Setup stays in Poliedron menu', () => {
  assert.match(app, /page === 'chat' && <div ref=\{setPoliedronChatHost\}/);
  assert.match(app, /userId=\{session\?\.user\?\.id\}/);
  assert.match(dock, /\{ id: 'chat', label: 'Chat', icon: 'chat' \}/);
  assert.doesNotMatch(dock, /\{ id: 'set', label: 'Setup'/);
  assert.match(searchEngine, /const preferredSections = \['set'/);
});

test('Chat UI has one scroller, safe-area/dock clearance, pagination, retry, and conditional near-bottom scroll', () => {
  assert.equal((chatPage.match(/className="poliedron-chat__messages"/g) || []).length, 1);
  assert.match(chatPage, /NEAR_BOTTOM_PX = 120/);
  assert.match(chatPage, /scrollHeight - element\.scrollTop - element\.clientHeight <= NEAR_BOTTOM_PX/);
  assert.match(chatPage, /Carica messaggi precedenti/);
  assert.match(chatPage, /onRetry\(message\)/);
  assert.match(chatPage, /if \(!value \|\| sending \|\| loading\) return/);
  assert.match(chatPage, /const accepted = await onSend\(value\)/);
  assert.match(chatPage, /if \(accepted !== false\) setDraft\(''\)/);
  assert.match(css, /\.poliedron-chat\s*\{[\s\S]*padding-top:\s*env\(safe-area-inset-top/);
  assert.match(css, /padding-bottom:\s*calc\(92px \+ env\(safe-area-inset-bottom/);
  assert.match(css, /\.poliedron-chat__messages\s*\{[\s\S]*overflow-y:\s*auto;/);
});
