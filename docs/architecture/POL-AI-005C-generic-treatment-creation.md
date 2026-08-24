# POL-AI-005C — Generic treatment creation

## Root cause

The 005A/005B pipeline supported explicit plan creation and completed-treatment workflows, but generic add/insert/record wording did not map to a Level-2 action intent. Those commands therefore fell through to non-writing handling. Patient context was also limited to Workflow G.

## Canonical flow

`ADD_TREATMENT_ITEM` extends the deterministic parser and reuses the existing patient/procedure resolvers, Action Planner, Level-2 preview, confirmation handler, Action Executor and `treatmentPlanService`. No direct UI/parser write path exists.

`UNDERSTAND → RESOLVE → PLAN → PREVIEW → CONFIRM → permission recheck → canonical fresh read → ACT → VERIFY`

## Resolution rules

- A named patient is resolved against tenant-scoped patients. Without a name, the current patient id is treated as an untrusted hint and resolved again against canonical state.
- Text tooth context wins. A visual selected tooth is used only when text supplies none. Invalid FDI values block.
- Each procedure/tooth pair is independent. Multiple procedures on one tooth and one procedure on multiple teeth never collapse.
- Unknown tooth uses the existing incomplete representation (`dente: ''`) and previews as `Elemento dentario: da completare`.
- Procedure ambiguity, patient ambiguity and multiple plausible plans block confirmation.
- Exactly one open plan is reused. With no plan, the existing canonical new-plan behavior is used.
- Duplicate and target-plan checks are repeated on a fresh read immediately before writing.
- Catalog price is reused when resolved. Otherwise `PRICE_UNRESOLVED` stays explicit; no amount is inferred.

## Security and Data Health

Clinical capability is checked at planning and execution. Patient identity is rebound to the original text/context, target-plan ambiguity is rechecked for TOCTOU, model output cannot supply authoritative ids, and invalid/cross-tenant/tampered inputs fail closed.

`MISSING_TOOTH_REFERENCE` covers pending as well as completed plan items with no tooth. Workflow G updates the same item later and clears the signal on the next scan.

No database migration or dependency change is required.
