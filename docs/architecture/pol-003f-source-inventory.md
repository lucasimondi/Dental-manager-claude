# POL-003F source inventory

This inventory records only verified legacy sources. It does not authorize production execution.

| Source | Verified fields | Canonical mapping | Boundary |
|---|---|---|---|
| `spese` | `id`, `studio_id`, `importo`, `data`, `data_fine`, `ricorrente`, `frequenza`, `tipo_costo` | fixed or attributable-variable `SOSTENUTO` events | unknown frequency/type fails closed |
| `personale` | `id`, `studio_id`, current `costo_mensile`, `attivo`, `data_inizio` | identity/current-state evidence only; never historical cost | present value cannot rewrite prior periods |
| `financial_personnel_cost_versions_v1` | `studio_id`, `personnel_id`, `valid_from`, `monthly_cost`, `authority_ref` | authoritative append-only monthly fixed operating cost | no row means the month is not reconstructible |
| `studio_info` | `studio_id`, `config_orario` | monthly `AVAILABLE` structure hours | invalid/zero configuration fails closed |
| `macchinari` | active rows | none | depreciation is excluded from management EBITDA |
| `appointments` | `studio_id`, `data`, `stato` | none | confirmed is not evidence of worked hours |

Recurring expense semantics preserve the verified calendar-month contribution rule. Capacity uses days/week × hours/day × stations × 4.33. Canonical rows carry tenant, source table and stable source ID for deterministic drill-down.

Personnel cost versions start on the first day of a month and remain valid until the next version for the same collaborator. The table is append-only: a change from EUR 1,500 to EUR 1,800 is a new `valid_from`, not an update to history. `personale.costo_mensile` is intentionally excluded from historical ingestion.
