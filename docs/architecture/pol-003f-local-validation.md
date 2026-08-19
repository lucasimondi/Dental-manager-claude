# POL-003F local validation

Validation used the Supabase PostgreSQL 17 image `17.6.1.159` in a disposable local container and synthetic data only. The container received the POL-003A, POL-003B, POL-003D and POL-003F migrations; no remote database was changed.

## Results

- POL-003F regression: passed, including one-off/recurring/end-date costs, variable costs, personnel start, two tenants, invalid config, idempotency and period boundaries.
- Canonical snapshot: fixed cost EUR 3,620; variable cost EUR 183.333334; contribution margin EUR 4,816.666666; management EBITDA EUR 1,196.666666; available hours 1,039.2; structure hourly cost reconciled. Worked-hour metrics remained unavailable.
- POL-003D adapter regression and full POL-003A regression: passed unchanged.
- Synthetic shadow: exact matches for fixed expenses EUR 1,000, personnel EUR 2,000, total fixed EUR 3,000, variable EUR 120 and available hours 1,039.2. One machine, one confirmed appointment and zero worked hours were correctly reported as deliberately non-adapted.
- `plpgsql_check`: zero findings. Supabase database lint: no schema errors. Performance advisor: no issues.
- Security advisor: only expected findings from deliberately minimal non-RLS synthetic bootstrap tables and local `plpgsql_check`; the restricted adapter added no exposed table or executable API grant.
- Node tests: 4/4 passed. Vite build: passed with pre-existing warnings. `npm ci` retained 10 pre-existing audit findings (2 moderate, 6 high, 2 critical).
- Diff/secret/scope checks: passed after final verification; no application or deployment file is part of POL-003F.

## Read-only compatible production targets

Aggregate catalog/source observation, performed read-only and without invoking the adapter, produced these comparison targets for the currently populated studio:

| Period | Fixed expenses | Variable expenses | Personnel | Total fixed operating | Available hours |
|---|---:|---:|---:|---:|---:|
| current month | EUR 710 | EUR 950 | EUR 0 | EUR 710 | 173.20 |
| current year through current month | EUR 2,130 | EUR 1,206 | EUR 0 | EUR 2,130 | 1,385.60 |

Expected current-year expense events are 14 (10 recurring monthly contributions and 4 one-off events). Blocked source counts observed are 0 active machinery rows and 65 confirmed appointments; these appointments must not become worked hours. These values are review targets, not hardcoded migration inputs and not authorization for execution.

## Residual risks

Current personnel cost has no termination or cost-version history; current schedule configuration has no effective dating; generic legacy variable classification does not prove patient/service attribution; unknown recurrence values remain skipped; worked hours lack an authoritative source. Production execution and provenance cleanup require a separate approved runbook and PO gate.
