# POL-003F adapter implementation

`private.run_pol_003f_costs_hours_adapter_v1` is a versioned, idempotent, `SECURITY INVOKER` adapter. The migration installs it but never executes it. Execution is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`; any future production run requires a separate Product Owner gate and controlled database role.

The adapter writes only existing canonical event tables. Expenses create monthly or one-off cost events; personnel events are created exclusively from explicit append-only `financial_personnel_cost_versions_v1` rows; valid scheduling configuration creates monthly available-capacity events. Stable `(studio_id, source_table, source_id)` uniqueness prevents duplicate events. It reports inserted, skipped and deliberately blocked source counts. `personnel_skipped` is the number of active collaborator-months in the requested period for which no authoritative version exists.

It never reads current `personale.costo_mensile` to reconstruct history. A version is valid from its month until the next version; missing earlier months stay unavailable. Canonical rows reference the exact version ID, and later current-cost changes cannot update or replace existing events. It also does not import machinery depreciation, infer worked hours, invent missing end dates, or default malformed source values.

The corrective migration is reversible before execution by restoring the prior adapter definition and dropping the append-only version table/functions. After an authorized execution, reversal must delete only exact `financial_personnel_cost_versions_v1` provenance rows under an approved runbook.
