# POL-UX-002 — Per-studio customizable capability labels: technical design

Status: `WAITING_PRODUCT_OWNER` — design only, nothing in this document has been applied. No migration file exists yet, Supabase has not been touched, `studio_user_capabilities` and every RBAC function/policy listed below are quoted read-only from the current `master` migration (`20260819200029_pol_rbac_001_authoritative_capabilities.sql`) to prove this design sits beside them, not inside them.

## Context

`src/lib/roleLabels.js` (POL-UX-002, this branch) already ships a vertical-aware *default* label for each RBAC capability — e.g. `clinical.general` reads "Odontoiatra" for a `dentistico` studio, "Fisioterapista" for a `fisioterapista` one. The Product Owner has now approved building the next tier: letting an individual studio override that default with its own wording (e.g. a studio that prefers "Igienista" to "Odontoiatra"), while keeping that override **purely cosmetic** — it must never be able to grant, widen, or otherwise touch what a capability actually authorizes.

## Binding requirements (from the Product Owner's decision)

1. `master`'s RBAC remains the only authorization source.
2. No label can grant or revoke a permission.
3. Multi-tenant isolation is mandatory.
4. Semantic isolation between verticals is preserved.
5. Fallback order: custom studio label → vertical default → generic safe label.
6. Managing labels is gated by an RBAC capability that **already exists** — no new capability is invented for this.
7. No second authorization model.
8. No change to canonical capabilities.

Every section below is written to satisfy these eight points explicitly, not just generally.

---

## SCHEMA_PROPOSAL

A new, standalone table — not a column on `studio_user_capabilities`, not a jsonb blob on `studio_info` (the existing jsonb columns there — `agenda_settings`, `dock_settings`, `config_orario`, `categorie_spesa_custom` — are each scoped to one feature; overloading one of them for labels was rejected in the prior audit as a domain-boundary violation, and a shared bucket would make RLS/CHECK constraints harder to reason about than a dedicated table).

```sql
CREATE TABLE public.studio_capability_labels (
  studio_id    uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  capability   text NOT NULL CHECK (capability IN (
    -- Intentionally the exact same literal list as
    -- studio_user_capabilities.capability's CHECK constraint (POL-RBAC-001).
    -- This does not reference or modify that table -- it is a second,
    -- independent CHECK against the same canonical vocabulary, so a label
    -- can never be created for a capability that doesn't exist. If POL-RBAC
    -- ever adds a capability, this list is extended in the same migration
    -- that adds it there, never on its own.
    'home.front_desk',
    'clinical.general',
    'clinical.physiotherapist',
    'clinical.personal_trainer',
    'clinical.massage_therapist'
  )),
  custom_label text NOT NULL CHECK (char_length(btrim(custom_label)) BETWEEN 1 AND 40),
  updated_by   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id, capability)
);

CREATE INDEX studio_capability_labels_studio_idx
  ON public.studio_capability_labels (studio_id);
```

Design notes:
- **No `description` override.** The Product Owner's ask was for the *label* only ("Le etichette dei ruoli devono poter essere personalizzabili"); the plain-language permission description stays centrally maintained in `roleLabels.js`, avoiding a second place where meaning can drift from what the capability actually does.
- **No `vertical` column.** A studio has exactly one vertical (`studio_info.vertical`); the override is keyed by `(studio_id, capability)` only, so it automatically tracks whatever vertical the studio is currently in — no dual bookkeeping to keep in sync.
- **`PRIMARY KEY (studio_id, capability)`** means "absent row" *is* the fallback signal — there is no separate boolean/enabled flag to go stale. Deleting a row is exactly "reset this label to the vertical default," nothing more.
- **This table has zero foreign keys into anything permission-related** other than `studios(id)` (tenant identity, same as every other tenant-scoped table in this schema) and `auth.users(id)` (audit trail of who last edited it, same pattern as `studio_user_capabilities.granted_by`). It is never joined by any RBAC function, and no RBAC function is ever written to join it.

---

## RLS_MAPPING

Mirrors the existing `studio_user_capabilities` policy shape (`studio_user_capabilities_select/insert/delete` in `20260819200029_pol_rbac_001_authoritative_capabilities.sql`) rather than inventing a new pattern.

