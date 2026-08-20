# POL-RBAC-001 — Local validation

Status: `PASSED_LOCAL_ONLY`

## Environment

- Image: `public.ecr.aws/supabase/postgres:17.6.1.159`
- Network: loopback-only disposable container
- Data: ten synthetic users, two synthetic studios and two synthetic patients; no production data
- Migration order: synthetic bootstrap → existing Fisio schema → POL-RBAC-001

## Results

- SQL regression passed for two-tenant isolation, suspended user, owner without clinical access, front desk, general clinician without inferred Fisio rights, physiotherapist, PT, massage therapist and PT+massage multi-role.
- Negative escalation passed: front desk cannot self-grant; cross-tenant capability resolution is empty; cross-tenant patient relationship write fails; PT/massage cannot update physiotherapy plans; intervention authorship is server-enforced.
- Physiotherapist can read/write evaluation and complete the existing plan lifecycle.
- PT/massage can read only the operational path and document their own diary activity.
- Original POL-UI-002 Node suite: 20/20 passed. New capability tests: 6/6 passed.
- Supabase database lint: no schema errors.
- Vite production build: passed; existing pdfjs eval and chunk-size warnings remain.
- No remote Supabase command, production query, deployment or merge occurred.
