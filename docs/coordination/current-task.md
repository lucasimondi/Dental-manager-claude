# Current task — APPOINTMENT-PATIENT-CARD (2026-10-22)
- OWNER: Codex; branch codex/appointment-patient-card from latest master.
- PO: redesign appointment popup as a patient card, obvious edit/WhatsApp, direct treatment/payment fields and quote access.
- STATUS: implementation complete; browser validation blocked locally by unavailable Playwright browser download; draft PR pending CI.
- SCOPE: persistent primary action toolbar, section shortcuts, open payment fields, responsive two-column desktop/fullscreen mobile patient card. Existing save and communication handlers reused.
- VALIDATION: 1437/1437 Node tests; Studio and Personal production builds pass; diff check clean. Browser suite updated for visible primary actions/open incasso/quote shortcut. Local browser run blocked before launch: Chromium archive download returns invalid ZIP. No visual pass claimed.
- DATABASE: no migrations, finance semantics, authorization or tenancy changes.
- RELEASE: draft PR; browser CI and screenshot review before ready; explicit PO Mergia required.
- ROLLBACK: revert dedicated PR; stable checkpoint unchanged.
