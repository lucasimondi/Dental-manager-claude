# POL-FIS-001 — Physiotherapy Clinical Core

Status: PRODUCT_OWNER_APPROVED_DESIGN

## Objective
Build a physiotherapy vertical that is clinically useful enough for daily use in a real multi-collaborator practice. The core is the physiotherapy clinical record, not a relabeled generic patient chart.

## Product principles
- one Poliedra platform, vertical-specific clinical capabilities;
- clinical record first, administration second;
- structured data where it improves continuity, outcomes and reporting;
- free text remains available where clinical nuance is needed;
- every clinical change is historically traceable;
- role-based access and tenant isolation are mandatory;
- physiotherapists, personal trainers, massage therapists and other collaborators may coexist in the same studio with different permissions and scopes;
- no collaborator should see or edit clinical information beyond their authorization.

## Patient clinical workspace

### 1. Initial physiotherapy assessment
Capture at minimum:
- reason for consultation;
- main complaint and body region;
- onset/date and mechanism;
- pain intensity (NRS/VAS) at rest, movement and night where relevant;
- pain behavior, irritability and 24-hour pattern;
- aggravating/easing factors;
- functional limitations;
- work/sport/activity context;
- previous episodes and treatments;
- relevant medical history, surgery, trauma and medications;
- red-flag screening and referral notes;
- precautions/contraindications;
- patient goals;
- clinician hypothesis/functional diagnosis field where legally/clinically appropriate;
- baseline outcome measures.

### 2. Body map
Interactive anatomical body map with:
- front/back views;
- one or multiple regions;
- pain, paresthesia, stiffness, weakness or custom symptom markers;
- intensity and notes per region;
- historical comparison between assessments;
- mobile-friendly interaction.

### 3. Objective examination
Configurable structured sections:
- observation/posture;
- active ROM;
- passive ROM;
- strength/manual muscle testing;
- neurological screen where appropriate;
- palpation;
- joint mobility;
- special tests;
- gait/balance;
- functional tests;
- sport-specific tests;
- custom measurements with value, unit, side and reference.

The system must allow custom templates by vertical/studio without hardcoding every possible test in the patient table.

### 4. Outcome measures
Support reusable validated/custom scales without embedding legal/copyright-restricted form text where not licensed.
Store:
- scale identifier/name;
- date;
- raw score;
- normalized score where defined;
- interpretation if authoritative;
- clinician note;
- comparison from baseline and previous assessment.

Examples of categories: pain, disability, function, quality of life, balance, mobility, sport readiness.

### 5. Clinical problem list
Maintain an active problem list with:
- problem/region;
- date opened;
- severity/priority;
- status: active/improving/stable/resolved;
- linked goals;
- notes;
- date resolved.

### 6. Treatment plan
Structured plan containing:
- clinical objectives;
- short/medium-term goals;
- proposed treatment strategies;
- planned frequency;
- expected duration/reassessment date;
- home exercise program reference;
- responsible clinician;
- collaborators involved;
- patient agreement/consent references where needed.

Goals should be measurable when possible and have progress state.

## Session / treatment note

Every session should be fast to document on desktop and mobile.

Required structure:
- date/time;
- treating professional;
- linked treatment plan/problem;
- pre-session symptoms / pain score;
- relevant subjective update;
- interventions performed;
- dosage/parameters where relevant;
- exercises performed;
- response during/after session;
- adverse events / warnings;
- post-session score or status;
- plan for next session;
- home instructions;
- clinician signature / finalization state.

Provide quick templates and repeat-from-previous with explicit user confirmation; never silently copy clinical findings forward.

## Reassessment

Dedicated reassessment workflow:
- compare baseline vs current symptoms;
- compare objective measurements;
- compare outcome scores;
- goal progress;
- treatment adherence where recorded;
- clinical interpretation;
- continue/modify/discharge/refer decision;
- next reassessment date.

UI should visually show meaningful changes over time rather than forcing the clinician to read every historical note.

## Discharge summary

Generate a structured discharge record:
- episode start/end;
- initial problems/goals;
- treatment summary;
- final symptoms and measurements;
- outcome change;
- goals achieved/not achieved;
- reason for discharge;
- maintenance/home recommendations;
- referrals/follow-up;
- clinician.

## Episodes of care
A patient may have multiple independent physiotherapy episodes over time. Clinical data must be grouped by episode so an old shoulder episode does not pollute a new knee pathway.

Each episode has status: draft/active/paused/completed/cancelled.

## Exercises and home program

Build a reusable exercise library with:
- title;
- category/body region;
- instructions;
- media reference when available/licensed;
- sets/reps/time/load/frequency;
- progression/regression notes;
- precautions.

Home program:
- assigned exercises;
- personalized dosage;
- start/end;
- clinician notes;
- optional patient acknowledgment/adherence tracking in future app.

Do not require the exercise module for core chart completion.

## Collaborator model

A physiotherapy studio may include:
- owner/admin;
- physiotherapist;
- personal trainer;
- massage therapist;
- rehabilitation trainer / other configured collaborator;
- front desk.

Permissions must distinguish at least:
- demographic/administrative access;
- agenda access;
- clinical read;
- clinical write;
- ability to finalize clinical notes;
- financial visibility;
- document access;
- team management.

Personal trainers/massage collaborators must not automatically receive full medical-clinical access merely because they share the same tenant.

## Multi-professional handoff

Within an authorized care team:
- clinician can assign tasks or goals to a collaborator;
- handoff note can contain only the minimum necessary context;
- collaborator notes can be kept in their permitted domain;
- full audit trail of author, timestamp and edits.

## Agenda integration

Physio agenda must support:
- recurring treatment plans;
- packages/session counters;
- resource/room assignment;
- clinician assignment;
- session status;
- no-show/cancelled;
- waitlist in future;
- automatic prompt to open/finalize session note after visit without auto-creating clinical facts.

