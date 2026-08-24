# Current task

- TASK: CHAT-POLYEDRON
- TITLE: Persistent Chat Polyedron
- OWNER: COPILOT
- BRANCH: `lucasimondi-chat-polyedron`
- BASE: `master` — PR #51 (POL-UI-015 Dashboard Premium V2) merged as
  `36a149759b7d1cf7827d17d4a8648fdb1f999570`, integrated into this branch by
  a merge commit (POL-CHAT-001 integration).
- PR: `#53`
- STATUS: `WAITING_PRODUCT_OWNER` — implementation complete, rebased onto the
  merged POL-UI-015 master and locally validated; not merged, not deployed,
  and no remote migration was applied.
  validated; not merged, not deployed, and no remote migration was applied.

## Objective

Implement Chat as the persistent conversational interface for the one existing
Polyedron. Reuse the singleton Poliedron orchestration, provider/model gateway,
context, permission, action, and memory path; persist one continuous primary
thread per active studio user with fail-closed RLS; expose the same conversation
through mobile Chat, desktop navigation, and a real unread bell.

## Completed scope

- Persistent recent history with bounded upward pagination.
- Studio + user isolation, active-membership enforcement, RLS, indexes, and
  synthetic cross-user/cross-tenant tests in one additive migration.
- Same `processQuery` / Model Gateway / `agente-assistente` path as the existing
  Polyedron; no second chatbot, provider, prompt stack, or orchestration layer.
- Mobile-first dynamic-viewport Chat, desktop long-conversation layout,
  keyboard-safe composer, retry/double-submit/slow-response handling, and
  near-bottom conditional auto-scroll.
- Real unread/read semantics (`read` never means task completion).
- Mobile Chat replaces Setup in the five-slot dock. Setup remains explicitly
  available in the Poliedron navigation menu, per Product Owner decision.
- Desktop Chat navigation and a global bell open the same primary conversation.

## Safety boundaries

- Do not modify Agenda's unrelated booking-request bell semantics.
- Do not implement reminders, scheduler/cron, proactive message generation,
  autonomous loops, task completion/snooze, push, email, or SMS.
- Do not weaken RLS, add tenant fallback, expose provider secrets, duplicate
  Polyedron, or invent production state.
- Do not apply migrations remotely, deploy, merge, or use production data.

## Exact next action

Product Owner reviews PR #53, including mobile/desktop
conversation UX and the additive migration/RLS contract. Do not merge, deploy,
or apply `20260824030000_chat_polyedron.sql` remotely without explicit Product
Owner approval.

## POL-CHAT-001 — integration of the merged POL-UI-015 master

The new `master` (merge commit `36a1497`) is the source of truth for Dashboard
Premium V2, persistent Home personalization, the Richiami widget, mobile
fullscreen Home, the floating hero, dock clearance, the Consigli Poliedron
carousel, and the STRUCTURE of both the notification bell and the mobile dock.
This branch remains the source of truth for the persistent Chat itself:
conversations/messages, unread/read state, the Chat route, the Chat entry in
the dock, the bell wired to Chat, Chat persistence/Realtime, and the Chat
migration.

Where the two overlapped, POL-UI-015's approved UI was kept and POL-CHAT-001's
real behaviour was wired into it:

- **Bell** — POL-UI-015 shipped `PoliedronBell.jsx` as a UI-only placeholder
  (badge with no producer, click reopened the quick panel). The component, its
  look and its approved mobile/desktop positioning are kept unchanged; it now
  receives the real `unreadCount` from `usePoliedronConversation()` and opens
  the persistent Chat page. PR #53's own separately positioned
  `.poliedron-notification-bell` markup/CSS was dropped as a duplicate. The
  bell is hidden while already on Chat.
- **Mobile dock** — Chat replaces Impostazioni in the five slots (POL-UI-015
  structure), but the Chat slot no longer calls `onToggle` on the quick panel:
  it navigates to the real Chat route and carries the unread badge.
  Impostazioni stays reachable from the central Poliedron panel's default
  suggestions (`searchEngine.js` preferred sections, from master).
- **One Poliedron** — the Chat page is the single `Poliedron` instance
  portalled into `App.jsx`'s `poliedronChatHost`. No second agent, no second
  open state, no second orchestration path.
