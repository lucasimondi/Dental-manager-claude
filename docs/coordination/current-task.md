# Current task — PATIENT-ONE-CLICK, PR260 (2026-11-01)
- OWNER Codex; branch codex/patient-one-click; same PR260, prior remote6a16302e.
- AUTHORIZATION: PO requests odontogram in first patient page, performed cures visible, same chart for very fast treatment and quote entry.
- COMPLETED: clinical-first legacy/real V2 dental landing before administrative KPIs;32 permanent-tooth chart with canonical completed/pending markers and performed history; mode Prestazione/Preventivo + single tooth tap seeds existing editor; Senza dente supports general care. Compact seeded editor collapses secondary tooth selection, keeps Save in flow. Existing canonical persistence/PDF and other verticals/actions retained.
- VALIDATION:1511/1511 Node tests; Studio build and diff check. CUA synthetic31 treatment100 saves as proposal without changing3completed;41 quote100 saves/PDF;V2 seed46; legacy/V2 widths375/768/1024/1440 no overflow. Compact375×760 content687/client687 with Save bottom745; secondary tooth expand/collapse and save pass.
- LIMITS: permanent dentition chart only; free-form/deciduous sites remain in history. No inferred ranges/healthy state or execution. Physical Android touch/IME/download/share unverified.
- DATABASE/PRODUCTION: none; no schema/RLS/capability/tenancy/financial changes. Stable refs immutable. Temporary board/host override removed.
- STATUS WAITING_PRODUCT_OWNER after same-PR update and exact-head check inspection; explicit new Mergia per AGENTS.md before merge; no manual deployment.
- ROLLBACK revert PR260, retain saved plan rows and immutable checkpoints.
