# POL-AI-004 — Poliedron Proactive Intelligence

Status: `WAITING_PRODUCT_OWNER` after implementation and validation.

## Mission alignment

This layer implements the direction in
[`docs/mission/POLIEDRA_MISSION.md`](../mission/POLIEDRA_MISSION.md):
canonical Poliedra data first, deterministic scanners second, transparent
priority and confidence third, Poliedron presentation fourth, and a language
model only where language interpretation adds value.

The scanner is strictly **READ + RECOMMEND**. It does not contact patients,
book appointments, send WhatsApp messages, change treatment state, complete
records, or perform any other write. Existing explicit actions and
confirmation rules remain the only execution path.

## Audited canonical sources

POL-AI-004 adds no data-access system. `App.jsx` already loads the studio's
core arrays through the shared `DB.getAll` adapter and passes snapshots into
Poliedron.

| Domain | Existing source and repository evidence | Fields used | Conservative semantic lock |
|---|---|---|---|
| Patients | `App.jsx` state and `DB.getAll('dm_p')`; `supabase.js` maps to `patients` | `id`, `studio_id`, `nome`, `cognome` | Name and surname are the only required patient form fields (`Pazienti.jsx`). Optional contact/demographic fields never affect Data Health. |
| Plans | `DB.getAll('dm_pl')` → `plans`; `Piani.jsx` | `id`, `studio_id`, `pazienteId`, `stato`, `titolo`, `data`, `voci` | Repository UI uses `accettato` for accepted care and `attivo` for a quote waiting for response. Therefore only `accettato`/explicit in-progress equivalents produce unfinished-treatment evidence; stale `attivo` plans produce a lower administrative follow-up. |
| Performances | JSON `plans.voci` managed by `Piani.jsx`/`SchedaPaz.jsx` | `prestazione`, `eseguita`, `dataEsec`, `richiamoData`, `richiamoTipo` | Only literal boolean `false` is reliably unexecuted. Missing/non-boolean `eseguita` is Data Quality and never unfinished treatment. |
| Appointments | `DB.getAll('dm_a')` → `appointments`; `Agenda.jsx` | `id`, `studio_id`, `pazienteId`, `data`, `ora`, `tipo`, `stato` | Future means `data >= today`; cancelled values are excluded. A recall is covered using the existing Richiami ±20-day matching rule. No appointment is supporting evidence only. |
| Recalls | `DB.getAll('dm_ri')` → `richiami`; `Richiami.jsx`/`richiamiBot.js` | `id`, `studio_id`, `pazienteId`, `categoria`, `motivo`, `dataScadenza`, `stato` | Only `stato='da_fare'` is open. Overdue, due within 30 days, and later open recalls are distinct. A covering appointment suppresses the need. Financial recall text requires the existing management permission. |
| Prevention/hygiene | Executed plan voices and their generated/configured `richiamoData`; `SchedaPaz.jsx`, `Listino.jsx`, `utils.js` | same performance fields | An overdue prevention claim requires a recorded execution date and a recorded due date. If either is missing, the result is Data Quality; no interval is fabricated. Current reliable matching is dental hygiene only. |
| Activities | Existing `impegni` snapshot passed by `App.jsx`; scanner also accepts the same task-shaped contract | `id`, `studio_id`, explicit patient id if present, `testo`/`titolo`/`note`, `stato`/`fatto` | Explicit patient relation wins. Name-only association requires one unique patient with an exact normalized full-name occurrence. Duplicate names and multiple matches are rejected. |

All source rows are filtered again by exact `studio_id` before indexing. Missing
tenant identity fails closed. Database RLS remains authoritative; this
defence-in-depth filter does not broaden access.

## Architecture

`src/lib/poliedron/intelligence/` contains small pure modules:

- `model.js`: frozen taxonomy, signal types, source/reason contract and tenant
  helpers;
- `appointmentScanner.js`: one future/all appointment index;
- `treatmentPlanScanner.js`, `recallScanner.js`, `hygieneScanner.js` and
  `activityScanner.js`: domain facts;
