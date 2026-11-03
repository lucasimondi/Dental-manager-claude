# Current task — PREVENTIVI-RAPIDI (2026-11-03)
- OWNER Codex; branch codex/preventivi-rapidi from master cab3206a.
- AUTHORIZATION PO approved one-screen quotes, direct PDF/JPG file delivery and dedicated persistent quote archive with "Vai".
- SCOPE patient/agenda quote composer, file-only sharing, immutable document snapshots and Preventivi section; retain canonical plans/financial formulas.
- CHECKPOINT stable/2026-08-27-full-recovery at070b28fd4eae4e2cc397584201d0bb149468fae7 preserved.
- STATUS WAITING_PRODUCT_OWNER. Implementation and local verification complete; dedicated PR before task-specific Mergia, no manual production deploy.
- DATABASE new migration with tenant RLS; production metadata inspection only, no patient reads or writes. Remote application reserved for controlled release.
- VALIDATION1528/1528 Node tests incl isolated two-tenant SQL, Studio/Personal builds, startup and diff check pass. Synthetic PDF/JPG shares and immutable revision verified;375/768/1024/1440 no horizontal overflow. Physical phone/native WhatsApp unverified. ROLLBACK revert UI; retain document records.