```sql
ALTER TABLE public.studio_capability_labels ENABLE ROW LEVEL SECURITY;

-- READ: any active member of the studio -- everyone needs the studio's
-- chosen wording to render correctly, not just admins. This is presentation
-- data, not a permission; there is no reason to restrict it further than
-- "you are an active member of this tenant."
CREATE POLICY studio_capability_labels_select ON public.studio_capability_labels
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.studio_users su
    WHERE su.studio_id = studio_capability_labels.studio_id
      AND su.user_id = (SELECT auth.uid())
      AND su.stato = 'attivo'
  )
);

-- WRITE (insert/update/delete): gated by studio.manage_members -- the exact
-- same capability that already gates studio_user_capabilities_insert/delete
-- (i.e. the same authority that can grant a user a clinical capability can
-- rename how it's displayed; no new capability is created for this table).
CREATE POLICY studio_capability_labels_insert ON public.studio_capability_labels
FOR INSERT TO authenticated
WITH CHECK (
  updated_by = (SELECT auth.uid())
  AND (SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members'))
);

CREATE POLICY studio_capability_labels_update ON public.studio_capability_labels
FOR UPDATE TO authenticated
USING ((SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members')))
WITH CHECK (
  updated_by = (SELECT auth.uid())
  AND (SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members'))
);

CREATE POLICY studio_capability_labels_delete ON public.studio_capability_labels
FOR DELETE TO authenticated
USING ((SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members')));

REVOKE ALL ON TABLE public.studio_capability_labels FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.studio_capability_labels TO authenticated;
```

