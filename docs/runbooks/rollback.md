# Rollback runbook — policy

Every change must define a reversal before deployment.

Application rollback should identify the last known-good commit and hosting deployment, verify database compatibility, and preserve evidence. Database rollback must never default to destructive down migrations: prefer forward corrective migrations, backups, feature disabling, or compatibility changes approved by the Product Owner and database owner.

Before any rollback:
- stop and identify impact;
- preserve logs and deployment identifiers;
- confirm tenant/data implications;
- confirm application/database version compatibility;
- obtain the required Product Owner gate;
- execute through the authorized operator;
- validate with smoke and integrity checks;
- document the result.

POL-001 performs no deployment and needs no runtime rollback.