- **App shell padding** — the merged `App.jsx` keeps master's mobile
  fullscreen rules for Home/Agenda and adds the zero-padding Chat page.
- **Dashboard persistence** — the new Home persistence and its
  (still temporary) `HOME_SAVE_*` preview instrumentation from round 4 of
  POL-UI-015 were NOT modified by this integration; removing or downgrading
  that instrumentation remains an open POL-UI-015 debt on master.


---

# Historical record: POL-UI-015 / Dashboard Premium V2 (merged to master as `36a1497`)

- TITLE: Dashboard premium v2 — personalization persistence root cause,
  Richiami widget, mobile fullscreen, floating dock/hero, Consigli
  carousel, Poliedron bell + Chat entry point, Impostazioni relocation
- OWNER: CLAUDE
- BRANCH: `feature/POL-UI-015-dashboard-premium-v2`
- BASE: `master` (POL-UI-004-AGENDA-QUICK-HUB/Agenda Mobile V2 merged as
  `b65cdba`, PR #50)
- STATUS: `WAITING_PRODUCT_OWNER_REAL_QA` — PR #51 open, not merged, not
  deployed. Rounds 1 (`c4df202`), 2 (`77d64d5`) and 3 (`1a82027`) were all
  rejected. On `1a82027` the Product Owner verified the preview personally:
  **Richiami OK, Dashboard OK, Personalizza Home STILL DOES NOT SAVE.**
  BUG A is therefore CLOSED; round 4 touched BUG B only — Richiami, the
  visual Dashboard, Richiami CSS, fullscreen and Poliedron were not
  modified.

  Round 4 found that round 3's own fix was the blocker:

  - The verified read-back compared `JSON.stringify` of the layout sent with
    `JSON.stringify` of the layout read back. Postgres `jsonb` stores object
    keys sorted by length then bytewise, so the two strings could never be
    equal for ANY layout on ANY account. Every save therefore threw
    "il layout Home persistito non corrisponde a quello inviato" AFTER the
    write had landed, the modal stayed open and nothing was committed to
    state. Fixed with a canonical fingerprint that ignores key ORDER while
    still comparing array order, ids, `visible`, `size`, `config` and
    length. The UPSERT → READ-BACK → compare → THROW contract is preserved.
  - `homeLayoutDiagnostics` was gated on `import.meta.env.DEV`, and a
    Netlify deploy preview is a production build — so the entire diagnostic
    trail was compiled away in the only environment where the bug
    reproduces. It is now enabled on deploy-preview/localhost hostnames too,
    never on production hostnames.
  - `draftInherits` was audited and is NOT the cause: all five editing
    handlers clear it, and for the reporting account it is already `false`
    on open. There is no second, divergent Salva button and no overlay
    intercepting the click.
  - The Product Owner's device is an **iPhone** (verified from edge logs).
    The footer action row now wraps and the primary Salva button is
    non-shrinking with a 44px touch target; the Azioni rapide tab gained the
    error alert it was missing.

  STILL OPEN: the edge logs show ZERO write requests on
  `user_home_layouts` in the test window, so it is not proven that the click
  reaches `saveHomeCustomization` on iOS Safari at all. Temporary
  preview-only instrumentation (`HOME_SAVE_*` events plus an on-screen
  "DEV/PREVIEW · save state" badge under both Salva buttons, no secrets and
  no identifiers) was added to settle exactly that on the next real QA. It
  must be removed or downgraded before merge.

  See "POL-UI-015 handoff round 4" in `handoffs.md` for the full evidence
  and the VERIFIED / NOT VERIFIABLE split. Same branch, same PR #51 — no new
  branch, no new PR, no merge, no deploy.

  NOT VERIFIABLE in round 4: authenticated preview QA, iPhone QA and desktop
  QA — no browser with the Product Owner's session is available here and no
  credentials were requested or used. `npm test` 410/410, build clean.

## Objective

Fix the real Dashboard personalization persistence bug at its root cause,
build a premium operational Richiami widget, bring mobile Dashboard to the
same fullscreen principle Agenda already has, turn the greeting block into
a compact sticky/floating bar with date/time, guarantee the last widget
always clears the floating dock, redesign Consigli Poliedron as a mobile
one-card-at-a-time carousel, prepare (UI-only) the Poliedron bell and a
Chat dock entry point — both reusing the single existing Poliedron agent,
never a second one — and move Impostazioni out of the mobile dock into the
central Poliedron panel's default suggestions. Explicitly out of scope:
any real AI/reminder/notification engine, a second Poliedron, or a real
Chat implementation — those are future tasks this one only prepares UI/
navigation for.

## Safety boundaries

- No schema, RLS, dependency, or production change of any kind.
- No new AI engine, reminder engine, notification polling, or second
  Poliedron/chat agent — the bell and dock Chat button are UI-only
  placeholders that open the SAME existing Poliedron conversation.
- Agenda, Pazienti, Poliedron's own size/behavior, and the global design
  system are untouched except where this task explicitly required a
  shared-rule fix (the mobile Home `!important` padding override).
- No merge or deploy without explicit Product Owner approval.

## Exact next action

Product Owner re-tests preview #51 once it rebuilds from the round-3 commit:
confirm the Richiami widget now appears in the Dashboard without any other
personalization changing, and that Personalizza Home either really persists
(verifiable with a page reload) or fails with a visible error while staying
open with the draft intact. Do not merge, do not deploy to production, do
not open a new PR.

Open decision (`PRODUCT_OWNER_DECISION_REQUIRED` if the answer is no): the
round-3 Richiami fix treats a pre-POL-UI-015 `richiami: visible:false` as a
stale default rather than a deliberate user choice, per the explicit
requirement "visibile di default per owner/admin" combined with "non
resettare tutte le personalizzazioni". If that reading is wrong, the
migration must be reverted.

---

# Historical record: POL-UI-004-AGENDA-QUICK-HUB / Agenda Mobile V2 (merged to master)

- Branch: `lucasimondi-agenda-mobile-fullscreen` — PR #50, merged to
  `master` as `b65cdba`.
- Objective: mobile Agenda fullscreen shell, floating overlay controls,
  dynamic day strip, dock-aware appointment action sheet, and the
  Appointment Quick Action Hub (call/patient/recall/activity/contextual
  Poliedron mini-input).
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-004-AGENDA..."
  entries).

