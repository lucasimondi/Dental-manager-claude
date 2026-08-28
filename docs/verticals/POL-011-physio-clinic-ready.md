# POL-011 — Physio Clinic-Ready Vertical

Status: design specification only. No production change.

## Objective
Make the physiotherapy vertical ready for real daily use in a multidisciplinary studio led by a physiotherapist, with collaborators such as physiotherapists, personal trainers, massage professionals and administrative staff.

The clinical record is the primary product surface. It must be fast enough for every-session use, clinically structured enough for longitudinal care, and permission-aware so non-physiotherapist collaborators do not automatically receive the same clinical privileges.

## Current strengths already present
- dedicated `PhysioCartella` tab inside patient record;
- repeatable initial assessment and reassessment;
- pain at rest / during exercise (NRS 0-10);
- free clinical fields for ROM, strength and tests;
- therapeutic goals;
- session diary;
- home exercise prescriptions;
- exercise library;
- PDF pathway report;
- seven dedicated `physio_*` tables with studio-scoped RLS;
- core agenda, payments, patient record, documents and communications already reusable.

## Current blockers before handing it to a real clinic

### P0 — Clinical record
1. Unified physiotherapy episode of care (`percorso/piano riabilitativo`) with start date, referral source, diagnosis/reason, clinical hypothesis, precautions, red flags, plan, owner therapist and status.
2. Structured initial assessment template in addition to free fields:
   - reason for consultation / onset / mechanism;
   - relevant medical history and comorbidities;
   - medication/allergies link to core history;
   - red/yellow flag checklist;
   - pain map/body area and symptom behaviour;
   - functional limitations and participation;
   - observation/palpation where relevant;
   - ROM;
   - strength;
   - neurological screening where relevant;
   - special tests;
   - gait/balance where relevant;
   - clinician impression / functional diagnosis;
   - treatment plan and prognosis.
3. Outcome measures / scales with score history and trend. Configurable library per clinic. Examples: NRS/VAS plus disability/function questionnaires appropriate to the treated district.
4. Body chart: anatomical pain/symptom map with side, location, type and intensity.
5. Fast reassessment: clone previous assessment, change only relevant values, show delta/trend.
6. Session note optimized for <60 seconds of charting:
   - linked appointment and clinician;
   - subjective update;
   - objective findings;
   - interventions/treatment;
   - response to treatment;
   - pain before/after;
   - exercises progressed/regressed;
   - plan for next session;
   - adverse event / escalation flag.
7. Immutable author/time metadata on clinical entries plus amendment history. No silent overwrite of signed/finalized clinical notes.
8. Episode close/discharge note with outcome, goals achieved, final measures, advice and reason for discharge.
9. Attachments linked to episode/assessment/session: reports, imaging, photos, external documents; use private patient file architecture after POL-002B.
10. Searchable longitudinal timeline combining assessment, reassessment, session notes, outcomes, exercise changes and attachments.

### P0 — Multidisciplinary collaborators and permissions
Current `admin` / `utente` is insufficient because ordinary users currently have broadly complete access.

Introduce professional profile and permission matrix separate from billing plan role:
- owner/admin;
- physiotherapist;
- massage professional / massage therapist;
- personal trainer / exercise professional;
- receptionist / administrative;
- read-only / external collaborator (optional).

Required permission dimensions:
- patient demographics;
- agenda;
- clinical history;
- physiotherapy assessment;
- session notes;
- treatment plan/goals;
- exercise prescription;
- documents;
- financial data;
- management control;
- user administration;
- export/GDPR operations.

Default principle: least privilege. A personal trainer or massage professional must not automatically receive every physiotherapy clinical/admin privilege simply because they belong to the same studio.

Each clinical entry must record the actual author and professional type. Ownership and handover of a patient's pathway must be explicit.

### P0 — Studio operations
- collaborator-specific agenda and availability;
- service-to-professional compatibility (e.g. a given service can be booked only with allowed professional types);
- rooms/resources/equipment where needed;
- patient assignment: lead physiotherapist + collaborators;
- internal handoff note / task between professionals;
- visibility of today's patients and incomplete notes;
- no-show/cancellation reason;
- packages / cycles of sessions with remaining sessions;
- payment and appointment linkage;
- collaborator production tracking compatible with POL-003 financial source of truth.

