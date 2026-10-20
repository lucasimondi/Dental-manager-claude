# POL-011 — Physio Clinic-Ready Vertical

Status: design specification only. No production changes authorized by this document.

## Goal
Make the physiotherapy vertical ready for real daily use in a multidisciplinary studio with a physiotherapist owner and collaborators such as physiotherapists, personal trainers, massage therapists and front-desk staff.

The clinical record is the product center of gravity. The ordinary session must be recordable in under 60 seconds without losing clinical traceability.

## Current baseline already present
- dedicated Physio tab in the patient chart;
- initial evaluation and reassessment;
- NRS pain at rest/exercise;
- flexible fields for ROM, strength and tests;
- therapeutic goals;
- session diary;
- home exercises and exercise library;
- patient-course PDF report;
- dedicated `physio_*` tables and studio-scoped RLS.

## P0 — Clinic-ready clinical record

### 1. Rehabilitation episode / course
Each patient can have one or more episodes/courses. Each episode stores:
- title/problem;
- onset/injury/surgery date when relevant;
- referral/source;
- body district and laterality;
- responsible physiotherapist;
- start date, expected end date and status;
- diagnosis/referral text where supplied;
- contraindications/precautions;
- active goals;
- linked appointments, sessions and documents.

The patient dashboard must immediately show the active episode and avoid mixing unrelated historical problems.

### 2. Clinical history
Dedicated structured areas for:
- reason for consultation;
- relevant medical/surgical history;
- medications relevant to treatment;
- previous injuries/interventions;
- comorbidities;
- allergies/precautions;
- activity/work/sport context;
- patient expectations;
- free clinical notes.

Do not duplicate CORE demographics.

### 3. Safety flags
Structured `red flags`, `yellow flags` and free warning notes.
- visible at the top of every Physio clinical view;
- severe/open flags must remain visible during session entry;
- resolution/override must be timestamped and attributed.

### 4. Body chart
Interactive or structured body map supporting:
- pain/symptom location;
- laterality;
- symptom type;
- intensity;
- optional radiation/distribution notes;
- history over time.

If a graphical body chart is deferred, ship a structured district/laterality representation first.

### 5. Initial assessment and reassessment
Assessment must support reusable templates but remain flexible. Core domains:
- pain NRS;
- ROM;
- strength;
- neurological findings when relevant;
- palpation/functional observations;
- special tests;
- gait/movement observations;
- functional limitation;
- free clinical reasoning;
- treatment indication/plan.

Reassessment must compare current values with baseline/previous values and visibly show trend.

### 6. Standardized outcome measures
Configurable library of scales/questionnaires. Initial priority examples may include generic measures such as pain NRS and PSFS plus condition-specific templates, but the system must not hard-code a single clinical philosophy.

Store:
- scale name/version;
- raw score;
- normalized score if applicable;
- date;
- author;
- interpretation text where configured.

### 7. Goals
Short/medium/long-term goals with:
- baseline;
- current value;
- target;
- unit;
- target date;
- owner;
- status;
- progress percentage when mathematically valid.

Goals should be visible while documenting sessions.

### 8. Treatment plan
Per episode:
- planned frequency;
- expected duration;
- treatment strategy;
- planned interventions;
- home program;
- restrictions/precautions;
- responsible physiotherapist;
- collaborators involved.

### 9. Ultra-fast session note
Primary UX target: ordinary session completed in <60 seconds.

Session form should prefill:
- patient;
- active episode;
- date/time;
- treating collaborator;
- appointment;
- prior pain/last findings where useful.

Fast fields:
- pain before / after;
- treatments performed using favorites/templates;
- duration;
- response/tolerance;
- key findings;
- exercise/progression changes;
- note;
- next step;
- follow-up/rivaluation flag.

Support `duplicate previous session` with mandatory confirmation/edit before save.

### 10. Clinical timeline
Unified chronological timeline showing:
- evaluations;
- reassessments;
- sessions;
- goal changes;
- home-program changes;
- relevant uploads/documents;
- flags;
- discharge/end-of-course report.

Every entry must show author and timestamp.

### 11. Discharge / end of course
Structured closure including:
- reason for closure;
- achieved/unachieved goals;
- final outcome measures;
- final NRS/function;
- recommendations;
- residual limitations;
- home/self-management plan;
- PDF report.

## P0 — Multidisciplinary collaborators and permissions
Current generic `admin/utente` model is insufficient.

Required functional roles:
- owner/admin;
- physiotherapist;
- personal trainer;
- massage therapist;
- secretary/front desk;
- optional read-only collaborator.

### Permission principles
Owner/admin:
- full studio administration;
- users/roles;
- clinical access according to studio policy;
- financial/management dashboards.