---

# Historical record: POL-AI-005A (merged to master)

- Branch: `feature/POL-AI-005-transactional-action-planner` — PR #46, merged
  to `master` as `c442c6f`.
- Objective: Phase A (READ + PLAN only) foundation for the transactional
  action planner — deterministic command parsing, patient/procedure
  resolution contracts, a tooth model for incomplete-but-valid clinical
  data, and non-executing Action Plans for representative workflows. No
  writes, no CONFIRM/ACT/VERIFY — that became POL-AI-005B (see "Current
  task" above).
- Full detail: `docs/architecture/POL-AI-005A-domain-audit.md`,
  `docs/architecture/POL-AI-005A-planner-foundation.md`, and
  `docs/coordination/handoffs.md` ("POL-AI-005A..." entries).

---

# Historical record: POL-AI-004 (merged to master)

- Branch: `lucasimondi-feature-pol-ai-004-proactive-intelligenc` — PR #45,
  squash-merged to `master` as `ab1bd27`.
- Objective: deterministic, explainable, permission-aware, tenant-safe
  Poliedron proactive intelligence layer — canonical source adapters,
  transparent scoring/confidence, Studio Data Health, bounded cache,
  semantic query routing, grouped approved-panel renderer. Zero Model
  Gateway calls for discovery; no writes.
- Full detail: see `docs/coordination/handoffs.md` ("POL-AI-004..." entries)
  and `docs/architecture/POL-AI-004-proactive-intelligence.md`.

---

# Historical record: POL-UI-013 (merged to master)

- Branch: `feature/POL-UI-013-dashboard-modular-workspace` — PR #44, merged to
  `master` as `590b8ca`.
- Objective: Dashboard modular workspace, `Consigli Poliedron`, touch/mouse
  drag-and-drop, widget resize and the personalization load/save race fix.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-013 Dashboard
  modular workspace + Poliedron centrality" and subsequent audit/race entries).

---

# Historical record: POL-UI-012 (merged to master)

- Branch: `lucasimondi-pol-ui-012-mobile-document-kpis` — PR #42, merged to `master` as `93dfe6a`.
- Objective: correct the top Documenti KPI cards on mobile so their values remain proportionate and contained at 375px, 390px, and 430px widths, without changing desktop/tablet presentation or shared `StatCard` behavior elsewhere.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-012 Mobile Document KPI sizing").

---

# Historical record: POL-AI-002B (merged to master)

- Branch: `lucasimondi-pol-ai-002b-workflows` — PR #41, merged to `master` as `c82b69a`.
- Objective: restore Poliedron as the application's single conversational AI and action surface, including Product Owner-approved suggest-first input semantics.
- Full detail: see `docs/coordination/handoffs.md` ("POL-AI-002B Poliedron Conversational Actions & Workflows" and subsequent reconciliation/revision entries).

---

# Historical record: POL-AGD-WA-001 (merged to master)

- Branch: `claude/whatsapp-agenda-cancel-rql7fg` — PR #39, merged to `master` as `e5b24d4`.
- Objective: allow an in-progress Agenda WhatsApp bulk send to be cancelled before all scheduled windows open.
- Full detail: see `docs/coordination/handoffs.md` ("POL-AGD-WA-001 Agenda — allow cancelling a WhatsApp send").

---

# Historical record: POL-AI-002A (merged to master)

- Branch: `fix/POL-AI-002A-adaptive-poliedron` — PR #36, merged to `master` as `1faa9bb`.
- Objective: Poliedron adaptive interface — compact mobile dock, desktop edge dock, precise drag, prefix navigation. Full detail in `docs/coordination/handoffs.md`.

---

# Historical record: POL-AI-001 (merged to master)

- Branch: `feature/POL-AI-001-poliedron-universal-interface` — PR #35, squash-merged to `master` as `e504e52`.
- Objective: first architecture of Poliedron — global Orb, Spotlight-style command panel, provider-independent Model Gateway, deterministic-first intent/search, Action Registry reusing existing workflows, Permission Engine reusing existing RBAC. Revised once more to make Poliedron the app's single AI entry point (AssistenteAI's floating widget unmounted, kept internal for future convergence).
- Full detail: `docs/coordination/handoffs.md` ("POL-AI-001 Poliedron Universal Operating Interface (Phase 1)" and the two review-round entries that follow it).

