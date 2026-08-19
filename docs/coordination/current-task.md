# Current task

- TASK: POL-003F
- TITLE: Canonical Costs & Hours
- OWNER: CODEX
- BRANCH: `finance/POL-003F-canonical-costs-hours`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Extend the POL-003 canonical financial engine with authoritative cost and capacity-hour inputs so BASE management control can calculate margins, EBITDA, break-even and structure hourly cost without reintroducing legacy formulas.

## Product Owner semantics locked

1. There is one canonical financial engine. Do not add client-side financial formulas.
2. Legacy `spese.tipo_costo='fisso'` maps to canonical fixed operating cost only when the source row is otherwise valid for the period.
3. Legacy `spese.tipo_costo='variabile'` maps to canonical attributable variable cost only when the source row is otherwise valid for the period.
4. Preserve recurrence semantics from `spesa_contributo_periodo`: start date, optional end date, frequency and period overlap must be respected. Do not multiply recurring costs naively.
5. Current `personale.costo_mensile` MUST NOT reconstruct prior months. Personnel cost is canonical only when an explicit authoritative monthly version exists; missing periods remain unavailable.
6. `macchinari` amortization MUST NOT enter canonical EBITDA or structure hourly cost in POL-003F. Depreciation/amortization remains excluded by the Product Owner semantics lock. Equipment leasing may only enter through an explicit operating expense source, not inferred from `macchinari.costo_acquisto`.
7. `studio_info.config_orario` is authoritative only for productive capacity: `giorni_settimana * ore_al_giorno * num_postazioni`. Use the existing 4.33 weeks/month convention for month-normalized capacity where needed, and make period semantics deterministic/documented.
8. Appointments with legacy `stato='confermato'` are NOT authoritative proof of hours actually worked. Do not backfill `ORE_EFFETTIVE` from confirmed appointments. Effective hours remain unavailable until an authoritative completed/worked signal exists or the user records them explicitly.
9. Therefore POL-003F may make `costo_orario_struttura` available from structure costs / available hours, while `produzione_ora` and `incasso_ora` remain unavailable if `ORE_EFFETTIVE=0`.
10. Missing/ambiguous sources fail closed and are reported, never guessed.

## Verified production evidence (aggregate-only, read-only)

For the current populated studio:
- `config_orario`: 8 hours/day, 5 days/week, 1 productive station.
- `spese`: 3 recurring fixed monthly rows totalling EUR 710; 4 non-recurring variable rows totalling EUR 256; 1 recurring variable monthly row totalling EUR 950.
- Fixed categories currently include Affitto EUR 400, Attrezzature EUR 150, Utenze EUR 160.
- Variable categories currently include Materiali and Attrezzature.
- Current-year appointments expose only legacy status `confermato`; this is insufficient to infer hours actually worked.

These aggregates are evidence for adapter/reconciliation only. Do not hardcode them into migrations or tests.

## Required work

1. Read AGENTS.md, CLAUDE.md, POL-003A/B/C/D/E docs, current canonical migration, `spesa_contributo_periodo`, and existing legacy cost/hour functions.
2. Inventory `spese`, `personale`, `macchinari`, `studio_info.config_orario`, `financial_cost_events_v1`, `financial_hours_v1` and the COST/HOUR branches of `get_financial_drilldown_v1` / `get_financial_snapshot_v1`.
3. Implement a restricted, idempotent, tenant-scoped legacy adapter for authoritative costs and available hours only. Installation MUST NOT execute it.
4. Keep `macchinari` depreciation blocked and report it in reconciliation rather than importing it.
5. Keep effective worked hours blocked; do not infer them from `appointments.stato='confermato'`.
6. Define stable source IDs so re-running the adapter produces no duplicates.
7. Add synthetic tests for: one-off fixed cost, recurring fixed cost, recurring end date, variable cost, active personnel, personnel start date, excluded machinery depreciation, available hours, zero/invalid hour config fail-closed, two tenants, idempotency and period boundaries.
8. Verify canonical snapshot calculations for fixed costs, variable costs, contribution margin, EBITDA, break-even and structure hourly cost. Verify production/hour and collection/hour remain NULL/unavailable when effective hours are absent.
9. Produce aggregate-only shadow reconciliation for production sources. No names, notes, documents or patient data.
10. Run PostgreSQL 17/local Supabase regression, POL-003A/D regressions, database lint/advisors, npm test, npm run build, secret scan and diff check.
11. Do not apply migration remotely, run production adapter/backfill, modify production data, deploy, activate Advanced, or merge.
12. Push the branch/PR and finish `WAITING_PRODUCT_OWNER` with exact compatible aggregate targets and blocked-source counts.

## Production state

- POL-003 through POL-003D are installed.
- Canonical legacy financial backfill currently contains verified Preventivato EUR 6,954, Prodotto EUR 2,181 and Incassato EUR 5,102.
- POL-003E BASE canonical overview is deployed on Vercel.
- Cost and hour canonical event tables are not yet backfilled from legacy sources.

## Completion gate

No remote cost/hour backfill is authorized by this task. Product Owner must review the local reconciliation and approve a separate controlled production execution.

## Completion state

Corrective work is complete locally: append-only effective-dated personnel cost versions replace current-cost historical projection; unknown historical periods fail closed; historical canonical events and KPIs remain immutable when the legacy current cost changes. All requested local regressions and repository checks passed. Production remains untouched and no remote migration, adapter, backfill, deploy or merge was performed.
