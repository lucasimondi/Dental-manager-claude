# Current task

- TASK: POL-UI-017 — ROUND 3
- TITLE: Product Owner live-preview feedback on Round 2 — Setup dock clearance hardening, quick-action icon/label fixes, three new quick actions
- OWNER: CLAUDE, on direct Product Owner feedback after testing the R2 preview
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn` (same branch/PR as Round 2 — PR #74, no new PR opened)
- BASE: Round 2's own commit `94bc651` on this branch
- STATUS: WAITING_PRODUCT_OWNER_POL_UI_017_R3_QA
- OBJECTIVE: a fourth round of Product Owner feedback on the same live PR #74 preview, addressing four points: (1) harden the `.page-dock-clearance` pattern Round 2 already introduced for Impostazioni so it is byte-parallel to `.home-dock-clearance` in both mobile media queries, closing any doubt that a long Setup section could end up under the floating dock; (2) fix the "Documento" quick action rendering with no icon; (3) remove a literal "+" prefix baked into several quick-action labels; (4) add three new quick actions (Ricetta, Consenso, Da incassare) on the same catalog infrastructure.
- WHAT SHIPPED:
  - §1 Dock clearance hardening — `.page-dock-clearance` was already added in Round 2's own last commit (`94bc651`) and applies unconditionally to Impostazioni (rendered once, outside every `sezione`-gated block, so it covers every Setup tab, not only the new "Azioni rapide" one). Re-verified structurally correct (base `display:none`, `display:block` inside the canonical `(max-width:719px), (pointer:coarse)…` query, no later override resets it) and hardened for full parity: it is now ALSO declared `display:block` inside the legacy `@media (max-width:600px)` block, exactly mirroring `.home-dock-clearance`'s own dual declaration, removing any remaining doubt.
  - §2 Icon fix — `Ic.jsx`'s `ICONS` map has no `doc` key, so the "Documento" quick action (`ic: 'doc'`) silently rendered nothing (not a "+" fallback — `Ic` returns `null` for an unknown key). Changed to `ic: 'file'`, the same generic-document icon `DocMedico.jsx`'s own "Foglio bianco intestato" type already uses for the identical concept. New regression test reads the real `Ic.jsx` icon registry and asserts every catalog `ic` id is a real key, so a future typo'd icon id fails the suite instead of rendering blank.
  - §3 "+" removed — the "+" the Product Owner saw was NOT an icon-missing fallback (confirmed distinct from §2 by reading the code): it was a literal `'+ '` text prefix baked into several `QUICK_ACTIONS_CATALOG` labels (Nuovo appuntamento, Nuovo paziente, Paziente e appuntamento, Nuovo preventivo, Nuova spesa, Documento, Task). Removed from all of them; the actions/ids/gates/`run()` handlers are unchanged, only the display string.
  - §4 Three new quick actions, same infrastructure, nothing invented: **Ricetta** (`ic:'pill'`, the exact icon `DocMedico.jsx`'s own TIPI list already uses for `id:'ricetta'`) and **Consenso** (`ic:'edit'`) both land on Pazienti first (`run: (ctx) => ctx.onNavigate('paz')`), the same "patient-scoped, no target patient from Home" fallback `nuovo_paziente_appuntamento`/`nuova_seduta_fisio` already use — from there the existing, unmodified SchedaPaz "Doc" tab (DocMedico for Ricetta, its own `puoiPrescrivere` gate untouched; `consenso_modelli`/`PannelloInvioDocumento` for Consenso) takes over unchanged. **Da incassare** (`ic:'eur'`, the same icon this file's own "Eseguito da incassare" modal already uses for the identical concept) is an explicit, honest placeholder per Product Owner instruction — the real receivables module is separate, still in development, and a doc named `piano-modulo-incassi-da-incassare.md` referenced in the feedback was searched for and does NOT exist in this repository (recorded here for transparency; the Product Owner's own instruction to build a placeholder now stood regardless and did not require that doc). The placeholder calls a new `openComingSoon(msg)` hook on the quick-action context — wired in `Dashboard.jsx` as a small `comingSoonMsg` state rendering the SAME shared `Toast` component `Impostazioni.jsx` already uses (no new UI primitive) — never a fake navigation. None of the three new actions were added to `DEFAULT_QUICK_ACTION_IDS`: they appear in "Personalizza azioni rapide" as addable, exactly like `documento`/`nuova_spesa`/`controllo_gestione` already do, with no change to what shows without configuration.
- SAFETY BOUNDARIES HONOURED: same as Round 2 (see below) — no schema/RLS/financial-formula/business-logic/Chat-persistence change; `git diff` shows zero changes to the Poliedron engine/dock-geometry files; no widget id added or removed; Home's personalization save/load path untouched. The three new quick actions reuse existing pages/tabs/gates (Pazienti, DocMedico, consenso_modelli) — no new route, no new table, no new RPC.
- FILES CHANGED (round 3, in addition to round 2's own list below): `src/lib/quickActionsCatalog.js`, `src/components/Dashboard.jsx`, `src/components/PremiumVisualSystem.css`, `tests/mobileHomeRound2.test.mjs`, `tests/quickActionsCatalog.test.mjs`, this file, `docs/coordination/handoffs.md`.
- VALIDATION: full `npm test` 570/570 (6 new assertions in `quickActionsCatalog.test.mjs`, 4 new in `mobileHomeRound2.test.mjs`); `npm run build` clean; `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA on a real device or preview — same constraint as Round 2, no authenticated session available here. The dock-clearance hardening and icon fix are argued from source/stylesheet-level regression tests, not a live rendering.
- EXACT NEXT ACTION: Product Owner re-tests the same PR #74 preview (new commit on the same branch, same URL once Vercel redeploys) — confirms Setup no longer clips under the dock on a real phone, "Documento" shows its icon, no quick action shows a "+", and Ricetta/Consenso/Da incassare appear correctly in "Personalizza azioni rapide". Do NOT merge and do NOT deploy without explicit Product Owner approval. Do not start Round 4 unprompted.