---

# Historical record: POL-UI-011 (merged to master)

- Branch: `lucasimondi-hotfix-pol-ui-011-mobile-edge-to-edge-sh` — PR #37, merged to `master` as `d95af43`.
- Objective: establish the mobile `100dvh` edge-to-edge flex shell and remove the retired dock's global bottom reservation while keeping fixed controls as overlays.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-011 mobile edge-to-edge shell").

---

# Historical record: POL-UX-001 (draft PR open, awaiting Product Owner review)

- Branch: `ui/POL-UX-001-visual-system-dashboard-experience`, based on `master@7a0c490` (POL-UI-003 already merged).
- Objective: complete the Poliedra UI/UX as one organic design-system mission — shared tokens, header/Home visual integration, real Quick Booking with authoritative free-slot computation, customizable quick actions with a workflow contract, a unified Pannello Economico on the canonical contract only, and app-wide propagation of shared card/button primitives — without touching clinical/financial logic, RLS, or migrations.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UX-001 Poliedra Visual System & Dashboard Experience" entry) for the complete audit, files changed, database impact (none), and test results.
- Status when superseded as the active task: `WAITING_PRODUCT_OWNER` — draft PR open, not merged. Exact next action unchanged: Product Owner reviews the draft PR; do not deploy or merge without explicit approval.

---

# Historical record: POL-UI-003 (completed, merged to master)

Apply the Product Owner-approved premium visual direction to the Poliedra Home (desktop/tablet sidebar, hero, quick actions, canonical KPI card styling) while preserving POL-UI-001/POL-UI-002 personalization behavior, POL-RBAC-001/POL-RBAC-001A's capability-based permission model, and all canonical financial contracts unchanged. Also fixed a Product Owner-flagged mobile layout defect in the Agenda widget and audited touch targets across Home. Merged to `master` as `7a0c490`; PR #17 closed.

---

