# Appointment patient actions

The existing Studio appointment menu retains calls, WhatsApp/email, edit, move, delete, recall, activity and Poliedron. Four additional actions on mobile and desktop open the appointment's patient in the existing treatment/prescription/document/payment forms. The action resolver refuses unknown actions, missing records and patient/appointment ID mismatches.

The stable SchedaPaz operational forms are reused deliberately for these explicit actions, including when normal patient browsing uses V2. No feature flag or V2 capabilities are changed and its ordinary route remains unchanged. Prescription/document generation uses DocMedico with its existing vertical eligibility and doctor confirmation. Payments use IncassoModal with its existing plan allocation. The same prescription vertical eligibility also controls the new menu button.

Treatment opens PianoDrillDown. One active/accepted plan opens its existing description/price editor immediately. With multiple eligible plans the operator explicitly chooses one; with none, the existing new-plan action remains available. Adding a treatment does not mark it executed or paid. No financial formula, plan/payment storage format, schema, RLS or authorization change.

An explicit action keeps a stable React key while the initial document request is acknowledged, preventing a remount during prescription editing. The patient record continues to support the compression/real-agenda/return workflow shipped in PR #237.

Validation uses synthetic records and intercepted network requests: existing appointment actions remain present; manual treatment and price save without execution/payment; prescription editor and diagnostic requests open; incasso targets the correct patient. No production writes in verification. Rollback: revert this PR; no migration.
