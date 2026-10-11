# REGULENTA — Phase 01 AUTH: Authentication & Tenant Authorization

Execute Phase 01 only.

Do not implement later phases, run the final release gate, or declare release readiness.

Fix request-scoped authentication and tenant authorization. Review `verifyServerAuth` and all protected routes. Use a request-scoped Supabase client carrying the verified caller JWT, or a narrowly authorized privileged membership lookup based only on verified identity. Never use a shared anonymous client for identity-dependent authorization.

Derive user ID, organization membership, and role server-side. Never trust `organization_id` headers or request fields. Reject mismatches. Prevent UUID-guessing cross-tenant access.

Protect scan/document/report/correction/processing/deletion/admin operations. Prevent clients from changing scores, findings, remediation, inspection status, report status, scan status, job state, or organization ownership.

Test unauthenticated, invalid/expired JWT, valid user, mismatched organization, Org B→Org A, authorized Org A positive controls, lower-role privilege escalation, and same-tenant result/job tampering.

ACCEPTANCE: identity and membership are server-derived; positive and negative authorization tests pass; no shared anonymous authorization path remains.

STOP and report files changed and tests executed.
