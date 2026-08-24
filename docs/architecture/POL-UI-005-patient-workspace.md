# POL-UI-005 — Patient Workspace 2.0

Status: IMPLEMENTED LOCALLY — WAITING PRODUCT OWNER

## Functional inventory of `SchedaPaz.jsx`

The legacy component remains the owner of all existing write flows. Its audited
surface includes patient identity/editing, general notes, annotations and
recalls, signed clinical-history forms, consent templates/signature and remote
links, GDPR export/deletion, care-plan CRUD/PDF/multi-plan selection, treatment
completion and collection flags, orthodontic aligner delivery, implants,
payments/advances, fiscal and medical documents, protected patient-file storage,
document archive/preview/delete, agenda creation/history, WhatsApp templates and
the Physio record entry point.

Direct backend dependencies retained unchanged: `consensi_firmati`,
`consenso_modelli`, `storie_cliniche`, `storia_clinica_voci`,
`documenti_medici`, `documenti_fiscali`, the private `patient-files` bucket,
and RPCs `crea_link_firma_consenso`, `registra_firma_consenso`,
`crea_link_storia_clinica`, `firma_storia_clinica`,
`gdpr_esporta_paziente`, and `gdpr_cancella_paziente`.

## Architecture

`SchedaPaz.jsx` is preserved as the compatibility controller. The default
authorized clinical surface delegates presentation to
`PatientClinicalCockpit.jsx`; `patientCockpitModel.js` provides a pure,
tenant-filtered adapter over already-loaded sources. Existing tabs remain the
canonical owners of mutations and are opened through workspace navigation.

The workspace provides a compact patient header, clickable four-card snapshot,
horizontal section navigation, clinical map and care-plan workspace, filtered
unified timeline, desktop side rail, patient-details drawer, contextual
Poliedron entry and real appointment/WhatsApp actions. Mobile removes the
desktop-only assistant rail, uses scrollable navigation and preserves the
full-screen shell.

## Safety boundaries

- No schema, migration or new persistent event model.
- No duplicate write service or financial formula was added.
- Patient finance remains unavailable unless both permission and an
  authoritative patient-level contract are present.
- Clinical cockpit visibility remains capability-gated; legacy non-clinical
  access is unchanged.
- Poliedron receives only patient id/name/studio plus current anatomical context.

## Legacy remainder

Forms/modals for consent, history, GDPR, plans, implants, payments, files,
documents, agenda and WhatsApp remain rendered by `SchedaPaz.jsx`. This is
intentional incremental migration: moving them requires extracting their state
and service contracts without changing behavior. Activities do not yet have a
patient-scoped repository contract in this component; the navigation currently
opens the existing notes/activity area and does not make patient association
mandatory in the global activity model.

## Validation

- Focused Patient Workspace suite: 27/27 passing.
- Vite production build: passing outside the Windows filesystem sandbox.
- Full repository suite: one pre-existing POL-UI-015 Dashboard CSS source-order
  regression; Patient Workspace tests pass.
- `git diff --check`: clean.
- No database/deployment change.

Rollback: revert the two POL-UI-005 commits. No data rollback is required.
