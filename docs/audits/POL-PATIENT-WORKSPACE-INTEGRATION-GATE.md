# Patient Workspace 2.0 — integration gate

This branch intentionally does not activate Patient Workspace 2.0 on the production patient route.

## Enabled through canonical legacy services

- Clinical-plan creation (`dm_pl`) with read-back verification.
- Treatment append inside `plans.voci`, after a fresh ownership check.
- Idempotent treatment completion, followed by read-back verification.
- Received-payment registration (`dm_py`) with patient and amount validation.

## Routed to existing modules, not reimplemented

- Medical documents and prescriptions: `DocMedico.jsx`.
- Consents: existing consent preparation/signature flow.
- Anatomical tooth selection: `Odontogramma.jsx` selector semantics only.

## Not activatable yet

- Payment plans/installments: no canonical persistent entity.
- Clinical odontogram: the existing component is a selector, not a clinical source of truth.
- Universal timeline: no canonical event store.
- Quote as an entity distinct from the legacy clinical plan: semantic/data lock still required.

The stable `SchedaPaz.jsx` remains the production route until the connected component can reconcile verified writes into App state without invoking the sync setter a second time, and every legacy-module handoff has an explicit callback and regression test.
