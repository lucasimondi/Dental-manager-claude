/* POL-CHAT-001 §FASE 10 — one place that turns a raw Supabase/PostgREST/
   network failure into a class the UI can talk about, so the persistent Chat
   never again shows "La conversazione si sta ancora caricando" for a failure
   that is actually a missing table, a denied permission, or a dead network.

   Why a shared module and not inline branches in the component: the same
   classification has to be used by the initialization banner, by the send
   path, and by the tests, and the codes involved are database contract
   details (PostgREST error codes, PostgreSQL SQLSTATEs) that must be written
   down once.

   Deliberately NOT a second error system: the Poliedron panel does not use
   this at all (see FASE 4/11 — the quick panel must keep working with no
   persistent Chat backend, so it has no chat-error surface to classify).

   Never put raw error payloads in the user-facing strings: PostgREST
   messages can echo back identifiers, and these strings are rendered in the
   UI. Only the class-level explanation is shown; the raw error stays in the
   caller's state for internal logging. */

export const CHAT_ERROR_KINDS = Object.freeze({
  SCHEMA: 'schema',
  PERMISSION: 'permission',
  NETWORK: 'network',
  IDENTITY: 'identity',
  GENERIC: 'generic',
});

/* PGRST205 = "Could not find the table in the schema cache" (the exact code
   returned before the Chat migration was applied), PGRST202 = missing RPC,
   42P01 = undefined_table, 42703 = undefined_column: all mean "the backend
   schema this build expects is not deployed here". */
const SCHEMA_CODES = new Set(['PGRST205', 'PGRST202', '42P01', '42703']);

/* 42501 = insufficient_privilege (what RLS/GRANT denials surface as),
   PGRST301 = JWT problem, 401/403 = HTTP-level denial. */
const PERMISSION_CODES = new Set(['42501', 'PGRST301', '401', '403']);

const IDENTITY_ERRORS = new Set([
  'CHAT_IDENTITY_REQUIRED',
  'CHAT_SUPABASE_CLIENT_REQUIRED',
  'CHAT_REQUEST_ID_UNAVAILABLE',
]);

const MESSAGES = Object.freeze({
  [CHAT_ERROR_KINDS.SCHEMA]: 'La cronologia della Chat non è disponibile su questo ambiente: il database non espone ancora le tabelle della Chat. Riprova dopo l’aggiornamento del database.',
  [CHAT_ERROR_KINDS.PERMISSION]: 'Non hai i permessi necessari per questa conversazione. Verifica di essere collegato con un account attivo dello studio.',
  [CHAT_ERROR_KINDS.NETWORK]: 'Connessione non disponibile: non riesco a raggiungere il server. Controlla la rete e riprova.',
  [CHAT_ERROR_KINDS.IDENTITY]: 'La Chat non è ancora pronta: studio o utente non disponibili in questo momento.',
  [CHAT_ERROR_KINDS.GENERIC]: 'La conversazione non è disponibile in questo momento.',
});

const asText = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return [error.message, error.details, error.hint, error.error_description]
    .filter((part) => typeof part === 'string')
    .join(' ');
};

const codeOf = (error) => {
  if (!error || typeof error === 'string') return '';
  const raw = error.code ?? error.status ?? error.statusCode ?? '';
  return String(raw).toUpperCase();
};

export function classifyChatError(error) {
  if (!error) return null;
  const code = codeOf(error);
  const text = asText(error);
  const name = typeof error === 'string' ? '' : String(error.name || '');

  if (IDENTITY_ERRORS.has(text.trim())) return CHAT_ERROR_KINDS.IDENTITY;
  if (SCHEMA_CODES.has(code)) return CHAT_ERROR_KINDS.SCHEMA;
  if (PERMISSION_CODES.has(code)) return CHAT_ERROR_KINDS.PERMISSION;
  if (/schema cache|does not exist|undefined table|relation .* does not exist/i.test(text)) {
    return CHAT_ERROR_KINDS.SCHEMA;
  }
  if (/permission denied|not authorized|unauthorized|row-level security|jwt/i.test(text)) {
    return CHAT_ERROR_KINDS.PERMISSION;
  }
  if (name === 'TypeError' || name === 'AbortError'
    || /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out|ecconn|offline/i.test(text)) {
    return CHAT_ERROR_KINDS.NETWORK;
  }
  return CHAT_ERROR_KINDS.GENERIC;
}

/** Class + the exact user-facing sentence for it. `retryable` is always true
 *  because every class above can be transient from the user's point of view
 *  (a migration lands, a membership is restored, the network comes back), so
 *  the Retry button stays available — a hard requirement of FASE 10. */
export function describeChatError(error) {
  const kind = classifyChatError(error);
  if (!kind) return null;
  return { kind, message: MESSAGES[kind], retryable: true };
}

export const CHAT_SURFACE_STATUS = Object.freeze({
  LOADING: 'loading',
  EMPTY: 'empty',
  READY: 'ready',
  ERROR: 'error',
});

/** The single precedence rule for the Chat surface.
 *
 *  FASE 10: an initialization failure (`conversationError`) OUTRANKS both the
 *  loading state and a generic per-message `chatError`, because while it is
 *  unresolved nothing else the surface could say is true — the previous build
 *  claimed the conversation was "still loading" forever when in fact the
 *  tables did not exist. */
export function resolveChatSurfaceState({
  loading = false,
  conversationError = null,
  chatError = '',
  messageCount = 0,
} = {}) {
  const described = describeChatError(conversationError);
  if (described) {
    return { status: CHAT_SURFACE_STATUS.ERROR, kind: described.kind, message: described.message, retryable: true };
  }
  if (chatError) {
    return { status: CHAT_SURFACE_STATUS.ERROR, kind: CHAT_ERROR_KINDS.GENERIC, message: chatError, retryable: false };
  }
  if (loading) return { status: CHAT_SURFACE_STATUS.LOADING, kind: null, message: '', retryable: false };
  if (!messageCount) return { status: CHAT_SURFACE_STATUS.EMPTY, kind: null, message: '', retryable: false };
  return { status: CHAT_SURFACE_STATUS.READY, kind: null, message: '', retryable: false };
}
