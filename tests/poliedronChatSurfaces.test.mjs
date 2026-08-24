/* POL-CHAT-001 §FASE 14 — the UX contract between the two Polyedron surfaces.
 *
 * FASE 4/7:  the quick panel (central Polyedron button) shows ONLY the current
 *            request/answer — no Chat history, no persistent thread, no
 *            "persistent history unavailable" banner.
 * FASE 5:    the Chat page is the ONE surface that owns the persistent history.
 * FASE 6:    still ONE Polyedron — one instance, one agent, one conversation.
 * FASE 9:    the unread badge exists on the bell only, never duplicated.
 * FASE 10:   loading / empty / schema / permission / network / generic are
 *            distinguishable, and an initialization error outranks both the
 *            loading state and a generic send error.
 * FASE 11:   the quick panel keeps working with the Chat backend missing.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CHAT_ERROR_KINDS,
  CHAT_SURFACE_STATUS,
  classifyChatError,
  describeChatError,
  resolveChatSurfaceState,
} from '../src/lib/poliedron/chatErrorState.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const controller = read('../src/components/poliedron/Poliedron.jsx');
const panel = read('../src/components/poliedron/PoliedronPanel.jsx');
const chatPage = read('../src/components/poliedron/PoliedronChatPage.jsx');
const dock = read('../src/components/poliedron/PoliedronMobileDock.jsx');
const bell = read('../src/components/poliedron/PoliedronBell.jsx');
const hook = read('../src/components/poliedron/usePoliedronConversation.js');
const app = read('../src/App.jsx');
const css = read('../src/components/PremiumVisualSystem.css');

test('Chat composer exposes one accessible circular send control through the existing submit path', () => {
  assert.match(chatPage, /const sendDisabled = loading \|\| sending \|\| !draft\.trim\(\)/);
  assert.match(chatPage, /className="poliedron-chat__send"[\s\S]*onClick=\{submit\}[\s\S]*disabled=\{sendDisabled\}[\s\S]*aria-label="Invia messaggio"/);
  assert.match(chatPage, /aria-busy=\{sending\}/);
  assert.match(chatPage, /<Ic n="send"/);
  assert.equal((chatPage.match(/onClick=\{submit\}/g) || []).length, 1, 'the button must not create a second send path');

  assert.match(chatPage, /event\.key === 'Enter' && !event\.shiftKey[\s\S]*event\.preventDefault\(\);[\s\S]*submit\(\);/);
  assert.match(chatPage, /if \(!value \|\| sending \|\| loading\) return;/);
  assert.match(chatPage, /const accepted = await onSend\(value\)/);

  assert.match(css, /\.poliedron-chat__composer-row\s*\{[\s\S]*align-items:\s*center;/);
  assert.match(css, /\.poliedron-chat__send\s*\{[\s\S]*border-radius:\s*50%;/);
  assert.match(css, /\.poliedron-chat__send\s*\{[\s\S]*min-width:\s*46px;[\s\S]*min-height:\s*46px;/);
  assert.match(css, /@media \(max-width: 719px\)[\s\S]*\.poliedron-chat__send\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
  assert.match(css, /\.poliedron-chat__send\[data-sending="true"\]/);
  assert.match(css, /\.poliedron-chat__send:disabled\s*\{[\s\S]*opacity:\s*1;[\s\S]*background:\s*linear-gradient/);
  assert.match(css, /:root\[data-theme="dark"\] \.poliedron-chat__send:disabled/);
  assert.doesNotMatch(css, /\.poliedron-chat__send:disabled\s*\{[^}]*opacity:\s*(?:0|\.[0-4])\b/);
  assert.match(css, /\.poliedron-chat__send:hover:not\(:disabled\)/);
  assert.match(css, /\.poliedron-chat__send:active:not\(:disabled\)/);
});

// ---------------------------------------------------------------- FASE 10 ---

test('every backend failure class is recognised from its real Supabase/PostgREST signature', () => {
  // PGRST205 is the exact code the app returned while the Chat migration was
  // not applied; 42P01 is what the database itself says for a missing table.
  assert.equal(classifyChatError({ code: 'PGRST205', message: "Could not find the table 'public.poliedron_conversations' in the schema cache" }), CHAT_ERROR_KINDS.SCHEMA);
  assert.equal(classifyChatError({ code: '42P01', message: 'relation "poliedron_messages" does not exist' }), CHAT_ERROR_KINDS.SCHEMA);
  // RLS / GRANT denial, and the HTTP-level equivalents.
  assert.equal(classifyChatError({ code: '42501', message: 'permission denied for table poliedron_conversations' }), CHAT_ERROR_KINDS.PERMISSION);
  assert.equal(classifyChatError({ status: 403, message: 'Forbidden' }), CHAT_ERROR_KINDS.PERMISSION);
  assert.equal(classifyChatError({ code: 'PGRST301', message: 'JWT expired' }), CHAT_ERROR_KINDS.PERMISSION);
  // supabase-js surfaces a dead network as a fetch TypeError.
  assert.equal(classifyChatError(new TypeError('Failed to fetch')), CHAT_ERROR_KINDS.NETWORK);
  assert.equal(classifyChatError({ message: 'Network request failed' }), CHAT_ERROR_KINDS.NETWORK);
  // identity/config preconditions raised by the repository itself.
  assert.equal(classifyChatError(new Error('CHAT_IDENTITY_REQUIRED')), CHAT_ERROR_KINDS.IDENTITY);
  // anything else stays explicitly generic instead of being mislabelled.
  assert.equal(classifyChatError({ message: 'boom' }), CHAT_ERROR_KINDS.GENERIC);
  assert.equal(classifyChatError(null), null);
});

test('each class gets its own user-facing sentence, always retryable, never echoing raw payloads', () => {
  const kinds = new Set();
  const messages = new Set();
  for (const error of [
    { code: 'PGRST205' },
    { code: '42501' },
    new TypeError('Failed to fetch'),
    new Error('CHAT_IDENTITY_REQUIRED'),
    { message: 'boom' },
  ]) {
    const described = describeChatError(error);
    assert.ok(described.message.length > 20, 'each class needs a real explanation');
    assert.equal(described.retryable, true, 'Retry must stay available for every class');
    kinds.add(described.kind);
    messages.add(described.message);
  }
  assert.equal(kinds.size, 5, 'the five classes must be distinguishable');
  assert.equal(messages.size, 5, 'and each must say something different');
  assert.equal(describeChatError(null), null);
  // A PostgREST message can echo identifiers — it must never be shown as-is.
  const raw = 'permission denied for table poliedron_conversations (user 79473dea)';
  assert.ok(!describeChatError({ code: '42501', message: raw }).message.includes('79473dea'));
});

test('an initialization error outranks loading and outranks a generic send error', () => {
  // The exact regression FASE 10 forbids: claiming "still loading" forever
  // while the real cause is a missing table.
  const schemaWhileLoading = resolveChatSurfaceState({
    loading: true,
    conversationError: { code: 'PGRST205' },
    chatError: 'Non riesco a completare la richiesta. Riprova.',
    messageCount: 0,
  });
  assert.equal(schemaWhileLoading.status, CHAT_SURFACE_STATUS.ERROR);
  assert.equal(schemaWhileLoading.kind, CHAT_ERROR_KINDS.SCHEMA);
  assert.equal(schemaWhileLoading.retryable, true);
  assert.ok(!/si sta ancora caricando/i.test(schemaWhileLoading.message));

  // With no initialization error, a send error is reported as itself.
  const sendError = resolveChatSurfaceState({ chatError: 'Attendi il completamento della richiesta in corso.', messageCount: 3 });
  assert.equal(sendError.status, CHAT_SURFACE_STATUS.ERROR);
  assert.equal(sendError.kind, CHAT_ERROR_KINDS.GENERIC);
  assert.equal(sendError.message, 'Attendi il completamento della richiesta in corso.');

  // And the three healthy states stay distinct.
  assert.equal(resolveChatSurfaceState({ loading: true }).status, CHAT_SURFACE_STATUS.LOADING);
  assert.equal(resolveChatSurfaceState({ messageCount: 0 }).status, CHAT_SURFACE_STATUS.EMPTY);
  assert.equal(resolveChatSurfaceState({ messageCount: 2 }).status, CHAT_SURFACE_STATUS.READY);
  assert.equal(resolveChatSurfaceState().status, CHAT_SURFACE_STATUS.EMPTY);
});

test('the Chat surface renders the classified state and keeps its Retry button', () => {
  assert.match(controller, /resolveChatSurfaceState\(\{/);
  assert.match(controller, /error=\{chatSurface\.message\}/);
  assert.match(controller, /errorKind=\{chatSurface\.kind\}/);
  assert.match(controller, /surfaceStatus=\{chatSurface\.status\}/);
  assert.match(controller, /onRetryInitialization=\{conversationError \? retryInitialization : null\}/);
  assert.match(hook, /describeChatError/);
  assert.match(hook, /errorState,/);
  // loading and empty are now two different blocks, and empty never shows
  // while an error is on screen.
  assert.match(chatPage, /loading && messages\.length === 0/);
  assert.match(chatPage, /!loading && !error && messages\.length === 0/);
  assert.match(chatPage, /data-kind=\{errorKind \|\| 'generic'\}/);
  assert.match(chatPage, /Riprova<\/button>/);
  // the stale sentence is gone from the Chat send path unless the
  // conversation really is still initializing with no error at all.
  const guard = controller.slice(controller.indexOf('const runChatMessage'), controller.indexOf('const executeActionPlan'));
  const guardCode = guard.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(guardCode.indexOf('described') < guardCode.indexOf('si sta ancora caricando'),
    'a classified initialization error must be reported before the loading sentence');
});

// -------------------------------------------------------------- FASE 4/7/11 --

test('the quick panel contains no Chat history and no persistent-history banner', () => {
  assert.ok(!panel.includes('La cronologia persistente non è disponibile.'),
    'the removed availability banner must not come back');
  assert.doesNotMatch(panel, /conversationError/);
  assert.doesNotMatch(panel, /onRetryConversation/);
  assert.doesNotMatch(panel, /poliedron-chat__error/);
  // no message list / thread rendering of any kind inside the quick panel
  for (const forbidden of ['messages.map', 'PoliedronChatPage', 'loadOlder', 'Carica messaggi precedenti', 'unreadCount']) {
    assert.ok(!panel.includes(forbidden), `the quick panel must not render ${forbidden}`);
  }
  // it still shows the current request/answer (FASE 7) and the input (FASE 4)
  assert.match(panel, /<PoliedronConversation query=\{query\} answer=\{state\.answer\}/);
  assert.match(panel, /Chiedi o fai qualsiasi cosa/);
  assert.match(panel, /PoliedronSuggestionBoard/);
});

test('the quick panel is not coupled to the Chat backend', () => {
  // the controller passes no conversation/error/retry props to the panel
  const panelProps = controller.slice(controller.indexOf('<PoliedronPanel'), controller.indexOf('{chatHost &&'));
  assert.ok(!panelProps.includes('conversationError'), 'no conversation error may reach the panel');
  assert.ok(!panelProps.includes('onRetryConversation'), 'no conversation retry may reach the panel');
  assert.match(panelProps, /submitDisabled=\{chatSending\}/);
  assert.ok(!/submitDisabled=\{[^}]*primaryConversation/.test(panelProps),
    'the Chiedi button must never be disabled because the Chat tables are missing');
  // persistence is conditional, and a lost conversation falls back to the same
  // non-persisted request path instead of failing the panel
  assert.match(controller, /persist: chatPersistenceAvailable/);
  assert.match(controller, /CHAT_CONVERSATION_NOT_READY'\) throw persistError;[\s\S]{0,200}processRequest\(q, \{ allowModel: true \}\)/);
});

// ---------------------------------------------------------------- FASE 5/6 ---

test('the Chat page is the only surface with persistent history, served by the one Polyedron instance', () => {
  assert.equal((app.match(/<Poliedron\b/g) || []).length, 1, 'exactly one Polyedron is mounted');
  assert.equal((controller.match(/usePoliedronConversation\(/g) || []).length, 1);
  assert.equal((controller.match(/<PoliedronChatPage/g) || []).length, 1);
  assert.match(controller, /ReactDOM\.createPortal\([\s\S]*<PoliedronChatPage/);
  // one processRequest / one agent for both surfaces
  assert.equal((controller.match(/processQuery\(/g) || []).length, 1);
  assert.doesNotMatch(controller, /functions\.invoke\(/);
  // history only on the Chat page
  assert.match(chatPage, /Carica messaggi precedenti/);
  assert.match(chatPage, /messages\.map/);
});

// ------------------------------------------------------------------ FASE 8 ---

test('every entry point opens the same Chat page', () => {
  assert.match(dock, /\{ id: 'chat', label: 'Chat', icon: 'chat' \}/);
  assert.match(dock, /onClick=\{\(\) => setPage\(item\.id\)\}/);
  assert.match(controller, /onOpenChat=\{\(\) => setPage\('chat'\)\}/);
  assert.match(app, /page === 'chat' && <div ref=\{setPoliedronChatHost\}/);
});

// ------------------------------------------------------------------ FASE 9 ---

test('the unread badge exists on the bell only — never duplicated in the dock', () => {
  assert.match(bell, /poliedron-bell__badge/);
  assert.match(bell, /unreadCount > 99 \? '99\+' : unreadCount/);
  assert.match(controller, /<PoliedronBell[\s\S]*unreadCount=\{unreadCount\}/);
  assert.doesNotMatch(dock, /unreadCount/);
  assert.doesNotMatch(dock, /__badge/);
  const dockUsage = controller.slice(controller.indexOf('<PoliedronMobileDock'), controller.indexOf('<PoliedronEdgeDock'));
  assert.ok(!dockUsage.includes('unreadCount'), 'the dock must not even receive the count');
});