## P1 — Clinical productivity
- reusable assessment templates by district (lumbar, cervical, shoulder, knee, ankle, hip, neuro, pelvic-floor only if deliberately supported, etc.);
- custom clinic templates without code changes;
- favorite tests/measurements;
- one-click duplicate previous session;
- shortcuts/macros for recurring interventions;
- voice-to-note AI draft, always clinician-reviewed before finalization;
- AI longitudinal summary of the record with source links to the actual entries;
- automatic detection of missing reassessment / stalled goals / worsening trend;
- charts for pain, ROM, strength, questionnaire scores and goals;
- report to referring physician / patient generated from validated record data;
- home program PDF/share link, later patient app integration;
- exercise images/video and progressions/regressions.

## P1 — Multidisciplinary workflow
- shared care plan with role-specific tasks;
- physiotherapist can prescribe/authorize an exercise block that a trainer follows;
- trainer can record execution/performance without rewriting the physiotherapy assessment;
- massage professional can document own session note in a scoped section;
- internal notes vs clinical record explicitly separated;
- configurable supervision/co-sign workflow for selected collaborator types;
- permissions to hide financial data from clinical collaborators when desired.

## P1 — Patient experience
- intake questionnaire before first visit;
- consent/privacy/clinical forms;
- reminders and confirmations;
- patient-reported outcome measures sent remotely;
- home exercise adherence feedback;
- patient app: appointments, exercises, documents, payments, questionnaires and secure messages.

## P1 — Management view for clinic owner
- active pathways;
- new patients;
- sessions delivered / booked / missed;
- utilization by collaborator;
- incomplete clinical notes;
- patients not reassessed after configured interval;
- goal attainment;
- average sessions per episode;
- revenue / production / collected cash by professional and service using POL-003 canonical semantics;
- collaborator compensation basis configurable but separate from accounting truth.

## Data-model hardening required
The current seven `physio_*` tables are a useful base but not sufficient for clinic-ready operation.

Add or extend versioned schema for:
- `physio_episodi` / explicit rehabilitation episode;
- structured assessment sections (JSON schema/version or normalized measurements, but versioned);
- `physio_misure` / outcome measure results and measurement metadata;
- body-chart findings;
- session note status (`draft`, `final`, `amended`) and amendment chain;
- professional author/owner references;
- discharge record;
- patient-professional assignment;
- optional collaborator-specific scoped notes.

Critical: tenant-safe foreign keys must be addressed in the broader multi-tenant hardening work. Do not rely only on matching IDs across tables.

## UX requirements
The physiotherapist must be able to open a patient and immediately see:
1. why the patient is being treated;
2. current episode and responsible therapist;
3. last session and current trend;
4. current goals;
5. alerts / precautions / red flags;
6. next appointment;
7. fastest action: `Nuova seduta`.

Target: routine session note in less than 60 seconds; reassessment in a few minutes using prior values and delta views.

## Suggested patient-record navigation
- Overview
- Clinical history / anamnesis
- Physiotherapy
  - Episode overview
  - Initial assessment / reassessments
  - Measurements & outcome scales
  - Goals / plan
  - Session timeline
  - Home exercise
  - Attachments
  - Discharge
- Agenda
- Payments
- Documents

## Definition of Clinic-Ready v1
The vertical is ready to hand to a real physiotherapy clinic only when all of these are true:
- physiotherapist can create and close an episode end-to-end;
- initial assessment, reassessment, goals and each session are recorded quickly;
- author and timestamps are reliable and amendments are auditable;
- outcome measures show longitudinal trends;
- attachments are private and tenant-safe;
- at least physiotherapist / trainer / massage / admin roles have tested least-privilege permissions;
- each collaborator has usable agenda and patient assignments;
- PDF/export pathway works;
- build and regression tests pass;
- two-tenant and cross-role negative security tests pass;
- realistic synthetic clinic acceptance test passes with multiple collaborators;
- no production rollout before Product Owner approval.

## Acceptance scenario
Synthetic clinic:
- 1 owner physiotherapist;
- 2 physiotherapists;
- 1 personal trainer;
- 1 massage professional;
- 1 receptionist;
- multiple patients and episodes.

Test a complete journey:
lead/intake -> first appointment -> assessment -> plan/goals -> multiple sessions by permitted professionals -> reassessment -> exercise progression -> payment/package -> report -> discharge.

Cross-role tests must prove that each professional can only read/write the sections explicitly allowed by the clinic permission matrix.
