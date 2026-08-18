# Incident response runbook

For suspected tenant leakage, privilege escalation, patient-data exposure, financial corruption, webhook abuse, or production outage:

1. Stop automated changes and preserve evidence.
2. Notify the Product Owner and named security/production owner through the approved private channel.
3. Record time, environment, symptoms, affected tenant scope, deployment/commit, and reporter.
4. Do not paste secrets or PHI into issues, chats, logs, or public repositories.
5. Contain only through authorized, reversible actions; do not improvise production SQL.
6. Preserve database, Auth, Edge Function, hosting, and audit logs according to policy.
7. Validate whether tenant isolation, RLS, claims, Storage, or RPC are involved.
8. Coordinate required legal/privacy assessment with the Product Owner.
9. Restore service through the approved deployment/rollback procedure.
10. Write a blameless post-incident record and create separately approved remediation tasks.

Agents may gather read-only evidence within authorization but may not rotate credentials, disable users, alter RLS, or change production without explicit incident authority.
