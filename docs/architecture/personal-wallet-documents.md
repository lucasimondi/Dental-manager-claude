# Personal document wallet

Task PERSONAL-WALLET-DOCUMENTS, 2026-11-01. Personal remains the existing web/PWA application and uses its separate archive database and Drive files. Studio, MCP registration, OAuth, tenancy and RLS are unchanged.

## Membership and history

`documentoDaPersonal` rejects ordinary photographs, patient clinical documents and the `documento-personale-storico` tag. Household membership still requires a recognized person and a personal category or explicitly pinned identity document. Mixed-person scans without an explicit person no longer inherit the first matching name. Historical records remain searchable in Documenti and have dedicated per-person archive lists; originals are never deleted by archiving. Restoring removes the historical tag and pins the document again.

The authorized archive cleanup produced separate front/back PDFs from two original mixed scans. Crops were rendered into new page images before PDF assembly so other cards cannot remain hidden inside the shared PDF. No content was generated, reconstructed or corrected. The originals remain in the historical archive. Current identity/fiscal cards and expired health cards have distinct classification; expiration is preserved. Private source scans and derived files are outside git.

## Opening and expiration

Opening a document shows its original preview in a viewport-sized modal. Info opens catalog and validity controls separately. The file viewer contains share, download and original-file actions, without transmission history or payment controls. It traps keyboard focus, makes the underlying app inert, supports Escape and restores focus on close. Unsupported files and PDFs longer than the existing eight-page preview limit can be opened with Apri originale.

Identity validity uses `dati_estratti.scadenza_documento` and `scadenze.categoria = rinnovo_documento`, with no amount. Saving preserves other extracted metadata and updates an existing renewal row. A partial reminder failure is reported. Oggi shows open renewals within 90 days, including overdue ones; Agenda includes renewals and opens the corresponding document. Historical document renewals are excluded. These are in-app reminders, not new push/email notifications. Identity rows have no Pagato action or euro amount.

## PIN/PUK

Codes use existing owner-only `impostazioni_app` rows under `personal:codici-documento:<id>`, never document extraction fields. AES-256-GCM, random salt/IV and document-bound additional data protect the ciphertext; PBKDF2-SHA256 uses 600,000 iterations and a password of at least 12 characters. The password and clear codes are never persisted, passed to AI, or added to files being shared. There is no password recovery. Locking, leaving the details view and hiding the page clear the displayed fields. Saving uses the row revision to reject concurrent overwrites. Existing authenticated owner policy was inspected before reuse; no policy or schema changes.

## Attachments and limits

Personal allows up to ten selected originals, prepared before the share gesture and sent as real files through Web Share. A browser that rejects multiple files gets explicit per-file downloads, never a silent title-only share. Mail can attach those downloads or existing Drive copies. No recipient is chosen and no mail is sent automatically.

A webpage/PWA cannot register itself as an Android DocumentsProvider. This repository has no native Android application. Therefore a new Poliedron entry inside another application's Allega picker is **not implemented**: it requires an installed native Android provider and device verification. Web Share and Download/Drive are the implemented routes. Physical Android behavior and production browser appearance remain unverified until deployment/device testing; successful builds are not that verification.

## Validation and rollback

Synthetic tests cover membership, ambiguous names, expiration semantics, encrypted roundtrip/wrong password/document substitution and multi-file fallback. Run the complete Node suite plus both Personal and Studio builds. Revert the dedicated PR for UI rollback. Authorized record classification has its pre-change metadata snapshot in the private Personal settings key `personal:riordino-identita:2026-11-01`; originals are retained. Restoring that snapshot requires checking for intervening user edits. Do not delete the new derived records or restore data automatically. Immutable stable checkpoints are unchanged.