Physiotherapist:
- create/edit physiotherapy assessments;
- create treatment plan;
- manage goals;
- document sessions;
- prescribe/progress exercises;
- close episode;
- access clinically necessary documents.

Personal trainer:
- see only assigned patients/courses or explicitly shared items;
- see instructions, precautions and goals required for assigned work;
- document exercise/training sessions and progression;
- cannot alter physiotherapy assessment, diagnosis/referral, red flags resolution or physiotherapist treatment plan unless explicitly permitted by role policy.

Massage therapist:
- see only assigned patient/course context necessary for the session;
- document massage/manual-treatment session notes in own professional section;
- cannot edit physiotherapy assessment/goals/plan.

Secretary/front desk:
- demographics/contact;
- appointments;
- administrative documents/payments as permitted;
- no unrestricted clinical-note access.

Read-only collaborator:
- scoped view only; no clinical writes.

All authorization must be enforced server-side/RLS, not only hidden in UI.

## P1 — Studio workflow

### Practitioner assignment
- primary clinician per episode;
- multiple collaborators;
- assignment history;
- workload visibility.

### Agenda integration
- appointment links to patient, episode and practitioner;
- one-click `open session note` from appointment;
- appointment completion can prompt missing session note;
- no-show/cancellation visible in course timeline but not counted as delivered clinical production.

### Owner dashboard
At minimum:
- active patients/courses;
- new courses;
- sessions today/week/month;
- no-show/cancellations;
- missing/incomplete notes;
- overdue reassessments;
- goals due/overdue;
- closed courses;
- collaborator utilization;
- patients without future appointment.

When POL-003 is implemented, add canonical financial metrics by practitioner/service without creating duplicate formulas.

## P1 — Exercise and home program
- studio exercise library;
- favorites/templates;
- video/image/instructions;
- dosage: sets/reps/time/frequency;
- progression/regression;
- contraindications/warnings;
- patient-specific instructions;
- active/inactive period;
- adherence/feedback log;
- future patient-app delivery.

## P1 — Documents and reporting
- protected patient-files integration after POL-002B;
- clinical attachments linked to episode where possible;
- report initial assessment;
- progress report;
- discharge report;
- home exercise program PDF/shareable output;
- audit trail for generated clinical outputs.

## P1 — Auditability
Clinical entries should support:
- author;
- created_at;
- updated_at;
- edit history or append-only amendment strategy for clinically material notes;
- professional role at time of entry;
- no silent overwrite of another professional's signed/finalized note.

A simple draft/finalized model is acceptable for v1 if it preserves authorship and amendments.

## UX acceptance criteria
- patient → active Physio course reachable in one click;
- top summary displays problem, responsible clinician, flags, latest session, trend, active goals and next appointment;
- `New session` always visible for authorized clinician;
- routine session <60 seconds in usability test after user is trained;
- reassessment visibly compares baseline/previous values;
- mobile/tablet layout usable during treatment;
- no duplicate data entry between CORE and Physio vertical where a canonical CORE field already exists.

## Security acceptance criteria
- Studio A cannot read/write Studio B Physio data;
- personal trainer cannot alter physiotherapist-only records;
- massage therapist cannot alter physiotherapist-only records;
- secretary cannot access unrestricted clinical notes;
- unassigned collaborator access follows explicit studio policy and defaults to least privilege;
- all sensitive file access follows POL-002B private Storage rules;
- every clinically material write is attributable to a user.

## Beta acceptance scenario
Before declaring clinic-ready, test with a synthetic studio matching this workflow:
- 1 owner physiotherapist;
- 1 collaborating physiotherapist;
- 1 personal trainer;
- 1 massage therapist;
- 1 secretary;
- at least 5 synthetic patients and multiple concurrent episodes.

Test full path:
`new patient → initial assessment → plan → assigned collaborator → appointment → session note → home program → reassessment → collaborator handoff → discharge/report`.

## Definition of Done for first real-world pilot
POL-011 is pilot-ready only when:
1. P0 clinical record items are implemented;
2. role-based access is enforced server-side;
3. agenda/session workflow is functional;
4. protected files work with POL-002B;
5. mobile/tablet use is acceptable;
6. build and relevant tests pass;
7. two-studio + multi-role security tests pass;
8. no blocker severity security finding remains in Physio scope;
9. a clean demo/test account can be handed to the physiotherapist owner without developer assistance for ordinary daily use.

## Explicit non-goals for first pilot
- replacing external diagnostic medical systems;
- autonomous AI diagnosis;
- automatic clinical decision-making;
- full patient app (future task);
- financial formula redesign inside this task (use POL-003 canonical engine).
