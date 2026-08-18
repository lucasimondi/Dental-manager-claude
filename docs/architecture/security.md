# Security — current state

Security is primarily enforced by Supabase Auth, PostgreSQL RLS, RPC permissions, Storage policies, and Edge Functions. Most of those production definitions are absent from the repository and cannot yet be audited or reproduced.

Known risks from the approved audit:
- fixed tenant fallback in the client;
- unversioned core RLS, grants, functions, Auth triggers, Storage policies, and Edge Functions;
- broad Physio `FOR ALL` tenant policies without role separation;
- ID-only Physio foreign keys allow possible cross-tenant references;
- registration calls an anonymous studio RPC before Auth signup and is not demonstrably atomic;
- missing membership may be treated as original-owner/admin;
- invite and role workflows depend on browser calls and unversioned backend behavior;
- localStorage may contain drafts with health data;
- no repository-defined audit trail, retention policy, or complete security headers;
- no automated RLS or role-escalation tests.

Never include production patient data in extraction artifacts. Store secrets only in approved secret managers or local ignored environment files. A publishable Supabase key is not a server secret, but service-role keys, database passwords, access tokens, signing secrets, and dumps are sensitive.