- `dataCompletenessScanner.js`: required workflow-state checks only;
- `scoringEngine.js`: transparent priority and confidence;
- `studioDataHealth.js`: non-clinical aggregate;
- `patientOpportunityScanner.js`: tenant filtering, indexes, orchestration,
  de-duplication, ordering and grouping;
- `intelligenceCache.js`: bounded in-memory cache;
- `queryRouter.js`: deterministic semantic intent routing.

The structured result is provider-independent and suitable for future
Poliedron-native model input:

```js
{
  patientId,
  patientName,
  score,
  confidence,
  contactRecommended,
  signals: [{
    type,
    taxonomy,
    severity,
    reason,
    source,
    sourceId,
    confidence,
    context
  }]
}
```

Every returned patient has at least one human-readable reason. `sourceId` is
present wherever the canonical source has an id.

## Taxonomy and implemented signals

- `OPPORTUNITY`: reliably unexecuted accepted-plan performances.
- `FOLLOW_UP`: uncovered recalls, appointment-continuation gap, open
  patient-linked activity.
- `ADMINISTRATIVE`: stale quote waiting for response and permitted financial
  recalls.
- `PREVENTION`: configured hygiene/prevention due date is past and no suitable
  appointment covers it.
- `DATA_QUALITY`: no plan (explicitly uncertain), missing plan status, empty
  accepted plan, missing/ambiguous execution status, or unreliable prevention
  configuration.

The scanner never emits `NO_FUTURE_APPOINTMENT` alone. It is added only beside
reliable unfinished care. Recall and prevention scanners similarly suppress
their need when an existing appointment covers it.

## Priority scoring

Priority is additive, deterministic, capped at 100, and independent from data
confidence.

| Signal | Weight |
|---|---:|
| Accepted plan with reliably unexecuted performances | 45 |
| Supporting absence of future continuation | 20 |
| Overdue recall | 40 |
| Recall due within 30 days | 30 |
| Later open recall | 18 |
| Configured prevention/hygiene overdue | 35 |
| Open linked activity | 24 |
| Quote in repository-defined waiting state for 14+ days, no future appointment | 18 |
| Patient without plan | 10 |
| Missing execution status | 14 |
| Missing plan status | 12 |
| Accepted plan without performances | 12 |
| Prevention configuration incomplete | 8 |

Reasons remain visible; score never replaces evidence. A plan with a future
appointment retains the unfinished-care fact but loses the 20-point
continuation-gap support and is not placed in `DA CONTATTARE`.

## Confidence

Each signal declares evidence confidence. Patient confidence is the
priority-weighted mean of those values minus explicit missing-data penalties,
clamped to `0.10–1.00`. Missing execution/plan/prevention workflow state
therefore lowers confidence without changing a verified fact into a
speculative conclusion.

Examples:

- accepted plan + boolean `false`: `0.95`;
- canonical recall: `0.95`;
- explicit activity patient id: `0.98`;
- unique exact full-name activity: `0.72`;
- no plan: `0.45` plus a `0.20` missing-data penalty;
- ambiguous execution state: `0.50` plus a bounded per-item penalty.

## Studio Data Health

`Studio Data Health` is explicitly an operational, non-clinical score. It is
shown as `Non disponibile` rather than `100` when tenant identity, permission,
or evaluable clinical workflow scope is absent. When available, it
evaluates only repository-required workflow states:

- plan presence;
- plan status;
- performance execution status;
- accepted-plan performance presence;
- verifiable prevention execution/due dates when hygiene history exists.

Optional patient contact, address, demographic, notes, discounts and similar
fields do not reduce the score.

The denominator is:

`patients + plans + plan performances`

The score is:

`round(100 × (1 - min(1, issueCount / evaluatedWorkflowStates)))`

The aggregate includes deterministic issue counts and mission-aligned wording
that explains how completing useful data improves future suggestions.

## Permissions

No new authorization model exists. `Poliedron.jsx` derives scanner visibility
from the same active membership and capability object already produced by
`buildHomePermissions`:

- inactive or missing membership: no scan results;
- active membership: patient, appointment, recall and activity operations;
- `home.owner`, `home.front_desk`, `clinical.general` or
  `clinical.physiotherapist`: tenant-wide operational facts;
- `clinical.general` or `clinical.physiotherapist`: plans, execution state and
  prevention facts;
- `managementControl`: financial recall details.

The browser gates are data minimization only. Existing RLS and canonical
queries remain authoritative. An owner without a clinical capability does not
receive clinical facts. PT and massage capabilities are assignment-bound, but
the application does not provide Poliedron an authoritative assigned-patient
scope. They therefore fail closed and receive no intelligence facts unless a
separate tenant-wide capability permits the non-clinical subset; they never
receive plan facts from PT/massage capability alone.

## Cache and token usage

Scanning performs **zero Model Gateway calls** and reports `tokenUsage: 0`.
`processQuery` routes proactive-intelligence intents before model fallback,
even on explicit submit.

The cache is:

- in memory only;
- bounded to eight least-recently-used entries;
- five-minute TTL;
- keyed by exact studio id, scanner version, date, vertical, permission
  fingerprint and relevant source fingerprint;
- never persisted to `localStorage`, session storage or the database.

Relevant record ids, tenant ids, status/date fields, performance state,
reasons and update versions feed the fingerprint. A changed relevant fact
therefore invalidates the entry. No polling was added. A future persistent or
incremental cache requires a separately approved server-side design and is
not part of this no-schema phase.

## Poliedron integration

The deterministic router recognizes semantic families rather than one exact
sentence: appointment candidates, callbacks, at-risk/lost patients,
unfinished care, no next appointment, incomplete records and Studio Data
Health.

The existing panel/docks/orb are unchanged. A result renderer inside the
approved panel shows:

- `DA CONTATTARE`;
- `DATI DA COMPLETARE`;
- patient priority and confidence;
- patient-level reasons;
- `Apri paziente`, which reuses the existing patient-navigation callback;
- the non-clinical Studio Data Health card.

No result action writes data.

## Complexity and performance

Tenant filtering, plan/recall/activity grouping and appointment indexing are
single passes. Each patient then reads only its indexed records.

- indexing and scanning: `O(P + L + A + R + T + V)`;
- deterministic result ordering: `O(K log K)`;
- memory: `O(P + L + A + R + T + K)`.

`P` patients, `L` plans, `A` appointments, `R` recalls, `T` activities, `V`
performances, and `K` returned patients. Name-only activity resolution uses a
first-token index and does not scan every patient for every activity. The
synthetic regression includes 5,000 patients/plans and name-linked activities
to expose an obvious quadratic implementation.

## Limitations and future extensions

- Current plan storage is a frontend-loaded JSON contract. The scanner
  conservatively follows its observed status meanings; it does not invent an
  acceptance audit trail.
- Current `impegni_personali` creation UI has no explicit patient relation.
  Ordinary calendar commitments are not considered open tasks. The adapter is
  ready for an explicit patient relation and requires an explicit open/task
  state; name-only association then additionally requires unique exact
  full-name evidence. A future canonical patient-task relationship would
  increase confidence.
- Assignment-bound PT/massage intelligence remains fail closed until the
  authoritative patient-assignment scope is available to Poliedron. It is not
  inferred from the tenant patient list.
- Prevention is emitted only from recorded execution and configured due dates;
  unsupported verticals receive no fabricated clinical interval.
- The current cache is per browser process. A robust shared/incremental cache
  is a future server-side option.
- Future low-risk scanners can use the same contract for confirmed follow-up
  workflows, documents requiring action, or vertical-specific periodic care
  once canonical relationships and explicit configuration exist.
- The structured, explainable facts can feed a future native Poliedron model
  for language/summarization without coupling discovery to Claude or another
  provider.

No Product Owner decision is required for this implementation. No database,
Supabase schema, migration, RLS, RBAC, auth, financial formula, production
data or deployment change was made.
