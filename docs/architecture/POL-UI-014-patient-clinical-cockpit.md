# POL-UI-014 — Patient Clinical Cockpit

## Product objective

The patient page is now a clinical-operational cockpit rather than only a
tabbed profile. For an authorized clinical user it exposes, from one
responsive surface:

- patient identity and available visit/appointment context;
- treatment work completed and remaining;
- anatomical grouping and selection;
- missing clinical metadata;
- the next appointment and recent activity;
- a contextual entry into the existing Poliedron singleton.

The legacy patient tabs remain available and continue to own their existing
write flows. POL-UI-014 does not create a second patient, treatment, payment,
appointment, document, or AI data model.

## Baseline and boundaries

- Baseline: `origin/master@c442c6f` (POL-AI-005A merged).
- No migration, schema, RLS, RBAC, deployment, or production data access.
- No voice capture.
- No POL-AI-005B executor: CONFIRM → ACT → VERIFY remains unavailable.
- No clinical auto-write. Poliedron Action Plans remain frozen, data-only
  Phase A previews.

## Information hierarchy

`PatientClinicalCockpit.jsx` renders:

1. patient header;
2. four primary KPI positions;
3. Clinical Map;
4. care plan grouped by anatomical context;
5. contextual Poliedron card;
6. Data Health/incomplete-data section;
7. next appointment;
8. patient financial availability state;
9. unified derived timeline.

The cockpit is the default patient surface only when an active membership
has at least one `clinical.*` capability. Non-clinical owners/front desk do
not receive the cockpit or its treatment mutation callbacks. Financial
content is separately gated by `finance.management.read`.

## Read model and tenant safety

`src/lib/patientCockpitModel.js` is a pure read model over the arrays already
loaded through the app's RLS-scoped persistence layer.

Defense in depth is fail-closed:

- the current `studioId` must be present;
- each source row must carry a tenant ID;
- row tenant and current tenant must match;
- patient IDs must match.

Tenantless and cross-tenant rows are excluded. There is no tenant fallback.

The model derives treatment counts, grouped treatments, appointments,
incomplete metadata, and a timeline. It does not write or call Supabase.

## Clinical Map

The map uses one generic frontend context:

```js
{ type: 'tooth' | 'face_region' | 'body_region', value, label }
```

This context is ephemeral unless an existing canonical form persists its
supported field. No schema was added.

### Odontogram

The shipped `Odontogramma.jsx` remains the tooth selector and now supports:

- treatment status by tooth;
- accessible `aria-label`/`aria-pressed` state;
- single or multi-select;
- a selected-state callback for the cockpit;
- responsive dimensions without horizontal page overflow.

The canonical FDI set remains the POL-AI-005A tooth model's 32 permanent
teeth. Dental mapping is not exposed as a treatment-creation path for
non-dental verticals.

### Treatment grouping and individual state

`groupTreatmentsByArea()` produces one group per anatomical area. Three plan
items on tooth 13 therefore render one `Elemento 13` group containing three
independent rows.

Each row retains its own `eseguita` state. The cockpit delegates a single-row
toggle to the existing `SchedaPaz.toggleEseguita()` reducer, preserving its
date, recall, `incassata`, and plan-level completion behavior. It never marks
an entire tooth complete.

### Multi-select

Selecting teeth 36, 37, and 46 plus one procedure creates a three-row preview.
The `{ procedure, teeth }` draft is forwarded through `SchedaPaz`/`Pazienti`
or the dashboard wrapper into the existing `Piani` modal. `Piani.addVoce()`
remains the sole canonical UI reducer and creates one distinct treatment item
per selected tooth.

### Face and Body maps

Face and Body maps provide generic selectable regions only. They do not
encode treatment recommendations, prices, clinical dependencies, or
persistence. Body supports front/back region sets. Non-dental verticals
start on the body map and do not expose the dental creation handoff.

## Poliedron patient context

There is still exactly one Poliedron instance, mounted by `App.jsx`.

`patientChatContext.js` defines the session-only context contract and the
event used by the cockpit to open that singleton:

```js
{
  source: 'patient_cockpit',
  patient: { id, nome, cognome, studio_id },
  anatomicalContext,
  inputSource: 'TEXT' | 'VOICE_TRANSCRIPT'
}
```

