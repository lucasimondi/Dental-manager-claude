# Current task — PATIENT-ONE-CLICK, PR260 (2026-11-01)
- OWNER Codex; branch codex/patient-one-click; same PR260, prior remotec1833e74.
- AUTHORIZATION: latest PO correction requires true quadrants on mobile/desktop. PO requests odontogram in first patient page, performed cures visible, same chart for very fast treatment and quote entry.
- COMPLETED: explicit bordered two-by-two Q1/Q2 above and Q4/Q3 below on all widths; mobile four columns/two tooth rows inside each quadrant, matching compact-selector Q labels and patient-side orientation. clinical-first legacy/real V2 dental landing before administrative KPIs;32 permanent-tooth chart with canonical completed/pending markers and performed history; mode Prestazione/Preventivo + single tooth tap seeds existing editor; Senza dente supports general care. Compact seeded editor collapses secondary tooth selection, keeps Save in flow. Existing canonical persistence/PDF and other verticals/actions retained.
- VALIDATION: latest7/7 targeted dental/PDF checks; Studio build; browser375px two-by-two + seed36,768/1024/1440 two columns/no overflow. Prior full suite:1511/1511 Node tests; Studio build and diff check. CUA synthetic31 treatment100 saves as proposal without changing3completed;41 quote100 saves/PDF;V2 seed46; legacy/V2 widths375/768/1024/1440 no overflow. Compact375×760 content687/client687 with Save bottom745; secondary tooth expand/collapse and save pass.
- LIMITS: permanent dentition chart only; free-form/deciduous sites remain in history. No inferred ranges/healthy state or execution. Physical Android touch/IME/download/share unverified.
- DATABASE/PRODUCTION: none; no schema/RLS/capability/tenancy/financial changes. Stable refs immutable. Temporary board/host override removed.
- STATUS WAITING_PRODUCT_OWNER after same-PR update and exact-head check inspection; explicit new Mergia per AGENTS.md before merge; no manual deployment.
- ROLLBACK revert PR260, retain saved plan rows and immutable checkpoints.

- MERGE IN_PROGRESS: PO authorized Mergia for PR260. Integrating master4ecdea035 after PR261/262; preserve all Personal code and coordination handoffs. Revalidate exact integrated tree before merge.