# Historical record: POL-RBAC-001A (completed, merged to master)

Close the residual risk the Product Owner identified in POL-RBAC-001: a
`clinical.personal_trainer`/`clinical.massage_therapist` capability alone let
a user read every Fisio patient in the tenant. Separate CAPABILITY ("may act
as X") from ASSIGNMENT ("may act on THIS patient"), add a tenant-safe
`patient_care_assignments` table, and make PT/massage_therapist Fisio RLS
require an active assignment. Physiotherapist access stays tenant-wide
per the already-approved contract. Add a minimal "Team del percorso"
UI to view/manage a patient's assigned professionals.

## Product Owner decisions (recorded verbatim)

Two open decisions were resolved by the Product Owner and applied in full:

> 1. APPROVATO `episode_id → physio_piani` esclusivamente come adapter
>    transitorio fino alla stabilizzazione del canonical episode di
>    POL-FIS-001. Documentalo esplicitamente come transitional compatibility
>    layer. Non creare un secondo modello episodio e non eseguire backfill
>    inventati.
> 2. Per PT e massage therapist approvo la visibilità del roster
>    esclusivamente sul percorso al quale sono attivamente assegnati,
>    applicando data minimization: possono vedere nome/identità
>    professionale, ruolo nel percorso e stato dei membri attivi del team.
>    Non devono poter derivare capability globali, altri assignment, altri
>    pazienti o contenuti clinici aggiuntivi tramite il roster. Il
>    fisioterapista autorizzato può avere la vista completa del team
>    prevista dal contratto.

**Decision 1 — already satisfied, documentation-only change.** The
implementation already matched exactly: nullable `episode_id`, patient-level
RLS gating only, no second episode model, no backfill anywhere. The
migration's table/column comments, header, and the architecture doc now say
"TRANSITIONAL COMPATIBILITY LAYER" explicitly, per instruction.

**Decision 2 — did not match, real fix applied (checked before assuming).**
Two gaps found and closed:

1. `patient_care_assignments_select`'s "shared teammate" branch granted
   **full-row** SELECT (including `created_by`, timestamps, `ended_by`,
   `reason`) to any active teammate on the same patient — exceeding
   "identità, ruolo, stato". Fixed by removing that branch from the base
   table policy entirely and adding `patient_care_team_roster_v1(studio_id,
   patient_id)`, a `SECURITY DEFINER` function returning only `id, user_id,
   assignment_type, active` — a structural column restriction, not a
   convention. `PhysioCartella.jsx` now reads the roster exclusively through
   this RPC; a direct API call gets the same four columns regardless of
   client code.
2. While rebuilding this, found `caller_has_active_patient_assignment_v1`
   never re-checked the caller's own `studio_users.stato = 'attivo'` — a
   suspended user with a still-`active=true` assignment row could still pass
   it. Fixed with a `studio_users` join; the same membership check now also
   applies to the *listed* rows in the roster (a suspended member's
   still-active assignment no longer counts as part of "the active team").

Full detail: `docs/architecture/pol-rbac-001a-patient-care-assignment.md`
("Authorization" section) and `docs/architecture/pol-rbac-001a-local-validation.md`.

## Rebase onto master (PR #15 squash-merged)

PR #15 (POL-UI-002) was squash-merged to `master` as
`1348dd9801dad882ad0a370cbb08e89066af7c31`. GitHub then retargeted PR #16
onto `master`, but its branch still carried the old, now-duplicate
stacked history (the individual POL-UI-002 commits plus everything
before them), making it unmergeable against the new `master`.

Before touching anything, confirmed the trees were byte-identical:
`git diff b9370ad 1348dd9` (old POL-UI-002 branch tip vs. the new squash
commit on master) produced **zero** output — the squash preserved the
content exactly. This meant the seven POL-RBAC-001/POL-RBAC-001A commits
(`b9370ad..0c675e9` on the old history) could be replayed verbatim onto the
new master with `git rebase --onto origin/master b9370ad
security/POL-RBAC-001-authoritative-capabilities` — and they applied with
**zero conflicts**, confirming the prediction.

Verified before pushing:
- `git diff <pre-rebase-tip> <post-rebase-tip>` — empty. The resulting tree
  is byte-for-byte identical to before the rebase; nothing was lost,
  changed, or duplicated by the history rewrite itself.
- `git merge-base --is-ancestor origin/master HEAD` — true. The branch is
  now a direct, clean, fast-forwardable stack on `master`.
- `git diff origin/master..HEAD --stat` — 24 files, all POL-RBAC-001/
  POL-RBAC-001A-owned (migrations, RLS tests, `PhysioCartella.jsx`,
  `SchedaPaz.jsx`, docs) plus exactly two pre-existing, intentional
  touch-ups to POL-UI-002's own files that predate this session (part of
  the original POL-RBAC-001 commit, not introduced by the rebase):
  `tests/homeFinancialWidgets.test.mjs` (updated to the capability-array
  contract `createRolePresetLayout([...])` replaced the old
  `(ruolo, vertical)` signature) and
  `docs/architecture/pol-ui-002-implementation-validation.md` (updated
  prose to describe the capability-based preset resolution). No
  `CanonicalFinancialWidget`/`homeWidgetRegistry`/`homeLayoutPersistence`
  or other POL-UI-002 feature file appears in the diff — no duplication.