Only the minimum patient reference is forwarded; contact and other patient
fields are not copied into the chat context.

`contextEngine.js` now accepts the anatomical and input-source hints.
`Poliedron.jsx` keeps session-only conversation messages per contextual
patient and clears the active patient override when the panel closes, so a
stale patient cannot leak into a later global command.

## POL-AI-005A preview

`contextualActionPlanner.js` recognizes the bounded contextual form:

`Segna <prestazione> [dente] come eseguita`

When the patient or tooth is omitted, it may use only the patient page and
selected tooth as explicit UI hints. It then calls the existing
`parseCommand()` and `buildActionPlan()` functions with already-loaded,
tenant-scoped sources and existing home permissions.

`PoliedronPlannerPreview.jsx` renders the resulting steps, warnings,
assumptions, and blocked state. It does not expose a confirm/execute button
and never calls `executeActionPlan()`.

## Data Health

The cockpit identifies persisted dental plan items whose tooth or price is
structurally missing. It does not turn generic form validation into Data
Health and does not fabricate a percentage.

There is currently no canonical patient-level Data Health score. Therefore
the fourth KPI shows `Non disponibile`, while individual evidence-based
issues remain actionable through the existing plan editor.

Non-dental treatments without an FDI tooth are not classified as incomplete
dental data.

## Financial summary

There is no authoritative canonical per-patient financial contract in the
repository. `get_financial_snapshot_v1` is studio aggregate; the legacy local
patient balance counts suspended payments and cannot truthfully power an
`Incassato` KPI.

POL-UI-014 therefore fails closed:

- financial content is hidden without `finance.management.read`;
- authorized users see `Non disponibile` plus a link to the existing payment
  detail page;
- no frontend financial formula is duplicated.

`PRODUCT_OWNER_DECISION_REQUIRED`: a future patient financial summary needs
an authoritative server-side per-patient contract before numeric cockpit
values can be enabled.

## Timeline, notes, documents, and agenda

The timeline is derived in memory from existing treatments, appointments,
payments, and patient annotations. It creates no event rows. Payment entries
and amounts are excluded without financial permission.

Notes, documents, payments, and appointments link back to their existing
patient tabs/forms. The next appointment uses the already-loaded agenda data
and never invents availability or clinical context.

## Future voice integration

Voice is not implemented. `POLIEDRON_INPUT_SOURCE` reserves `TEXT` and
`VOICE_TRANSCRIPT`; both feed the same future Poliedron processing pipeline.
No microphone, browser speech API, media recorder, storage, or transcription
service is present in POL-UI-014.

## Responsive behavior and QA

The cockpit has explicit desktop/tablet/mobile adaptations, a 375px rule,
44px primary touch targets, progressive disclosure through the treatment
detail drawer, and a hard `overflow-x: hidden` boundary.

PHI-free local browser QA rendered the real React component with synthetic
patient/plan/appointment fixtures:

- light and dark theme at 1280px;
- exact document `scrollWidth === clientWidth` in both themes;
- one tooth group for three tooth-13 treatments;
- individual treatment states;
- incomplete dental metadata;
- three-tooth selection preview (`36`, `37`, `46`) producing three entries.

The 375/390/430/768/1024/1440 contracts are covered structurally by CSS and
Node regressions. The shared browser canvas cannot resize its fixed viewport,
so pixel screenshots at every requested width remain a manual Product Owner
review step in the draft PR.

## Validation

- `npm test`: 310/310 passing.
- `npm run build`: passing; only pre-existing PDF eval, token-comment CSS,
  and chunk-size warnings.
- `git diff --check`: clean.
- No new dependency.
- No database or deployment change.

## Rollback

Revert the POL-UI-014 commits. No data, schema, RLS, deployment, or remote
rollback is required.

## Future phases

- Authoritative patient-level financial RPC/selector.
- POL-AI-005B confirmation, atomic execution, and readback verification.
- Persisted/canonical patient Data Health score.
- POL-AI-006 Voice Clinical Capture feeding `VOICE_TRANSCRIPT`.
- Persisted face/body anatomical context only after an explicit schema and
  Product Owner decision.
