# POL-002A — function access matrix

This matrix covers functions verified by the Tech Lead metadata or directly referenced by the repository. It is not a complete production function inventory.

## Authenticated only — grant change prepared

| Function | Intended caller | Internal authorization | Prepared grant |
|---|---|---|---|
| `is_studio_admin()` | authenticated RLS/application paths | active matching admin membership | revoke PUBLIC/anon; authenticated only |
| `gdpr_esporta_paziente(bigint,uuid,uuid)` | authenticated studio admin | wrapper validates JWT tenant and active admin | authenticated only |
| `gdpr_cancella_paziente(bigint,uuid,uuid,boolean)` | authenticated studio admin | wrapper validates JWT tenant and active admin | authenticated only |
| `admin_delete_studio` | authenticated super-admin | existing `is_super_admin()` check reported | revoke PUBLIC/anon; authenticated only |
| `admin_get_ai_usage` | authenticated super-admin | existing admin check must remain | revoke PUBLIC/anon; authenticated only |
| `admin_list_studios` | authenticated super-admin | existing `is_super_admin()` check reported | revoke PUBLIC/anon; authenticated only |
| `admin_remove_studio_user` | authenticated super-admin | existing admin check must remain | revoke PUBLIC/anon; authenticated only |
| `admin_update_studio` overloads | authenticated super-admin | existing `is_super_admin()` check reported | revoke PUBLIC/anon; authenticated only |
| `admin_update_studio_user_role` | authenticated super-admin | existing admin check must remain | revoke PUBLIC/anon; authenticated only |
| `set_agente_azione` | authenticated tenant/admin flow | existing body remains authoritative | revoke PUBLIC/anon; authenticated only |
| `set_multi_operatore` | authenticated tenant/admin flow | existing body remains authoritative | revoke PUBLIC/anon; authenticated only |

## Intentionally public — unchanged

The migration deliberately does not change grants for:

- `register_studio`;
- `info_studio_pubblico`;
- `prenota_slot_pubblico`;
- `slot_occupati_pubblico`;
- `tipi_prenotabili_online`;
- remote consent and remote clinical-history token flows, including the verified repository names `info_link_firma_consenso`, `info_link_storia_clinica`, `registra_firma_consenso`, and `completa_storia_clinica_remota`.

Anonymous intent does not prove sufficient internal authorization. Token validation, expiry, rate limiting and data minimization remain separate review items.

## Trigger/internal only — change prepared

Every `public.set_updated_at` overload receives an empty explicit search path and loses direct EXECUTE for PUBLIC, anon and authenticated. Trigger invocation does not require client EXECUTE.

The renamed GDPR implementations (`__pol002a_original`) lose all client EXECUTE grants and remain reachable only through the guarded wrappers.

## Verified but unchanged

- `get_kpi_periodo(uuid,date,date)`
- `get_costo_orario(uuid)`

Their tenant-or-superadmin checks were verified. Regression tests cover wrong-tenant denial and correct-tenant callability.

## Unresolved

A full list of all production SECURITY DEFINER functions and ACLs is still unavailable in Git. Functions not named above are unchanged. Future work must classify every remaining function from a complete sanitized catalog before changing grants or moving functions to a non-exposed schema.
