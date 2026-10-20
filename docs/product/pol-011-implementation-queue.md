# POL-011 — Implementation Queue

This file decomposes the clinic-ready Physio vertical into agent-sized tasks. Do not execute these tasks in parallel when they touch the same schema/component unless ownership is explicitly reassigned.

## PHYS-001 — Episode model and ownership
Goal: add explicit rehabilitation episodes/courses and responsible-clinician assignment without breaking existing `physio_*` data.

Deliverables:
- migration for episode/course model;
- backward-compatible links from evaluations, goals, diary and prescriptions;
- indexes and tenant-safe foreign keys;
- RLS based on studio + role/assignment policy;
- synthetic migration/regression tests.

Gate: no production migration until local validation and Product Owner review.

## PHYS-002 — Clinical record shell
Goal: make the active episode the primary Physio view.

Deliverables:
- active episode header;
- problem/district/laterality;
- responsible clinician;
- flags;
- latest session;
- active goals;
- next appointment;
- persistent `Nuova seduta` action.

UX target: patient → active Physio episode in one click.

## PHYS-003 — Structured history + flags
Deliverables:
- physiotherapy-relevant history fields;
- contraindications/precautions;
- red/yellow flags;
- flag resolution with author/timestamp;
- tests for visibility and authorization.

## PHYS-004 — Assessment templates and reassessment
Deliverables:
- reusable assessment templates;
- ROM/strength/special tests/functional observations;
- outcome-measure framework;
- baseline vs reassessment comparison;
- trend rendering.

## PHYS-005 — Ultra-fast session note
Deliverables:
- one-click launch from episode/appointment;
- prefilled clinician/date/episode;
- favorite treatments/templates;
- pain before/after;
- response/tolerance;
- next step;
- duplicate-previous-session with explicit confirmation;
- author and timestamp.

Acceptance: routine note completed in under 60 seconds during usability test.

## PHYS-006 — Multidisciplinary role model
Roles:
- owner/admin;
- physiotherapist;
- personal trainer;
- massage therapist;
- secretary;
- read-only.

Deliverables:
- server-side role/assignment authorization;
- UI capability matrix;
- negative tests proving forbidden writes/read access;
- migration path from generic `utente` role without granting excess access.

## PHYS-007 — Collaborator handoff workflow
Deliverables:
- assignment of patient/episode to collaborator;
- PT sees required goals, precautions and assigned work only;
- massage therapist sees required context only;
- collaborator-specific session documentation;
- physiotherapist remains owner of physio assessment/plan.

## PHYS-008 — Timeline, discharge and reports
Deliverables:
- unified episode timeline;
- discharge/end-of-course workflow;
- goal closure;
- final measures;
- recommendations;
- progress and discharge PDFs;
- protected file integration with POL-002B.

## PHYS-009 — Studio dashboard
Deliverables:
- active episodes;
- missing notes;
- overdue reassessments;
- no-shows/cancellations;
- patients without next appointment;
- collaborator utilization;
- financial widgets only through POL-003 canonical metrics.

## PHYS-010 — Pilot validation pack
Synthetic pilot studio:
- owner physiotherapist;
- collaborating physiotherapist;
- personal trainer;
- massage therapist;
- secretary;
- >=5 synthetic patients and concurrent episodes.

End-to-end path:
`new patient -> initial assessment -> plan -> collaborator assignment -> appointment -> session note -> home program -> reassessment -> handoff -> discharge/report`

Definition of done:
- two-studio isolation passes;
- all role negative tests pass;
- mobile/tablet usability acceptable;
- ordinary session note target met;
- no blocker security issue in Physio scope;
- demo account usable without developer assistance.
