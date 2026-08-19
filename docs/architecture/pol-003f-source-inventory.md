# POL-003F source inventory

This inventory records only verified legacy sources. It does not authorize production execution.

| Source | Verified fields | Canonical mapping | Boundary |
|---|---|---|---|
| `spese` | `id`, `studio_id`, `importo`, `data`, `data_fine`, `ricorrente`, `frequenza`, `tipo_costo` | fixed or attributable-variable `SOSTENUTO` events | unknown frequency/type fails closed |
| `personale` | `id`, `studio_id`, `costo_mensile`, `attivo`, `data_inizio` | active monthly fixed operating cost | no termination date is invented |
| `studio_info` | `studio_id`, `config_orario` | monthly `AVAILABLE` structure hours | invalid/zero configuration fails closed |
| `macchinari` | active rows | none | depreciation is excluded from management EBITDA |
| `appointments` | `studio_id`, `data`, `stato` | none | confirmed is not evidence of worked hours |

Recurring expense semantics preserve the verified calendar-month contribution rule. Capacity uses days/week × hours/day × stations × 4.33. Canonical rows carry tenant, source table and stable source ID for deterministic drill-down.
