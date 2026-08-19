# POL-003C — Management modes implementation

## Implemented boundary

POL-003C adds a per-studio `management_control_mode` setting with only `base` and `advanced`. Existing rows default to `base`. The mode is presentation state: it does not update financial events, select a different formula version, start a backfill or change any POL-003 metric.

The Setup selector persists through the existing tenant-scoped `studio_info` path. Subscription plan and management mode remain separate.

## Single canonical read path

`canonicalFinancialSelectors.js` is the only prepared client read boundary for the new experience:

1. it calls only `get_financial_snapshot_v1`;
2. it has no legacy table access and no fallback to `get_kpi_periodo` or client arrays;
3. it projects the same returned snapshot through Base or Advanced visibility catalogs;
4. it copies canonical values verbatim and performs no arithmetic;
5. it exposes canonical `formula_version` and `data_quality_status`;
6. it represents missing canonical capability as unavailable instead of guessing.

`CanonicalManagementView.jsx` is a prepared UI consumer of this model. It is intentionally not imported or mounted by `ControlloGestione.jsx`; all live dashboards remain legacy until reconciliation and cutover gates pass.

## Base presentation

Base requests the minimal performance and efficiency surface defined by the approved design. Available POL-003 fields are shown directly. Combined operating costs, distance from break-even, month trend and monthly target progress remain explicitly unavailable because the current snapshot RPC does not expose authoritative fields for them.

## Advanced presentation

Advanced requests the full available POL-003 lifecycle, stocks, billing, cash, costs, margins, EBITDA, break-even and hours surface. Saturation, budget comparison, forecast, trends and attributed profitability remain unavailable until authoritative canonical contracts exist. Drill-down is prepared through the canonical field callback only.

## Persistence and authorization

The migration adds the constrained column to `public.studio_info` and does not replace or weaken its existing RLS policy. Local tests reproduce the verified tenant predicate and prove that a session scoped to studio A cannot read or update studio B. Missing or unknown mode values normalize to `base` in the UI, while the database rejects values outside `base`/`advanced`.

## Rollback

Before deployment, rollback is deletion of the prepared component/selector/test files and removal of the Setup control. After a future authorized migration application, the database rollback is `ALTER TABLE public.studio_info DROP COLUMN management_control_mode`; this loses only presentation preference, never financial data.
