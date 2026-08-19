# POL-FIS-001A — Source and schema audit

Status: COMPLETE — documentation baseline only

This audit is derived exclusively from the versioned repository. It does not assert unversioned production metadata and does not authorize a migration.

## Existing implementation

The current vertical is mounted by `SchedaPaz.jsx` only when `studio_info.vertical` is `fisioterapista` or `massofisioterapista`. `PhysioCartella.jsx` is a 556-line patient-level component with four sections: assessments, goals, session diary and home prescriptions. It reads and writes Supabase directly and produces a browser-side PDF through `physioReport.js`.

The single physio migration, `20260818000000_physio_schema_dati.sql`, records seven already-existing concepts:

| Table | Current purpose | Important limitation |
|---|---|---|
| `physio_piani` | rehabilitation plan | patient-scoped, not episode-scoped; no responsible clinician or plan version |
| `physio_valutazioni` | initial/reassessment records | generic JSON plus a few fields; no episode, finalization or amendment |
| `physio_obiettivi` | goals | no episode; links can cross tenants unless separately prevented |
| `physio_diario_sedute` | session diary | no draft/finalized/amended lifecycle; appointment is optional |
| `physio_esercizi` | studio exercise library | media URLs are not governed by the private patient-file contract |
| `physio_prescrizioni` | exercise assignments | no episode or versioned home-program container |
| `physio_esecuzioni` | adherence log | no author/actor field and no episode relationship |

The migration comment says it was applied directly to production on 18 August 2026. That statement is repository evidence only; current catalog parity must be verified read-only before any successor migration.

## Coverage against the approved clinical core

Partially present: repeatable assessments, simple goals, free-text session entries, exercise library/prescriptions, basic before/after pain values and a PDF path.

Absent or not authoritative in the repository: episodes of care; body map; normalized objective measurements; reusable outcome definitions/scores; problem list; structured treatment-plan responsibilities; note finalization/signature/amendment; dedicated reassessment and discharge; episode timeline; clinical attachment metadata; clinical alerts; care-team/handoff tasks; role capability model; agenda deep links/prompts; physio widgets; clinical audit events; AI/voice confirmation boundary.

The current assessment JSON supports flexibility but cannot by itself provide typed comparisons, stable outcome semantics or safe drill-down. It must not be silently reinterpreted as the future normalized model.

## Tenancy and authorization findings

1. All seven tables enable RLS, but each has one `FOR ALL` policy comparing `studio_id` only with `auth.jwt().app_metadata.studio_id`.
2. Those policies do not verify active membership in `studio_users`, do not distinguish clinical read/write/finalize capabilities and give every authenticated tenant member the same clinical access.
3. The UI filters most records by `paziente_id`, sometimes without an explicit `studio_id`; correctness therefore depends entirely on RLS.
4. Foreign keys generally reference only an object `id`. They do not enforce that patient, plan, assessment, exercise, prescription and appointment belong to the same `studio_id`.
5. `physio_piani.valutazione_baseline_id` can reference any assessment ID visible to a privileged writer unless tenant-safe composite integrity is added.
6. The current `studio_users.ruolo` usage evidenced by the UI is principally `admin` versus `utente`; professional qualification and clinical capabilities are not authoritative authorization scopes.
7. POL-002B protects the `patient-files` bucket through active membership and patient ownership, but it does not implement finer clinical-document permissions. Physio attachments must reuse private signed URLs and add authorized clinical scope without weakening POL-002B.

The future model must fail closed when membership or a required capability is absent. Frontend hiding is not authorization.

## History and clinical integrity findings

- Current clinical rows are mutable and there is no immutable finalization/amendment ledger.
- `updated_at` is inconsistent and author attribution is incomplete.
- “Repeat previous” is not present; if introduced it must create a draft only after explicit confirmation.
- A confirmed appointment is not evidence of a performed treatment and must not create a session note or financial production event.
- Multiple unrelated episodes for one patient cannot currently be separated.
- Outcome comparisons have no stable scale/version/unit contract.
- AI and voice flows have no physio-specific persistence boundary; no AI output may become a clinical fact without clinician confirmation.

## Integration boundaries

- Agenda may provide patient, appointment, resource and clinician context, but session completion remains an explicit clinical act.
- Clinical documents must use POL-002B private storage and short-lived signed URLs.
- Financial production/revenue/margin must be read from POL-003/POL-003F only. No physio table or widget may calculate or duplicate financial formulas.
- POL-UI-001 may register physio widgets only after their server-side, tenant-safe data contracts exist.
- Patient-facing exposure, AI/voice, adherence automation and advanced analytics remain later gates.

## Required read-only metadata before FIS-001B

The Product Owner or authorized Tech Lead must capture current production metadata without data rows: exact columns/types/defaults/constraints/indexes/FKs for the seven physio tables and their referenced tables; policy definitions and grants; triggers/functions touching them; `studio_users` role/status constraints; agenda resource/user relationships; Storage bucket/policy metadata relevant to patient files; and migration-history parity. No PHI, Storage objects or table data is required.

Any difference from the repository must be documented before authoring FIS-001B. Do not use `db reset`, `db push`, dashboard edits or guessed repair SQL against production.

## FIS-001A conclusion

Reuse is possible for patient identity, agenda references, private Storage, tenant membership and parts of the existing physio data. The current seven-table model is not sufficient or safe enough for the approved multi-collaborator clinical core. FIS-001B must be additive, tenant-safe, auditable and backward-compatible; it must not reinterpret historical rows or cut over the UI until reconciliation and rollback gates pass.