---

# Previous current task

- TASK: POL-UI-017 — ROUND 2
- TITLE: Mobile Home and navigation refresh (action-first Home, priority area, progressive-disclosure quick actions, dock/bell audit)
- OWNER: CLAUDE
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn`
- BASE: `origin/master@05ee761` (merge PR #73, POL-UI-017 R1 — mobile foundation and shell)
- STATUS: SUPERSEDED BY ROUND 3 ABOVE — round 2's own record kept verbatim below for audit history.
- OBJECTIVE: make the mobile Home an OPERATIONAL HOME rather than a stack of boxes — a compact branded hero, a real "Richiede attenzione" priority area built only from data the Home already holds, quick actions with the most frequent at the first level and the rest behind "Altro", a today-oriented band, and the existing informational/financial widgets demoted to a hierarchically secondary position. Scope is strictly mobile Home + mobile navigation + the visual integration between Home and the dock, built ON TOP of the Round 1 foundation (`MobilePageShell`, `mobileShell.js`, `designTokens.css`) rather than replacing it.
- WHAT SHIPPED:
  - §1 Hero — one compact sticky row on mobile (brand gem + greeting + date/time/appointment count) instead of three stacked lines with clamp(25px,3vw,32px) display type.
  - §2 Priority area — new `.home-attention` page chrome above the widget workspace, driven by the new pure selector `src/lib/homeAttention.js`. Sources, all pre-existing: open/overdue `richiami` (same `stato === 'da_fare'` + `dataScadenza` rule the Richiami widget uses), overdue payment deadlines from `useControlloDati` (only when `homePermissions.managementControl` is true), overdue patient-annotation promemoria, the next not-yet-passed appointment from today's list, and unread Poliedron advice. Capped at 4 rows; empty state is ONE compact "Tutto sotto controllo" line, never a large empty box.
  - §3 Quick actions — `partitionQuickActionsForMobile()` in `quickActionsCatalog.js` surfaces Nuovo appuntamento / Nuovo paziente / Pagamento / Richiamo first and moves the rest behind an "Altro (N)" toggle, mobile-only. A user who set their own order in Personalizza Home keeps it verbatim.
  - §4/§5 Hierarchy — mobile-only CSS priority banding on `.home-workspace .home-widget-frame[data-widget-id=…]`: actions (10) → today (20) → operational (30) → overview (40) → deeper detail (50). The persisted layout is untouched; DOM order remains the user's saved order and still decides within each band.
  - §7 Dock — the active slot's contrast was raised (11%→18% wash, 18%→34% border, plus a small ink bar). BUG FIXED: `.home-dock-clearance`, `.home-page` padding and the compact hero were gated on `@media (max-width: 600px)`, so every coarse-pointer landscape phone (844x390, 852x393, 932x430) and every 601–719px viewport — all of which the React shell already treats as mobile and therefore still shows the floating dock — lost the clearance entirely and rendered the last widget underneath the dock. Home now uses the Round 1 canonical mobile media query.
  - §8 Bell — was a 40x40 target, below the Round 1 44px touch floor; raised to `var(--pol-touch-min)`. Position, destination, unread architecture and the "no duplicate badge on the dock's Chat slot" rule are unchanged.
  - §9 Personalizza Home — a discreet 44x44 icon button on mobile (label visually hidden, aria-label/title kept). Save/load logic untouched.
- SAFETY BOUNDARIES HONOURED: no schema, migration, RLS, RBAC, financial-formula, business-logic or Chat-persistence change. `git diff` shows ZERO changes to `PoliedronOrb.jsx`, `usePoliedronPosition.js`, `usePoliedronEdgePosition.js`, `poliedronDragMath.js`, `poliedronSafeBounds.js`, `poliedronOrbSize.js`, `poliedronMobileDock.js`, `PoliedronMobileDock.jsx` and `PoliedronBell.jsx` — the Poliedron engine, the orb's size/position/drag and the dock's structure/slots/destinations/geometry are all untouched. No new quick action, no new widget id, no new alert for data that does not already exist, no second AI panel. Home's personalization save/load path (`homeLayoutPersistence.js`, the `layoutSaveEpochRef` stale-write guard, `draftInherits` semantics) is byte-for-byte unchanged. Desktop Home is not redesigned: every added surface is `display: none` outside the mobile media query.
- FILES CHANGED: `src/components/Dashboard.jsx`, `src/components/PremiumVisualSystem.css`, `src/lib/quickActionsCatalog.js`, new `src/lib/homeAttention.js`, new `tests/mobileHomeRound2.test.mjs`, `docs/coordination/current-task.md`, `docs/coordination/handoffs.md`.
- VALIDATION: new dedicated suite 38/38; full `npm test` 564/564; `npm run build` clean (only the pre-existing chunk-size warnings); `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA on a real device or preview — no authenticated session is available in this environment and none was requested or used. Responsive behaviour is argued from the stylesheet and the Round 1 shell contract, not from a live rendering.
- EXACT NEXT ACTION: Product Owner reviews the PR ("POL-UI-017 R2: mobile Home and navigation refresh") and QAs the mobile Home on a real phone at 375x667, 390x844 and 430x932 portrait plus 844x390 landscape. Do NOT merge and do NOT deploy without explicit Product Owner approval.

