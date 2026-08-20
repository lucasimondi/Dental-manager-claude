# POL-FIS-001B/C — Clinical vertical slice

Status: IMPLEMENTED LOCALLY — production unapplied

## Scope delivered

This slice reuses the existing patient workspace and legacy Fisio component while adding an episode boundary, concise overview, progressive anamnesis, longitudinal body-map snapshots, rapid session drafts, explicit finalization, append-only corrections and an episode timeline.

The new component is mounted in the existing Fisio tab. The previous seven-table UI remains available as `Storico precedente`; no legacy row is copied, reclassified or deleted.

## Server contract

The additive migration introduces:

- explicit per-user clinical capabilities independent from job-title strings;
- episode, anamnesis, body-map, problem, goal, treatment-plan version, clinical-note, outcome and audit records;
- same-tenant episode relationships and a patient/tenant validation trigger;
- active-membership plus capability RLS for clinical read/write/finalize access;
- immutable finalized/amendment notes and attributable audit events;
- least-privilege Data API grants.

Installation does not seed capabilities, migrate history or execute a backfill. An administrator must explicitly grant clinical capabilities in a future approved workflow. A collaborator without an active membership remains denied even when an access row exists.

## Clinical note lifecycle

`draft -> finalized` is an explicit user action and requires `clinical_finalize`. Finalized notes cannot be updated or deleted. A correction is a new immutable `amendment` linked to the finalized note. “Duplicate previous” copies only treatment, exercises, home instructions and next step into a new draft after explicit confirmation; it does not copy symptoms, measurements, response or clinical findings.

## Responsive contract

The same component and data are used at every width. Layout contracts cover phone (up to 767 px), tablet (up to 1024 px) and wide desktop (from 1280 px). Tabs scroll, grids collapse, primary actions become a touch-friendly sticky action area and interactive controls have a 44 px minimum target.

## Boundaries intentionally preserved

- Existing agenda remains authoritative; a confirmed appointment does not create clinical facts.
- Existing POL-002B patient-file flow remains the only authorized private attachment path. This slice does not add a second uploader and contains no `getPublicUrl`.
- No POL-UI-001 file, registry or layout was modified.
- No financial object or formula was added. POL-003F remains an external canonical dependency; collaborator current costs are never read here.
- AI/dictation is not persisted by this slice and cannot save clinical facts.

## PRODUCT_OWNER_DECISION_REQUIRED

1. Approve the exact capability presets for physiotherapist, personal trainer, massage therapist, other clinician and front desk. The migration stores explicit grants but does not assume legally sufficient defaults.
2. Define whether “Firma e chiudi” is an internal authorship/finalization attestation or must satisfy an additional regulated electronic-signature standard.
3. Approve the legacy-to-episode mapping rules. Existing rows remain visible but unassigned rather than being grouped by guessed diagnosis/date.
4. Approve licensed outcome scales, score ranges and interpretations before any catalog or automatic improvement label is implemented.
5. Define retention/deletion and correction rules for clinical records and audit data.
6. Approve the body-map drawing representation and retention requirements before freehand stylus strokes or image layers are persisted.

## Remaining phases

The slice is not the complete pilot: typed modular assessment measurements; full problem/goal/plan editing UI; dedicated reassessment/discharge comparisons; private attachment UI inside the episode; agenda deep links; care-team handoffs; authorization administration UI; outcome charts; validated stylus drawing; POL-UI-001 widget registration; AI/voice preview; autosave/conflict handling and full device E2E remain follow-up work.
