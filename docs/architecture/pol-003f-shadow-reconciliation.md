# POL-003F shadow reconciliation

The versioned reconciliation query is aggregate-only and starts a read-only transaction. Parameters are tenant ID and period. It compares verified legacy calculations with canonical adapter rows for fixed expenses, personnel, total fixed operating costs, variable costs and available hours.

Exact metrics must return `MATCH`. Machinery depreciation and confirmed appointments are reported as `SEMANTIC_EXPECTED_NOT_ADAPTED`, because Product Owner semantics explicitly exclude the former and prohibit treating the latter as worked hours. Worked hours remain unavailable until an authoritative clinical-work event source exists.

The local fixture contains synthetic records for two tenants. Production reconciliation, if later authorized, must remain read-only, export aggregates only, and must not invoke the adapter or perform a backfill.
