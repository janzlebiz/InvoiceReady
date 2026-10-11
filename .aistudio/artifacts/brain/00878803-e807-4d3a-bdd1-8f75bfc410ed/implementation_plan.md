# REGULENTA — Phase 01 AUTH: Authentication & Tenant Authorization Plan

## User Intent & Requirements Synthesis
The goal of Phase 01 AUTH is to harden request-scoped authentication and multi-tenant authorization across all protected API routes in InvoiceReady without implementing later phases, running final release gates prematurely, or declaring release readiness.

Key Guardrails & Requirements:
1. **Request-Scoped Identity Resolution**: Instantiate a request-scoped Supabase client carrying the verified caller's JWT (`Bearer <token>`) for all identity-dependent authorization and database queries. Eliminate any usage of shared anonymous clients for authorization.
2. **Server-Derived Identity & Membership**: Derive `user_id`, `organization_id`, and user `role` strictly on the server from verified token claims and DB memberships. Never trust `organization_id` headers or request payload fields. Reject mismatches and prevent UUID-guessing cross-tenant access.
3. **Route Protection & Mutation Integrity**: Enforce authorization across scan, document, report, correction, processing, deletion, and admin operations. Prevent clients from illegally tampering with scores, findings, remediation, inspection status, report status, scan status, job state, or organization ownership.
4. **Comprehensive Test Suite**: Execute API route authorization tests and the live Supabase RLS integration suite covering:
   - Unauthenticated requests (401)
   - Invalid or expired JWTs (401)
   - Valid user positive controls (200/201)
   - Mismatched or caller-forged `organization_id` inputs (400/403)
   - Cross-tenant access (Org B user requesting Org A resources) (403/404)
   - Lower-role privilege escalation attempts (403)
   - Same-tenant job/result state tampering (403)

---

## Proposed Changes File by File

### 1. `src/services/supabaseClient.ts`
- Export `createRequestScopedClient(jwt: string)` function:
  - Instantiates a new Supabase client instance configured with `global.headers.Authorization = 'Bearer ' + jwt`.
  - Ensures queries made with this client execute under the verified caller's Postgres RLS security context.

### 2. `src/auth/serverAuth.ts`
- Refactor `verifyServerAuth(req: Request)`:
  - Extract `Authorization` header (`Bearer <token>`). Reject missing or malformed headers with 401.
  - Verify caller JWT using `createRequestScopedClient(token).auth.getUser(token)`. Reject invalid/expired tokens with 401.
  - Query organization membership for the verified `user.id` using the request-scoped client.
  - If request body or headers contain an `organization_id`, verify that the caller is an active member of that target organization. If not, reject with 403 Forbidden.
  - Derive `userId`, `organizationId`, and `role` server-side and return `AuthContext` containing the request-scoped Supabase client.
  - Remove all production-reachable synthetic owner fallbacks and developer identity shortcuts in production mode.

### 3. Protected API Routes
- **`app/api/scans/route.ts`**:
  - Integrate request-scoped `verifyServerAuth`. Pass the request-scoped client to scan queries and creations.
- **`app/api/scans/[scanId]/process/route.ts`**:
  - Enforce server-derived auth. Validate caller's membership in the scan's owning organization before queueing or processing.
- **`app/api/scans/[scanId]/report/pdf/route.ts`**:
  - Require verified JWT in GET request. Verify caller belongs to scan's organization prior to fetching or generating PDF reports.
- **`app/api/scans/[scanId]/route.ts` & Deletion/Admin Routes**:
  - Secure DELETE and state updates: verify role permissions (e.g. admin/owner) before allowing deletion or administrative operations.

### 4. Test Suite Enhancements
- **`scripts/test-supabase-integration.ts`**:
  - Expand test matrix to validate:
    1. Unauthenticated route access (401)
    2. Invalid/expired JWT access (401)
    3. Valid caller positive authorization (200)
    4. Mismatched `organization_id` header or body forged input (403)
    5. Org B token accessing Org A scan / document / report (403/404)
    6. Viewer role attempting admin/deletion action (403)
    7. Client attempting state/score tampering on scan or job state (403)
- **`app/api/tests/run/route.ts`**:
  - Wire unit/integration tests to verify route-level auth checks.

---

## Verification Plan

### Automated Testing
1. Run API route authorization tests:
   `npx tsx scripts/test-supabase-integration.ts`
2. Run unit & behavioral integration suite:
   `npm test`

### Manual Verification & Scope Guardrails
1. Verify no shared anonymous client is used for identity-dependent checks.
2. Confirm all tests pass for negative (401/403/404) and positive (200) scenarios.
3. Keep release status `BLOCKED` as instructed; do NOT run `final-gate.sh` or declare Phase 00/01 complete until user approves.