# Patient record → actual Studio agenda → same patient record

The Product Owner requires selecting the next appointment in the existing Studio agenda, with the patient record compressed and automatically reopened after selecting a slot. No parallel calendar or fake availability is used.

App owns the patient record and hides, rather than unmounts, its existing subtree through PatientAgendaLayer. PatientAgendaDock restores it without scheduling. The existing legacy and V2 records expose the same appointment action. Patient-list entries use the same global boundary so navigating to Agenda does not destroy the record. No workspace feature flag changes.

Agenda retains its day/week/month navigation, filters, appointments and events. During follow-up mode a compact procedure/duration editor is included in its measured mobile floating strip. Tapping an empty slot validates against all loaded appointments/events, including hidden ones. Occupied appointment/event taps do not open editors and desktop move/resize is suspended during this mode.

The existing computeFreeSlots is the availability authority in this frontend. The existing authenticated tenant-scoped DB adapter re-reads appointments/events immediately before insert. The selected chair is checked across operators. App waits for DB.insert before adding the returned row and reopening the same patient subtree. Failure leaves the agenda and draft open. UI locks guard repeated taps. This does not introduce atomic server-side reservation or change the existing database concurrency guarantees. There is no automatic retry of an uncertain write.

No new schema, RLS, authorization, clinical/financial semantics, prescription generation or deployment architecture. The full rapid-visit form discussed in the earlier interactive proposals is not shipped by this navigation change.

Verification: Node service tests cover overlap, hidden rows, full-day/timed blocks, past dates, duration, chair conflicts, failed reads/writes and confirmed return data. The browser fixture mounts the real Studio Agenda, PatientAgendaLayer and PatientWorkspaceBoundary using synthetic records, and tests state retention, manual restore, failed save and automatic return at 375/768/1024/1440 in Chromium/WebKit. No production patient data or live writes in tests.

Rollback: revert this PR; no database operation needed. The immutable stable/2026-08-27-full-recovery checkpoint remains untouched.
