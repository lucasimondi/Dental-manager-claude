# Chat Polyedron

Status: implemented on `lucasimondi-chat-polyedron`; local migration only,
not applied remotely.

## One Polyedron

Chat is a second interface for the existing singleton Polyedron, not a second
agent. `App.jsx` still mounts `components/poliedron/Poliedron.jsx` exactly once.
That controller owns:

- the mobile Orb and desktop Edge Dock;
- the compact command panel;
- the long-form Chat page;
- the one persisted primary conversation;
- unread/read state;
- the existing action-preview and action-execution callbacks.

Both explicit compact-panel questions and Chat messages use:

`Poliedron.jsx -> processQuery() -> deterministic routes/canonical sources -> modelGateway.js -> agente-assistente`

`modelGateway.js` remains the only Poliedron module that invokes the existing
Supabase Edge Function. No provider SDK, provider selection, prompt stack, or
second orchestration path was added.

## Context and bounded history

`contextEngine.js` continues to build the current page/vertical/patient/
appointment context. `processQuery()` remains deterministic-first and only
passes conversation history to model-fallback branches.

The repository had no persistent conversational memory. Chat therefore adds
only the minimum continuity layer:

- the most recent 20 sent user/assistant messages;
- at most 12,000 characters;
- no failed message;
- no duplicate current request;
- no stored `system` message passed as provider system instructions.

The same history is sent to the existing Edge Function's already-supported
`messages` contract. The full conversation is never loaded into the model
request. Summarization, retrieval, long-term semantic memory, and provider-side
memory remain future work.

Streaming was not introduced: the shipped `functions.invoke()` path is
request/response only, and changing that contract would require an invasive
backend refactor outside this task.

## Persistence

Migration:

`supabase/migrations/20260824030000_chat_polyedron.sql`

### `poliedron_conversations`

- one `primary` conversation per `(studio_id, user_id)`;
- `conversation_kind` supports future named/contextual threads without changing
  the current one-thread behavior;
- foreign keys to repository-proven `studios` and `auth.users`;
- no existing table or data is modified.

### `poliedron_messages`

- append-only identity/content;
- `role`: `user`, `assistant`, or `system`;
- `request_id` pairs a user request and assistant response;
- unique `(conversation_id, request_id, role)` makes retries idempotent;
- `delivery_status`: `pending`, `sent`, or `failed`;
- `read_at` is visibility state only;
- bounded object `metadata` is an extension point for future entity links;
- no `completed`, `snoozed`, reminder, scheduler, or task state exists.

Recent messages use keyset pagination by identity (`id < oldest_id`), 40 rows
per page, maximum 100. The UI prepends older pages while preserving scroll
position.

The migration conditionally adds `poliedron_messages` to the existing
`supabase_realtime` publication when that publication exists. The singleton
controller also updates local state immediately, so the current request flow
does not depend on Realtime delivery.

## RLS and ownership

Both tables have RLS enabled. `PUBLIC` and `anon` have no access.

Every authenticated policy requires:

1. `auth.uid()` ownership of the conversation; and
2. an active `studio_users` row for that exact user and studio.

Messages additionally require an owned parent conversation. This denies:

- another user in the same studio;
- another studio/tenant;
- a suspended studio member;
- a caller spoofing another `user_id`.

The database trigger prevents changing message identity, conversation, role,
content, metadata, request id, or creation time after insert. `read_at` can
move from unread to read only and cannot be cleared or rewritten. A sent
message cannot return to pending/failed.

The browser persists the response returned by the authenticated existing Edge
Function. Because that Edge Function is not versioned in this repository, the
database can prove privacy/ownership but cannot independently attest that a
private `assistant` row was authored by the provider rather than by its owning
browser user. This does not permit cross-user or cross-tenant access; stronger
server-authored provenance would require a separately versioned server insert
path.

## UI and navigation

`chat` is a canonical `NAV` page, so desktop uses the existing
`PremiumSidebar`. On mobile, Product Owner direction replaces Setup with Chat
in the compact five-slot dock:

`Home | Agenda | Polyedron | Pazienti | Chat`

Setup remains searchable and is now the first explicit item in Poliedron's idle
`Apri una sezione` navigation menu.

The global Polyedron bell and the mobile Chat badge read the same conversation
unread count. The bell opens the same `chat` page. Agenda's booking-request
bell remains independent and unchanged.

Mobile Chat uses the existing `100dvh` app shell, safe-area top/bottom,
dock clearance, one message scroller, and a fixed flex composer. Desktop uses
the full main workspace with bounded readable bubble widths. The outer app
scroll is disabled for Chat at every breakpoint.

Auto-scroll occurs on first/latest view and only while the reader is within
120px of the bottom. Loading older messages or reading history is not
interrupted. Empty/double submission is blocked; pending, slow, failed, retry,
and recovered states remain visible.

Assistant/system messages are marked read only while Chat is visible. Read
state never completes an activity and has no Task 3 semantics.

## Rollback

Before a remote migration is ever approved, rollback remains:

1. stop code that writes the Chat tables;
2. remove `public.poliedron_messages` from `supabase_realtime` if present;
3. drop `public.poliedron_messages`;
4. drop `public.poliedron_conversations`;
5. drop `public.poliedron_messages_guard_v1()` and
   `public.poliedron_messages_touch_conversation_v1()`.

The migration is additive and changes no prior data, policy, financial logic,
clinical model, or tenant fallback.
