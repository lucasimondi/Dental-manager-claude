# PERSONAL-PRO-RESTYLING — 2026-11-02

PO requests more professional graphics and organization for Poliedron Personal. Existing master baseline 6c00c026; immutable checkpoint stable/2026-08-27-full-recovery at070b28fd4eae4e2cc397584201d0bb149468fae7 retained.

## Navigation and hierarchy
Three registry dock destinations Oggi/Agenda/Documenti plus explicit Assistente and Altro buttons form exactly five columns. All previous section IDs remain in VISTE, so remembered Conti/Legal/Foto/Personali views still open normally. Altro remains active for secondary sections and exposes every secondary destination, grouped into practical life and personal space, with settings. Metadata imports use existing section index boundaries; deferred feature screens remain deferred. No routing framework/dependency introduced.

Header uses existing Poliedron asset and brand-home action; title/settings have consistent spacing and 44px settings target. Redundant diary/library header icons move into Altro and remain in Home cards. Diary retains its own full-screen book and Home command.

Home search opens existing ricerca page and existing archive loader. Existing quick actions and data queries unchanged. Assistant CTA opens the existing persistent chat. Financial/agenda/document priorities precede reading/diary/shopping. Documenti search/filters/tabs precede secondary tools; tools hide while searching without losing their handlers.

## Visual system
`personal/src/pro.css` loads after legacy shared styles, defines tokens and scoped component styles, and retains dark mode. Neutral financial surfaces leave one blue assistant accent. Five dock columns have no horizontal scrolling. Mobile-first content max800px; four summary columns on tablet; reader-specific agenda/chat/diary geometry is excluded from standard padding. No external fonts, animation library or new dependencies. Login reuses the existing brand asset. No changes to database, auth, RLS, financial calculations, Studio or deployment configuration.

## Verification
1518/1518 Node tests, combined Studio/Personal build and standalone Personal build pass. Existing unrelated duplicate-key/pdfjs warnings remain. Existing structural tests updated for navigation contract. React review: no additional effects/data fetches, stable keys, labelled buttons, semantic headings, current-page navigation state, section lazy loading preserved.

CUA browser with temporary synthetic clients and iframe viewports375/768/1024/1440: no horizontal overflow (client/scroll widths360/360,753/753,1009/1009,1425/1425; agenda375/375). Verified compact dock, Altro groups, Home→search→back, Assistente composer above dock, diary full-screen cover and Home, connected empty agenda with synthetic payment, document search/filters before secondary tools. No live records read/written. Fixture and temporary Vite host allowlist removed. Physical Android IME, gestures and offline behavior not verified; browser fixture is not production validation.

Rollback: revert dedicated PR. No persisted data or migrations. Publish through normal Vercel PR/merge flow only, after explicit PO approval per AGENTS.md; no manual deploy.
