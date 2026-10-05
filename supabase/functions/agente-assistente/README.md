# agente-assistente

Poliedron's authenticated Edge Function (POL-AI-010). Production v25 = steps 0-2;
step 2b (direct execution and speed) is not yet deployed.

## Contracts

- Questions: `messages` contains only user/assistant text, bounded to 21 messages.
- Clear write, no conflict (step 2b): executed directly through the same atomic RPC
  with a fresh claim id; response `{ text, changed }` where `text` is the server
  summary of what was done. If a model turn contains only successful writes the
  response returns at once, with no further model call.
- Conflict, invalid data or an ID not seen in a read of the same request: nothing is
  written; the model receives the error (for an occupied slot, the real free slots)
  and asks the user.
- Possible duplicate patient, or studio autonomy `medio`: signed proposal
  `needsConfirmation { token, summary, expiresAt }`; no write yet.
- Decision: `confirm { token, cancelled? }`; no client tool blocks or conversation
  replay is needed. Rechecks active membership, current plan/autonomy and signature.
- Uncertain result: explicit message and refresh; never automatically replay writes.

Speed: `output_config.effort = "low"`, prompt caching on the tools and on the
stable system block (studio name, knowledge, date and level come after the cache
point), initial reads in parallel, usage logging off the critical path.

Reviewed writes exposed to the model: agenda (create, modify, soft-cancel) and, from
step 2, patients and clinical organisation (`pazienti.js`: new patient,
contact/consent update, dated note, recall, activity, agenda block; executed by
`poliedron_execute_pazienti_v1`). Read tool `scheda_paziente`.
Any ID the model writes against must come from a read in the same request. Read tools include real availability and
operator listing. Other domain writes remain in existing deterministic workflows
and will be integrated in subsequent steps. No permanent deletion or forced overlap.

All business operations use the caller's session/RLS. The service-role client only
reads the existing four tenant-filtered `ai_agent_*` configuration tables. The
existing service-role secret is also used for domain-separated HMAC signatures;
never expose it or persist confirmation tokens in chat/localStorage.

`verify_jwt=true`. Deploy the full function folder and its imported
`../_shared/agendaSlots.js`, after the approved migrations
`20261004160708_pol_ai_010_action_claims.sql` and `20261005120000_pol_ai_010_pazienti.sql`. No new secret is required:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

The legacy financial read tools still require canonical-source convergence in
step 4. Do not treat this step as a financial audit or complete AI integration.

Validation, exact limitations, release order and rollback:
`docs/architecture/POL-AI-010-agenda.md`.