- Full required checklist re-run after the rebase, before pushing: 30/30
  Node tests (20 original POL-UI-002 + 10 POL-RBAC-001/POL-RBAC-001A);
  PostgreSQL 16 (dev) full migration/regression chain; `supabase db lint`
  (PG16, no schema errors); **PostgreSQL 17.5 final gate** (PGlite,
  complete chain incl. the two-tenant/assignment/suspension/roster
  assertions) — all green; `npm run build` clean; `git diff --check`
  clean; secret-pattern scan over the full `origin/master..HEAD` diff — no
  matches.

A local tag `backup/pol-rbac-001a-pre-rebase-0c675e9` was created before
rewriting, pointing at the pre-rebase tip, purely as a local safety net —
not pushed, not part of the repository's tracked history.

The push to `origin/security/POL-RBAC-001-authoritative-capabilities` after
this rebase is **non-fast-forward** (history was rewritten) and uses
`--force-with-lease`, per explicit Product Owner instruction to realign the
branch. No merge, deploy, or remote migration was performed.

## Safety boundaries

- No automatic patient/professional assignments are inferred or seeded in
  any migration; only synthetic test fixtures create assignment rows.
- Assignment authorization requires active membership on both caller and
  target, in the same tenant; suspended membership denies access even with
  a matching capability and an active assignment — now enforced on every
  read path, including the team roster (see decision 2 above).
- Physiotherapist Fisio access is unchanged (tenant-wide by capability) —
  not accidentally narrowed by this task.
- No production access, remote migration, backfill, deployment or merge is
  authorized or performed.

## Completion state

`patient_care_assignments` (additive table), its authorization/eligibility
helper functions, author-enforcement/immutability trigger and RLS are
implemented in one migration stacked after POL-RBAC-001's. Redefining
`physio_patient_in_studio_v1` in place tightens all its existing callers;
the three Fisio READ policies that previously granted tenant-wide access on
capability alone are re-scoped to patient level; `physio_esecuzioni` gains
server-enforced authorship so PT/massage_therapist can record and read their
own execution log. `studio_user_capabilities` SELECT is extended (clinical.*
rows only) so a physiotherapist can browse teammate capabilities for the
"Assegna professionista" picker. `PhysioCartella.jsx` gains a "Team del
percorso" section and management modal, gated client-side by capability
(`canManageTeam`) purely for UX — RLS/the roster RPC's own authorization
check is authoritative. `episode_id` is a nullable, Product-Owner-approved
transitional compatibility layer onto the existing `physio_piani` table,
pending POL-FIS-001 convergence — this did not block the tenant/RLS/
assignment work.

Validation passed locally: original 20 POL-UI-002 + 6 POL-RBAC-001 Node/SQL
regressions (with the RBAC fixture updated for the new assignment-gated
contract), all POL-RBAC-001A SQL assertions — including nine new assertions
for the decision-2 roster/suspension fix — (Studio A/B, Patient A/B, PT1/
PT2/Massage1/multi-role/suspended/cross-tenant/revocation/author-spoofing/
assignment-management-authorization/roster-data-minimization), 4 POL-RBAC-001A
Node tests (one updated this round for the roster RPC change), and a clean
Vite production build. See
`docs/architecture/pol-rbac-001a-local-validation.md`.