Why this satisfies every binding requirement:
- **RBAC stays authoritative (#1, #7)**: the only function referenced is `has_studio_capability_v1`, the existing one. No new `has_*`/`can_*` function is added — there is exactly one authorization function in the system, still.
- **No label grants/revokes anything (#2)**: `studio_capability_labels` is never referenced by any policy on `studio_user_capabilities`, any `physio_*` table, any financial RPC, or any client-side capability check. A row here changes what text renders next to a toggle in `GestioneUtenti.jsx`; it changes nothing about what `has_studio_capability_v1` returns.
- **Tenant isolation (#3)**: every policy scopes through `studio_users` (read) or `has_studio_capability_v1` (write), both of which already enforce `studio_id` + active membership + `auth.uid()` — the identical mechanism every other tenant-scoped table in this schema uses, not a new one.
- **Existing capability, not a new one (#6)**: `studio.manage_members` already exists (it's the legacy-admin-derived capability from POL-RBAC-001 that gates team management today) and is reused verbatim.
- **Canonical capabilities untouched (#8)**: this migration would not `ALTER` `studio_user_capabilities`, its CHECK constraint, its policies, or `has_studio_capability_v1`/`get_my_studio_capabilities_v1`. It only reads the same literal capability vocabulary into a second CHECK constraint on a new, unrelated table.

---

## FALLBACK_MODEL

Three tiers, evaluated in this order, matching the Product Owner's spec exactly:

1. **Custom studio label** — a row in `studio_capability_labels` for `(studio_id, capability)`, if present.
2. **Vertical default** — `roleLabels.js`'s existing `LABELS[capability][vertical]`, already shipped this round.
3. **Generic safe label** — `roleLabels.js`'s existing `FALLBACK_LABEL` / `LABELS[capability].default`, already shipped this round.

Client-side, this only requires extending the already-existing `getCapabilityPresentation` — no new function, no new call sites beyond passing one more optional argument:

```js
// src/lib/roleLabels.js — proposed extension, NOT part of this design-only round
export const getCapabilityPresentation = (capability, vertical, customLabel) => {
  const perVertical = LABELS[capability];
  const fallback = perVertical ? (perVertical[vertical] || perVertical.default || FALLBACK_LABEL) : FALLBACK_LABEL;
  if (customLabel && customLabel.trim()) return { ...fallback, label: customLabel.trim() };
  return fallback;
};
```

Notes:
- The `description` (plain-language explanation) is **never** overridden by the custom label — only `label` is. A studio can rename "Odontoiatra" to whatever it wants; the tooltip explaining what the capability actually does keeps coming from the vertical-aware default, so the meaning is never lost even if the wording is customized.
- Semantic isolation between verticals (#4) is preserved because tier 1 only ever supplies a *string*, never a *capability* — a Dental studio customizing a label still only sees the capabilities `getOfferableCapabilities('dentistico')` offers; it cannot use a custom label to surface a Physio-only capability, because the offerable set is computed independently of this table.
- An empty/whitespace-only custom label is treated as "not set" (falls through to tier 2), so a studio can never end up with a blank control by clearing the field — this needs a matching `CHECK (char_length(btrim(custom_label)) BETWEEN 1 AND 40)` at the database layer too (see SCHEMA_PROPOSAL) so the same rule holds even if a future caller bypasses the client.

---

## MIGRATION_PLAN

**Nothing in this section has been executed.** Per the Product Owner's explicit instruction for this round, no migration file has been created in `supabase/migrations/`, no `supabase db push`/`apply_migration` call was made, and production was not touched. This section documents what the *next*, separately-approved phase would do.

1. **File**: a new timestamped migration, e.g. `supabase/migrations/<UTC-timestamp>_pol_ux_002_studio_capability_labels.sql`, following the exact `BEGIN; ... COMMIT;` + preflight-check structure already used by `20260819200029_pol_rbac_001_authoritative_capabilities.sql` (a `DO $$ ... RAISE EXCEPTION` preflight confirming `studios`, `studio_users`, and `has_studio_capability_v1` exist before creating anything that depends on them).
2. **Contents**: exactly the `CREATE TABLE`, index, `ENABLE ROW LEVEL SECURITY`, and four policies from SCHEMA_PROPOSAL/RLS_MAPPING above, plus `COMMENT ON TABLE public.studio_capability_labels IS 'POL-UX-002 presentation-only label override. Never referenced by any authorization check; RBAC authority is studio_user_capabilities + has_studio_capability_v1 only.'` — an explicit, permanent, in-schema note for the next engineer so this table's non-authoritative nature is documented at the source, not only in this file.
3. **Local validation** (before any production discussion, matching the pattern already used for POL-RBAC-001/001A in this repo): apply against a local/ephemeral Postgres 16 instance, then re-validate on PostgreSQL 17 (PGlite), running `supabase db lint`/advisors for missing RLS or privilege escalation warnings.
4. **No backfill needed** — the table starts empty; every studio simply falls through to tier 2 (vertical default) until it explicitly sets a custom label. There is no migration of existing data.
5. **Rollback boundary**: drop the four policies, disable RLS, drop the index, `DROP TABLE public.studio_capability_labels` — a single self-contained table with no downstream dependents (nothing else is ever migrated to reference it), so rollback is a clean, isolated operation, unlike the Fisio policy changes in POL-RBAC-001 which had to restore prior policies in a specific order.
6. **Production application**: requires its own, separate Product Owner gate, per this round's instructions and the repo's standing migration runbook (`docs/runbooks/migrations.md`) — not implied or bundled into this design's approval.

---

## TEST_PLAN

All of the following would be added in the implementation phase (none exist yet, since no code was written this round beyond this document):

**SQL / RLS regression** (new file, e.g. `supabase/tests/pol_ux_002_studio_capability_labels.sql`, run against the local Postgres validation matrix described above):
1. An active member of studio A can `SELECT` studio A's labels.
2. A member of studio B (different tenant) gets zero rows when querying studio A's labels — tenant isolation proof, not just "no error."
3. A user without `studio.manage_members` in studio A gets a policy-denied `INSERT`/`UPDATE`/`DELETE` on studio A's labels.
4. A user *with* `studio.manage_members` in studio A can `INSERT`/`UPDATE`/`DELETE` studio A's labels, and cannot write a row for studio B (cross-tenant write attempt fails).
5. Inserting a `capability` value outside the fixed vocabulary is rejected by the `CHECK` constraint.
6. Inserting an empty/whitespace-only `custom_label` is rejected by the `CHECK` constraint.
7. **Regression proof, not just "new feature works"**: `has_studio_capability_v1` and `get_my_studio_capabilities_v1` return byte-identical results before and after this migration, for the same fixture data — proving the label table has zero effect on authorization. This is the single most important test in the plan given the binding requirements.

**Client-side unit tests** (extending `tests/roleLabels.test.mjs`):
1. A custom label overrides the vertical default when present.
2. An empty/whitespace custom label falls through to the vertical default (tier 2), not a blank string.
3. Absent custom label + known vertical → tier 2 (existing behavior, must not regress).
4. Absent custom label + unknown vertical → tier 3 generic fallback (existing behavior, must not regress).
5. A custom label never changes which capabilities `getOfferableCapabilities(vertical)` returns — proves labels can't be used to smuggle a cross-vertical capability into view (semantic isolation, requirement #4).
6. The `description` field is always the vertical-aware one, never overridden by `customLabel` — proves a renamed label can't obscure what the capability actually grants.

**Manual / integration** (to run once implementation lands, live-QA permitting): admin in studio A renames a label, confirms it renders immediately for another active member of studio A, confirms it is invisible to a user in studio B, confirms deleting the override reverts to the vertical default without a page-breaking blank state.

---

## Summary against the binding requirements

| # | Requirement | How this design satisfies it |
|---|---|---|
| 1 | RBAC di `master` resta l'unica fonte di autorizzazione | Only `has_studio_capability_v1` is referenced; no new authorization function |
| 2 | Nessuna label può concedere/revocare permessi | Table stores only display text; never joined by any policy/RPC outside itself |
| 3 | Isolamento multi-tenant obbligatorio | Every policy scopes through `studio_users`/`has_studio_capability_v1`, same as the rest of the schema |
| 4 | Isolamento semantico tra verticali | Custom label is a string substitution only; offerable-capability set is computed independently in `roleLabels.js`, untouched by this table |
| 5 | Fallback: custom → verticale → generic | Exact three-tier order implemented in `getCapabilityPresentation` |
| 6 | Gestione label solo tramite capability RBAC esistenti | Reuses `studio.manage_members`, already granted server-side to legacy admins |
| 7 | Nessun secondo modello autorizzativo | Single authorization function in the system, before and after |
| 8 | Nessuna modifica a capability canoniche | `studio_user_capabilities`, its CHECK, its policies, and both RBAC functions are not altered |

STATUS: WAITING_PRODUCT_OWNER
