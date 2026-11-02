# Current task — PERSONAL-PRO-RESTYLING (2026-11-02)
- OWNER Codex; branch codex/personal-pro-restyling from master 6c00c026.
- AUTHORIZATION: PO requests professional graphic/UI restyling and organization of Poliedron Personal.
- SCOPE: Personal shell, five-item navigation, organized Altro, Home hierarchy, consistent visual system and sign-in branding. Studio/data/auth/financial logic excluded.
- CHECKPOINT: immutable stable/2026-08-27-full-recovery remains 070b28fd4eae4e2cc397584201d0bb149468fae7. Current master retained as implementation base.
- STATUS WAITING_PRODUCT_OWNER; implementation/verification complete, dedicated PR pending. No merge or manual deployment. Previous PR260 is merged in current master.
- VALIDATION 1518/1518 Node tests; combined and standalone Personal builds pass; CUA synthetic375/768/1024/1440 no horizontal overflow, search/back/menu/chat/diary/agenda verified. Physical Android IME/touch not verified.
- NEXT publish dedicated PR, inspect exact-head checks; explicit Mergia required before merge under AGENTS.md.
- ROLLBACK revert dedicated PR; no database changes.
