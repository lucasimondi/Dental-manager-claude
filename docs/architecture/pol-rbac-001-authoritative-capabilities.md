# POL-RBAC-001 — Authoritative tenant capabilities

Status: `WAITING_PRODUCT_OWNER`

## Compatibility contract

`studio_users.ruolo` remains unchanged. Active legacy `admin` memberships resolve four server-derived capabilities: `studio.owner`, `studio.manage_members`, `finance.management.read` and `home.owner`. This preserves current owner/admin behavior without inserting rows or changing legacy values. No clinical capability is derived from `admin`, `utente`, studio vertical, profile text or user-editable metadata.

Explicit assignments are stored in `studio_user_capabilities` by `(studio_id,user_id,capability)`. Allowed assignments are:

- `home.front_desk`
- `clinical.general`
- `clinical.physiotherapist`
- `clinical.personal_trainer`
- `clinical.massage_therapist`

Assignments are additive, support multi-role users and require an active target membership. Only an active legacy admin, resolved server-side as `studio.manage_members`, may assign or revoke them. Suspended membership disables derived and explicit capabilities without deleting history.

`get_my_studio_capabilities_v1(studio_id)` is the client contract. It uses `auth.uid()`, active membership and tenant identity on the server. The Home never infers a preset from `ruolo` or vertical.

## Fisio access matrix

| Capability | Evaluation | Physiotherapy plan/goals/prescriptions | Operational path | Own diary activity | Finalize plan |
|---|---|---|---|---|---|
| `clinical.physiotherapist` | read/write | read/write | read/write | write | yes |
| `clinical.personal_trainer` | none | read-only authorized path | read-only | insert/update own | no |
| `clinical.massage_therapist` | none | read-only authorized path | read-only | insert/update own | no |
| `home.front_desk` | none | none | none | none | no |
| owner/admin without clinical assignment | none | none | none | none | no |

Finalization uses the existing `physio_piani.stato='completato'`; no new clinical field or meaning is invented. PT and massage therapist are shown a read-only operational summary plus their activity diary. They do not query evaluations and cannot mount plan/goal/prescription editors.

Every Fisio policy requires an active same-tenant capability. Write checks also prove that `paziente_id`, exercise and prescription relationships belong to the row's `studio_id`. Triggers overwrite `created_by` from `auth.uid()` on insert and preserve it on update, preventing author spoofing.

## POL-UI-002 alignment

Preset priority for an explicitly multi-capable user is owner, then clinical/operational, then front desk. Personal and studio layout precedence remains unchanged. Capability filtering still runs after layout resolution, so a persisted hidden/unauthorized widget ID cannot trigger a backend call.

Management-control widgets require `finance.management.read` plus the existing plan feature. Missing RPC, inactive membership or absent capability results in no financial call.

## Rollback boundary

No automatic destructive rollback is provided. A controlled rollback must first restore the seven prior Fisio policies from the immediately preceding schema version, then remove the two author triggers, capability functions/policies/table and added indexes in dependency order. Rolling back only the table/functions while leaving capability-aware client or Fisio policies would fail closed and is not a valid rollout. Production rollback requires a separate Product Owner gate.
