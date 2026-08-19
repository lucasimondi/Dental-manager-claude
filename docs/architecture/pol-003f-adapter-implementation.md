# POL-003F adapter implementation

`private.run_pol_003f_costs_hours_adapter_v1` is a versioned, idempotent, `SECURITY INVOKER` adapter. The migration installs it but never executes it. Execution is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`; any future production run requires a separate Product Owner gate and controlled database role.

The adapter writes only existing canonical tables. Expenses create monthly or one-off cost events; active personnel create monthly fixed events from `data_inizio`; valid scheduling configuration creates monthly available-capacity events. Stable `(studio_id, source_table, source_id)` uniqueness prevents duplicate events. It reports inserted, skipped and deliberately blocked source counts.

It does not import machinery depreciation, infer worked hours, invent missing end dates, or default malformed source values. Installation is reversible by dropping the two new private functions before any execution. After an authorized execution, reversal must delete only exact provenance rows under an approved runbook.
