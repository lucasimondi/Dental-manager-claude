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

## PO extension — reversible Windows95 theme

The PO liked the Windows95 concept and authorized an immediate toggle back to the modern app. Same unmerged PR263 extended; no merge authority implied. `AspettoProvider` owns only appearance state above App. Header/login `CambioAspetto` toggles directly, settings offers pressed-state choices. Root data attribute controls CSS and original SVG pixel icons; no key/remount or query/write in theme controls. In Home a theme-only navigation group exposes existing document/agenda/diary/library actions. No fake window controls or generated illustration assets ship.

Local key `poliedron-personal-aspetto-v1` persists only `moderno` or `win95`. Unknown/missing values fail back to modern; storage getter/setter failures do not throw. App startup initializes the root marker before rendering, storage events synchronize same-origin tabs, and the provider removes its listener on unmount. Storage is per origin/device and survives logout without retaining identity. No new account/database settings or dependencies. Windows95 intentionally uses a fixed light palette even when system dark; returning Moderno restores the existing light/dark styling. OAuth consent renders outside the theme provider and its document never receives the marker. Diary keeps its full-screen book; original files/PDF contents are not recolored.

Four pure tests verify defaults/unknown values, storage roundtrip and isolation from remembered navigation, blocked storage and reversible root marker. CUA synthetic browser verified Moderno→Windows95→reload→Windows95, settings→Windows95, back to Moderno without losing Documenti search text or unsent chat draft, connected agenda, and no horizontal overflow in iframe viewports320/375/768/1024/1440. Markers/window geometry are browser evidence, not physical Android validation. Temporary fixtures and host exception removed.
