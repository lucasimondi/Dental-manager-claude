/* POL-AI-001 §15-16, §39 — model provider abstraction.
   CRITICAL constraint from the task: no UI component may call Gemini/
   Claude/OpenAI directly. This is the only place a model call happens.

   §39: an AI integration already existed before Poliedron — AssistenteAI.jsx
   called the deployed `agente-assistente` Supabase edge function (no
   provider SDK in this client at all; the provider choice already lives
   server-side, behind that function). This gateway adapts that exact call
   instead of rewriting it, and is now the ONLY caller of it in the app:
   POL-AI-001's Product Owner review required Poliedron to be the app's
   single AI entry point, so AssistenteAI.jsx's own floating widget was
   unmounted (its file/logic are kept, not deleted — see App.jsx's import
   comment and docs/coordination/handoffs.md for the convergence record).

   §16 router: deterministic search/navigation/action-matching never reaches
   this file at all (intentEngine + searchEngine handle those with zero
   model calls) — runModelTask is only invoked for ANALYZE's natural-
   language answer composition and ASK. There is no "cheap vs advanced
   model" tier to route between yet, because there is only one deployed
   function to call; that tiering is future work once a second provider
   path exists (see FUTURE_PHASES in the final report). */

export const MODEL_TASK_TYPE = Object.freeze({
  ANSWER: 'ANSWER', // compose a natural-language answer from real, already-fetched data
  ASK: 'ASK', // open-ended question, no deterministic path matched
});

/**
 * runModelTask({ taskType, input, context, allowedTools, supabaseClient })
 * -> Promise<{ text, error }>
 * `allowedTools` is accepted for forward-compatibility with a future
 * tool-using provider — the current adapter does not pass tool access
 * beyond what agente-assistente already exposes server-side.
 */
export async function runModelTask({ taskType, input, context, supabaseClient, confirm } = {}) {
  if (!supabaseClient) return { text: null, error: 'MODEL_GATEWAY_NO_CLIENT' };
  if (!input) return { text: null, error: 'MODEL_GATEWAY_EMPTY_INPUT' };
  try {
    const { data, error } = await supabaseClient.functions.invoke('agente-assistente', {
      body: {
        messages: [{ role: 'user', content: input }],
        confirm,
        // Passed through as extra context only — the function's own
        // canonical data access remains the authority; this never
        // substitutes for it (see contextEngine.js §14).
        poliedronContext: { taskType, page: context?.page, vertical: context?.vertical },
      },
    });
    if (error) return { text: null, error: error.message || 'MODEL_GATEWAY_ERROR' };
    if (data?.error) return { text: null, error: data.error };
    return { text: data?.text || null, error: null, raw: data };
  } catch (e) {
    return { text: null, error: e?.message || 'MODEL_GATEWAY_EXCEPTION' };
  }
}
