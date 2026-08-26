# POL-UI-005C — document, prescription and consent audit

Date: 2026-08-26. Scope: repository evidence only. No remote database inspection, migration, schema, RLS, Storage, production data or deployment change.

## Verified sources reused

- `documenti_medici`: `DocMedico.jsx` writes patient/studio metadata and `pdf_base64`; `ArchivioDocs.jsx` reads metadata first and retrieves `pdf_base64` only for view/download. Prescription remains the `tipo = ricetta` medical-document subtype and therefore retains this source of truth.
- `documenti_fiscali`: `DocFiscale.jsx` writes fiscal document metadata and `pdf_base64`; `ArchivioDocs.jsx` uses the same metadata-first/on-demand-content pattern.
- `consenso_modelli`: `Impostazioni.jsx` proves tenant-scoped active templates with `titolo`, `testo`, `tipo` and `attivo`.
- Remote signature: `FirmaConsenso.jsx` proves token lookup through `info_link_firma_consenso`, PDF/hash creation and completion through `registra_firma_consenso`.
- Existing Polyedron prescription executor: `prescription.create` in `src/lib/poliedron/actionRegistry.js` opens the real prescription workflow, requires confirmation and does not write directly.

## Integration decisions

- The Workspace tab reads only patient-scoped metadata from the two existing document tables. No PDF/base64 is included in the initial select.
- The tab component is mounted only when `tab === 'doc'`; the two metadata queries run sequentially and no Realtime subscription is created.
- Open/print retrieves one row's `pdf_base64` on demand from its original table.
- `CREATE_PRESCRIPTION` delegates to the real `DocMedico` flow. `DocMedico` is lazy-loaded on click, receives the current patient/studio, and keeps `documenti_medici` as storage truth. Dosage and notes were added to the existing prescription form/PDF rather than creating a parallel form.
- `CREATE_CONSENT` reads real active templates and preassigns the current patient. It intentionally stops before signature creation because the repository does not prove the authenticated token/link creation contract.
- `PatientWorkspaceContext` exposes `documents`, `prescriptions` and `consents` from the same normalized document read model. Timeline items are projections with source table/id; no event rows are written.

## Gaps and security limits

- `NOT_VERIFIED_REMOTE`: baseline DDL, constraints, indexes and RLS for `documenti_medici`, `documenti_fiscali`, `consenso_modelli` and signed-consent storage are absent from migrations.
- `BLOCKED_BY_MISSING_CONTRACT`: the repository contains public token consumption and signature registration, but not the authenticated function that creates a consent link or proves the signed-record table returned to authenticated users. The Workspace therefore does not expose an enabled signature CTA and creates no fallback table.
- Existing medical/fiscal PDFs are base64 database fields. This task does not migrate them to Storage or duplicate them.
- Existing `patient-files` Storage concerns and private signed-URL migration remain outside scope; this integration does not list that bucket or call `getPublicUrl`.
- Client queries rely on existing RLS and patient filters. No tenant fallback, policy bypass or service role was added.

## Database and rollback

Database impact: none. No migration is present.

Rollback: revert the POL-UI-005C commit. Existing documents and all production routes remain untouched.