**PostgreSQL 16 was preliminary development only.** Per explicit Product
Owner instruction, the full required checklist (migration chain, POL-RBAC-001
regression, POL-RBAC-001A assignment regression, RLS two-tenant, assignment/
revoke, suspended user, author spoofing, cross-tenant, unassigned PT,
unassigned massage therapist, physiotherapist flow, build, Node test,
secret/diff/scope check) was re-run unmodified — including after the
decision-2 fix above — against a genuine **PostgreSQL 17.5** engine. Docker
and `apt.postgresql.org` are both denied by this sandbox's network policy
(confirmed with concrete 403s against three independent hosts: PGDG apt,
Supabase's own Docker image blob storage, and plain Docker Hub's blob
storage), so PostgreSQL 17.5 was obtained via `@electric-sql/pglite` — a
real Postgres compiled from unmodified source to WASM, distributed on the
(allowlisted) npm registry — after an RLS smoke test confirmed it enforces
roles/policies/`set_config` correctly, not a stub. Every item on the list
passed on PostgreSQL 17.5 except `supabase db lint`, which ran for real but
against PostgreSQL 16 (the TCP adapter needed to expose PGlite over the wire
protocol only supports the PostgreSQL 18 PGlite line, confirmed by a hung
handshake when forced against 17.5) — see "Residual risks" below. Full
engine-by-engine breakdown, transcripts and exact hosts/errors:
`docs/architecture/pol-rbac-001a-local-validation.md`.

Two self-review passes after the initial push (a code-review pass and a
dedicated security-review pass) each found and fixed one real least-privilege
issue, both since regression-tested: (1) the `studio_user_capabilities`
extension for physiotherapists originally exposed every capability row in
the studio, not just `clinical.*` ones — narrowed with
`capability LIKE 'clinical.%'`; (2) `patient_care_assignments_select`'s
"shared patient" branch checked the caller's active assignment but not
whether the row being read was itself active — this branch was since removed
entirely per Product Owner decision 2 above, superseding that earlier fix.
The responsive "Team del percorso" UI (375/768/1024/1440px) was verified by
screenshotting the shipped component's exact markup/styles headlessly (the
live app cannot be driven in this sandbox without touching the real
production Supabase project it's hardcoded to, which the safety rules
forbid) — see the local-validation doc for details and results.

## Residual risks

- `supabase db lint` ran against PostgreSQL 16, not PostgreSQL 17 (see
  above) — the schema/policy checks it performs are static, not
  version-dependent, and it reported no errors both before and after the
  decision-2 fix, but a literal PG17 CLI-lint run needs Docker or PGDG apt
  access this sandbox's network policy does not grant.
  `PRODUCT_OWNER_DECISION_REQUIRED` if that's required before merge.
  Security/performance advisors (Supabase-hosted) remain unavailable in this
  sandbox for the same reason on either engine.
- Physiotherapist Fisio access remains tenant-wide (unchanged from
  POL-RBAC-001); the model supports but does not yet implement per-patient
  restriction for physiotherapists, as the mission anticipated as future
  work. Not requested by either Product Owner decision in this round.
- `episode_id`/POL-FIS-001 convergence and the roster visibility tier are
  now **decided**, not open — removed from this list. When POL-FIS-001
  merges and stabilizes, a follow-up migration must repoint/rename
  `episode_id`; that follow-up's exact mechanics remain to be designed then,
  not a decision blocking this task.
- Existing dependency advisories (`npm audit`) and pre-existing build
  warnings remain outside this task's scope, unchanged from prior handoffs.

## Exact next action

Product Owner and Tech Lead review the stacked POL-RBAC-001 + POL-RBAC-001A
commits together on PR #16, now incorporating both recorded decisions. Do
not apply remotely, deploy, merge POL-RBAC-001A/POL-RBAC-001, or merge PR
#15/#16 without explicit Product Owner approval.

(POL-RBAC-001/POL-RBAC-001A have since merged to `master`; PR #16 is closed. This record is kept for audit history — see "Current task" above for the active task.)