## Operational workflow

Suggested daily workflow:
1. Home widget shows today's patients, notes to finalize, reassessments due and tasks.
2. Clinician opens patient/episode directly from agenda.
3. Session note starts from a concise template.
4. Outcomes/measurements can be updated during reassessment.
5. Next appointment/task can be created from the session workflow.
6. Finalized note becomes read-only except controlled amendment/audit process.

## Clinical timeline

Single episode timeline should combine:
- assessments;
- sessions;
- measurements;
- outcomes;
- uploaded reports;
- reassessments;
- relevant referrals;
- discharge.

Timeline must support filters and not mix unrelated financial/marketing events into the clinical view.

## Documents

Support attachments relevant to care:
- prescriptions/referrals;
- reports;
- imaging reports/files or external references;
- informed consent;
- exercise/home documents;
- discharge summary.

Use private tenant-safe storage and signed URLs according to POL-002B security architecture.

## Alerts and safety

Clinical alerts may include:
- allergies/contraindications where recorded;
- red-flag screening attention;
- reassessment overdue;
- adverse event note;
- missing required consent/document.

Alerts must distinguish clinically entered facts from AI-generated suggestions.

## AI assistant — physiotherapy

AI may assist with:
- summarizing longitudinal notes;
- identifying missing fields before finalization;
- drafting a session summary from clinician-entered facts;
- comparing measurements and outcome scores;
- suggesting questions for reassessment;
- converting dictated notes into structured draft fields;
- administrative task extraction.

AI must NOT silently create clinical findings, diagnoses, measurements or performed treatments. All AI clinical output remains draft until explicit clinician confirmation.

## Voice AI
Future voice workflow:
- hands-free dictation during/after session;
- structured draft generation;
- commands such as “aggiungi NRS 4 ginocchio destro” or “programma rivalutazione tra 3 settimane”;
- explicit confirmation before saving sensitive clinical content or scheduling changes.

## Patient app integration
Future patient app can expose only approved data:
- appointments;
- home exercises;
- questionnaires/outcomes assigned by clinician;
- reminders;
- secure documents/messages;
- progress selected for patient display.

Patient must not receive unrestricted internal clinician notes by default.

## Physiotherapy widgets for POL-UI-001
Initial widget pack:
- Today's physio sessions;
- Notes to finalize;
- Reassessments due;
- Active episodes;
- Patients not seen recently;
- Outcome improvement overview;
- Goal progress;
- Collaborator activity;
- Cancelled/no-show sessions;
- Home programs to review;
- tasks/handoffs.

Financial widgets remain POL-003 canonical and are not reimplemented in the vertical.

## Reporting / KPIs
Only derive KPIs from authoritative records. Candidate metrics:
- active episodes;
- sessions completed;
- cancellation/no-show rate;
- average sessions per episode;
- reassessment completion rate;
- outcome improvement where comparable data exists;
- average episode duration;
- clinician workload;
- retention/return rate with explicit definition;
- production/revenue/margins from the canonical financial engine.

Do not present clinical outcome causality that the data cannot support.

## Data architecture direction
Prefer normalized episode/event/template structures rather than adding dozens of physiotherapy columns to `patients`.

Expected domain concepts (names are design concepts, not authorization to create tables):
- physio_episode;
- physio_assessment;
- physio_problem;
- physio_goal;
- physio_measurement;
- physio_outcome_score;
- physio_session_note;
- physio_intervention;
- physio_reassessment;
- physio_discharge;
- exercise_library;
- home_program;
- care_team/handoff.

Exact schema must be derived from current repository and production metadata before migrations are written.

## UX requirements
- very fast session entry;
- desktop and tablet excellent, mobile fully usable;
- progressive disclosure: common fields first, advanced tests expandable;
- templates customizable by studio;
- clear historical comparison;
- avoid giant one-page forms;
- autosave draft may be used, but clinical finalization must be explicit;
- obvious finalized/amended state;
- minimal clicks from agenda to note.

## MVP gate for real-world pilot
The physio vertical is pilot-ready only when the following work end-to-end:
- patient + episode creation;
- initial assessment;
- problem/goals/treatment plan;
- session notes;
- measurements/outcomes;
- reassessment;
- clinical timeline;
- attachments/private storage;
- collaborator permissions;
- agenda integration;
- mobile usability;
- audit trail;
- build/security/tenant tests.

Exercises, patient app, advanced AI/voice, advanced analytics may follow after this core.

## Implementation phases

### FIS-001A — source/schema audit
Inventory current patient, agenda, vertical and permissions architecture; identify reuse and conflicts. No production changes.

### FIS-001B — episode + clinical record foundation
Schema/RLS/tests + episode, assessment, problem, goals, measurements, notes.

### FIS-001C — session workflow + timeline
Fast session note UX, timeline, agenda deep-link and finalization/amendment model.

### FIS-001D — outcomes + reassessment + discharge
Outcome engine, comparisons, reassessment and discharge workflow.

### FIS-001E — collaborator permissions
Role scopes, handoffs and privacy boundaries for physio/PT/massage/front desk.

### FIS-001F — physio widget pack
Integrate with POL-UI-001 modular dashboard.

### FIS-001G — pilot hardening
Mobile/tablet QA, synthetic two-tenant testing, audit/security review and pilot checklist.

## Non-goals for first core implementation
- replacing medical diagnosis systems;
- autonomous AI clinical decision-making;
- assuming confirmed appointments equal completed treatment;
- creating financial calculations outside POL-003;
- giving all collaborators broad clinical access;
- patient-facing exposure of all clinical notes.

No production migration, deployment or merge is authorized by this design document alone.