---

# Previous current task

- TASK: POL-DOC-ARCHIVE-MOBILE-OPEN-FIX
- TITLE: Patient record Documenti/Ricette — Apri/Stampa still didn't open on mobile after POL-DOC-ARCHIVE-OPEN-FIX
- OWNER: CLAUDE, on direct Product Owner report: in the patient record's Documenti tab, archived documents and ricette list correctly and open/download fine in the general Documenti (archivio) section, but on mobile specifically, opening/printing one from inside the patient record still shows nothing. Desktop works.
- BRANCH: `claude/mobile-recipes-docs-visibility-v9hk10`
- BASE: `origin/master@a34b4a0` (merge PR #70, which shipped POL-DOC-ARCHIVE-OPEN-FIX)
- STATUS: MERGED (PR #71, merge commit `070b28f`) — this file still recorded it as `IMPLEMENTED_AWAITING_PRODUCT_OWNER_QA` long after the merge landed; corrected during POL-UI-017 R2, see the handoff entry for the audit note.
- OBJECTIVE: make Apri/Stampa in `PatientWorkspaceDocuments.jsx` (the patient record's Documenti/Ricette tab, mounted by `SchedaPaz.jsx`) actually display the archived PDF on mobile, without touching the archive list/metadata loading, RLS, schema, or the working `ArchivioDocs.jsx` (general Documenti page) behavior.
- ROOT CAUSE: PR #70's fix made `apriPdf()` convert the `data:` URI to a `blob:` URL before `window.open()`, which fixed the previous data-URI-blocking bug, but `PatientWorkspaceDocuments.jsx` calls it from inside `withPdf()` — an `async` handler that `await`s a Supabase fetch (`loadPatientDocumentPdf`) before ever calling `apriPdf`/`window.open`. Desktop browsers tolerate `window.open()` shortly after an awaited gap tied to a click; mobile Safari/Chrome do not — they require the new-tab open to happen synchronously inside the original tap's call stack, otherwise it is silently blocked with no error and no fallback (`apriPdf`'s null-popup fallback never fires because mobile browsers return a non-null, permanently blank window instead of `null`). This is exactly why the general Documenti page (`ArchivioDocs.jsx`) already worked fine on mobile: its `visualizzaDoc()` also awaits the PDF fetch, but instead of `window.open` it opens the in-app `PdfViewerModal` (a `pdf.js`-based full-screen viewer, no new tab/window involved at all) — the same component `PannelloInvioDocumento.jsx` already uses for the fresh "Genera PDF" preview.
- FIX: `PatientWorkspaceDocuments.jsx` no longer imports/calls `apriPdf`/`window.open`. Both "Apri" and "Stampa / PDF" now call one `viewPdf(document)` that, once the PDF is fetched, opens the same lazy-loaded `PdfViewerModal` (with its existing Condividi/Scarica actions) used by `ArchivioDocs.jsx` and `PannelloInvioDocumento.jsx` — no new PDF viewer/backend was invented.
- SAFETY: no migration, database, RLS, Storage, dependency or financial formula change. Document/prescription list, metadata loading, and the general Documenti (`ArchivioDocs.jsx`) page are untouched. `src/lib/condivisionePdf.js`'s `apriPdf`/`scaricaPdf` are untouched and still used elsewhere.
- VALIDATION: dedicated test 11/11 (`tests/patientWorkspaceDocuments.test.mjs`, new regression test added); full suite 516/516; production build passed; `git diff --check` clean.
- EXACT NEXT ACTION: push the branch, then Product Owner confirms on an actual phone that Apri/Stampa in the patient record's Documenti tab display an archived document/ricetta. Do not merge without Product Owner approval.

---

# Previous current task

- TASK: POL-DOC-ARCHIVE-OPEN-FIX
- TITLE: Patient document archive — fix Apri/Stampa showing no document
- OWNER: CLAUDE, on direct Product Owner report after PR #69 merged (`281f2da`): archived documents now list correctly, but opening/printing one shows no document.
- BRANCH: `claude/merge-pr-69-master-u1o2fn`
- BASE: `origin/master@281f2da` (merge PR #69)
- STATUS: MERGED (PR #70, merge commit `a34b4a0`) — fix was real but incomplete: it resolved the desktop `data:` URI blocking, but not the mobile popup-blocking-after-await case. See POL-DOC-ARCHIVE-MOBILE-OPEN-FIX above.
- OBJECTIVE: make Apri/Stampa on `PatientWorkspaceDocuments` actually display the archived PDF, without changing the archive list, RLS, schema or lazy-load contract from PR #69.
- ROOT CAUSE: `openPdf`/`printPdf` called `window.open(dataUrl, …)` directly on the raw `data:` URI returned by `loadPatientDocumentPdf`. Modern Chrome/Edge/Android block top-level navigation to a `data:` URI (anti-phishing measure): the new tab opens but stays blank, with no visible error — exactly "non c'è nessun documento". `openPdf` additionally passed `noopener`, which per spec makes `window.open` always return `null`, so it silently fell back to a download every time instead of showing the PDF.
- VERIFIED IN PRODUCTION DB (read-only, no data exposed): `documenti_medici`/`documenti_fiscali` both have `pdf_base64` populated on every row (15/15, 7/7) and RLS (`documenti_medici_studio` / `documenti_fiscali_studio`, studio-scoped) is unchanged — the failure is client-side rendering, not missing data or access.
- FIX: added `apriPdf(dataUrl, filename, { print })` to `src/lib/condivisionePdf.js`, converting the data URI to a `blob:` object URL (the pattern this file and `PdfView.jsx` already use elsewhere for the same class of bug) before calling `window.open`, with a `scaricaPdf` download fallback if the popup is blocked. `PatientWorkspaceDocuments.jsx`'s `openPdf`/`printPdf` now call it instead of using `window.open` directly.
- SAFETY: no migration, database, RLS, Storage, dependency or financial formula change. Document list/metadata loading (PR #69) untouched.
- VALIDATION: full suite 515/515; production build passed.

---

# Previous current task

- TASK: POL-DOC-ARCHIVE
- TITLE: Patient document archive visibility
- OWNER: CODEX
- BRANCH: `fix/POL-DOC-ARCHIVE-patient-documents`
- BASE: `origin/master@36faf3f`
- STATUS: MERGED (PR #69, merge commit `281f2da`)
- OBJECTIVE: show the current patient's archived medical and fiscal documents in the stable patient record without loading PDF payloads until requested.
- ROOT CAUSE: the optional `onDocumentsChange` default was a new function on every render, retriggering the loading effect after every state update. A failure from either archive table also discarded the successful source.
- SAFETY: no migration, database, RLS, Storage, dependency, financial formula or production-data change.
- VALIDATION: dedicated document tests 26/26; full suite 515/515; production build passed.
- FOLLOW-UP: merging surfaced a pre-existing, separate bug in Apri/Stampa (see POL-DOC-ARCHIVE-OPEN-FIX above) — not a regression from this task, the `window.open` code path predates it.

- TASK: POL-UI-005C
- TITLE: Patient Workspace documents, prescriptions and consent adapters
- OWNER: CODEX
- BRANCH: `ui/POL-UI-005C-patient-docs-prescriptions-consents`
- BASE: `origin/master` at `6de2050` (merged PR #59)
- STATUS: PR_61_REALIGNED_AND_VALIDATED
- OBJECTIVE: connect the isolated Patient Workspace 2.0 to the existing patient document sources, real `DocMedico` prescription workflow, verified consent templates, structured context and read-aggregated timeline without changing the stable production patient route or creating schema.
- SAFETY: no migration, RLS, Storage, dependency, production route or stable `SchedaPaz.jsx`/`App.jsx` change. Document metadata is loaded only when the Documenti tab opens; PDF/base64 is fetched per click.
- GAP: signed-consent persistence/link creation is not verifiable from repository migrations or authenticated client code. The template/preview adapter is real, but signing remains disabled and clearly labelled; no backend was invented.
- REALIGNMENT: fetched and verified `origin/master@6de2050`; the PR branch already had that exact commit as its direct parent, so `git merge origin/master` was a clean no-op with no conflicts. Dedicated tests 23/23, full suite 458/458, build and `git diff --check` passed after verification.
- NEXT_ACTION: push the validation commit, wait for PR #61 previews/checks, verify the isolated demo and mergeability, then stop. Do not merge.

## Superseded task record

- TASK: POL-UI-005B
- TITLE: Patient Workspace 2.0 isolated visual foundation
- OWNER: CLAUDE (Round 6 + Round 6 recovery, direct Product Owner request; previous rounds by CODEX — see handoff below)
- BRANCH: `ui/POL-UI-005B-patient-workspace-v2`
- BASE: `origin/master` at `981724e` (merged PR #58 stable patient record recovery)
- STATUS: READY_FOR_PR_UPDATE
- OBJECTIVE: Round 6 recovery — commit `67fe427` introduced unauthorized CSS layout side-effects (flex-wrap on the Situazione economica bar, left-align + padding on the economy grid buttons, a margin-top on its `strong`, and a new border on installment chips) alongside the two authorized changes. Reverted every layout side-effect to `67fe427`'s parent (`c5edc7b`) while keeping only the quadrant tooth selector and the canonical economic color scheme.
- SCOPE (Round 6 recovery): `src/components/PatientWorkspaceV2.css` (surgical revert of the 5 non-color properties listed above) and `tests/patientWorkspaceV2.test.mjs` (updated + added guard assertions) only. No JSX change was needed — the regression was CSS-only.
- SAFETY: `SchedaPaz.jsx` and `App.jsx` remain byte-for-byte unchanged from `origin/master`; no Supabase, Storage, migration, dependency, effect, fetch, or production-route change. Demo stays isolated on `/patient-workspace-v2-demo`.
- NEXT_ACTION: commit and push the recovery to the existing PR #59, wait for Vercel/Netlify Ready, then stop for Product Owner review. Do not implement the audit proposal or merge.

## Previous incident record

- TASK: POL-UI-PATIENT-FREEZE-PROD
- TITLE: Production patient record loading hotfix
- OWNER: CODEX
- BRANCH: `hotfix/POL-UI-patient-freeze-prod`
- BASE: `origin/master` at `96b01c6`
- STATUS: READY_FOR_PR
- OBJECTIVE: remove the asynchronous patient-record chunk boundary that can leave PWA clients suspended indefinitely when opening a patient.
- SCOPE: `src/App.jsx`, one regression assertion, and coordination records only. No database, Dashboard, Agenda, dock, Polyedron, Chat, or Patient Workspace 2.0 changes.
- NEXT_ACTION: push the branch, open a PR to `master`, and perform authenticated preview smoke QA. Do not merge automatically.

## Previous task record

- TASK: CHAT-POLYEDRON
- TITLE: Persistent Chat Polyedron
- OWNER: COPILOT
- BRANCH: `lucasimondi-chat-polyedron`
- BASE: `master` — PR #51 (POL-UI-015 Dashboard Premium V2) merged as
  `36a149759b7d1cf7827d17d4a8648fdb1f999570`, integrated into this branch by
  a merge commit (POL-CHAT-001 integration).
- PR: `#53`
- STATUS: `WAITING_PRODUCT_OWNER_FINAL_QA` — implementation complete, merged
  onto the POL-UI-015 master, and the single authorized migration
  `20260824030000_chat_polyedron.sql` is now APPLIED to project
  `idklxdqebfceplrualgh` and verified with 26 real-database assertions
  (all rolled back, no residual test data). FASE 4-13 completed: the quick
  panel no longer carries any Chat history or history banner and no longer
  depends on the Chat backend; the Chat page is the one persistent-history
  surface, with classified error states (loading / empty / schema /
  permission / network / generic) and initialization-error precedence; the
  unread badge exists only on the bell; the temporary POL-UI-015 on-screen
  save diagnostics are removed. Not merged, not deployed to production; no
  other migration was applied. See the POL-CHAT-001 FASE 1-17 handoff entry
  for the full evidence and for what remains NOT VERIFIABLE (authenticated
  browser QA on the preview).

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
