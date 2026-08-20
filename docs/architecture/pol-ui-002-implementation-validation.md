# POL-UI-002 — Implementation and local validation

Status: `WAITING_PRODUCT_OWNER`

## Implemented contract

The Home registry now includes first-class canonical widgets for lifecycle, cash, costs, margins, break-even and hours. Their selector reads fields verbatim from `get_financial_snapshot_v1`; it neither derives values nor queries a legacy table or RPC. Missing source fields, canonical errors and unavailable worked-hour denominators render `Non disponibile`.

All visible canonical widgets share one Home period: current month, previous month or current year. One snapshot request supplies the visible pack for that period. The request is skipped when no canonical financial widget is visible or when the active membership and management-control capability do not authorize it.

The catalog is filtered before customization and rendering. Resolution order is personal override, studio default, role/vertical preset, then platform default. A role change cannot replace an existing personal or studio layout. Presets only seed visibility/order; they never alter data or formulas.

The current authoritative membership vocabulary has only `admin` and generic `utente`. Consequently, `admin` maps to Titolare; a non-admin dental user maps to Segreteria; a non-admin physiotherapy vertical maps to Clinico/Fisio. A richer role assignment is not invented here.

The prior ad-hoc Home queries of `physio_obiettivi`, `physio_diario_sedute` and `physio_prescrizioni` were removed. The Fisio registry contract is fail closed until stable POL-FIS-001 selectors are available.

## Local evidence

- Node: `npm test` — 20/20 passed, including canonical-only source, no fallback, period propagation, all presets, inheritance order, role-change preservation, unauthorized zero-call behavior, two-tenant permission evaluation, unavailable states, four responsive widths and POL-UI-001 regressions.
- Database: applied the two unchanged POL-UI-001 layout migrations to an ephemeral `public.ecr.aws/supabase/postgres:17.6.1.159` container with only synthetic data; the full layout RLS regression passed for user/studio separation, two tenants, non-admin and suspended membership.
- Supabase CLI: `supabase db lint --level warning` against the loopback-only disposable database — no schema errors.
- Build: Vite production build passed from a temporary Linux directory using the committed lockfile. Existing pdfjs eval and large-chunk warnings remain.
- Hygiene: `git diff --check`, targeted credential scan, changed-file and deployment scope checks passed. No migration, production configuration or deployment file changed.

## Production boundary

Nothing was applied to production or any remote Supabase project. No backfill, deployment or merge was performed.
