# Current task — PATIENT-ONE-CLICK, PR260 (2026-11-01)
- OWNER Codex; branch codex/patient-one-click; same open/unmerged PR260, prior remotee382fe961.
- AUTHORIZATION: PO requests direct patient entry, compact odontogram/PDF scope, stronger patient record graphics; explicitly accepts Save below keyboard when page scrolls.
- COMPLETED: static Save/total footer inside the main editor scroller; no keyboard-lifted action bar. Full legacy mobile record scroll including identity/KPIs; desktop sidebar retained. New toolbar/initials/name hierarchy, higher contrast, outlined contacts, one divided KPI strip and quiet secondary grid; coherent V2 palette. Existing compact odontogram, list suggestions, confirmed-plan PDF scope and persistence safeguards retained.
- VALIDATION:1508/1508 Node tests; Studio build. CUA synthetic mobile page0→566; simulated keyboard340/offset35 editor0→611 brings Save323..367 within375 bottom; saves85 successfully. Legacy/V2 widths375/768/1024/1440 no overflow. Physical Android keyboard/touch/download/share unverified. Temporary screenshot board/host override removed.
- DATABASE/PRODUCTION: none; no schema/RLS/capability/tenancy/financial changes. Stable refs untouched.
- STATUS WAITING_PRODUCT_OWNER after same-PR update/exact-head checks; explicit new Mergia per AGENTS.md before merge; no manual deployment.
- ROLLBACK revert PR260, preserve plan rows/checkpoints.
