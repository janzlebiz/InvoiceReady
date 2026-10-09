# REGULENTA — Phase 1 Security Corrections Implementation Plan

This implementation plan addresses the Phase 1 Security Corrections specified for REGULENTA:
1. **Branch & Repository Reconciliation:** Ensure branch `remediation/phase-1-auth-rbac-rls` is correctly tracked and reconciled without modifying `main`.
2. **Authentication & RBAC Enforcement:** Eliminate default role fallbacks and fail closed when membership, token, or role cannot be verified.
3. **Tenant Isolation & Extraction Security (`/api/extract`):** Require `scanId` and `documentId`, resolving authorized stored document bytes server-side. Reject arbitrary client-supplied raw text.
4. **PostgreSQL RLS Policies:** Implement comprehensive table-level RLS policies and grants across `organizations`, `organization_users`, `profiles`, `scan_sessions`, `scan_documents`, `processing_jobs`, `findings`, `remediations`, `scan_reports`, `privacy_consents`, `privacy_requests`, and `audit_logs`.
5. **Supabase Storage & Report Verification:** Enforce tenant-scoped `storage.objects` policies for `quarantine`, `invoices`, and `reports`, requiring authorization before creating signed URLs and verifying durable report storage persistence.
6. **Executable Negative Tests:** Implement automated negative security tests covering invalid authentication, missing membership, cross-tenant access, RBAC escalation, RLS, and Storage permissions.

## Proposed Changes

### 1. Auth & RBAC (`src/auth/serverAuth.ts`)
- Ensure strict fail-closed validation on all authentication tokens and database memberships.
- Return structured typed error codes (401 / 403).

### 2. Extraction API (`app/api/extract/route.ts`)
- Refactor `POST /api/extract` to require `scanId` and `documentId`, resolving authorized stored document bytes server-side from `scanService` / storage.
- Reject raw client text input.

### 3. PostgreSQL RLS & Storage Policies (`supabase/migrations/202610100001_security_and_storage.sql`)
- Write comprehensive RLS policies on all 12 tables.
- Add Supabase Storage `storage.objects` tenant policies for `quarantine`, `invoices`, and `reports`.

### 4. Report Persistence (`app/api/scans/[scanId]/report/pdf/route.ts`)
- Ensure PDF report generation verifies durable storage persistence in `reports` before returning authorized download URLs or binary streams.

### 5. Negative Security Tests (`tests/security.test.ts`)
- Add executable test suite exercising unauthenticated requests, forged tokens, cross-tenant access, RBAC violations, and extraction byte verification.

## Verification Plan
- Run `npm run build` and `npm run lint`.
- Execute automated unit and API integration tests.
- Update `docs/REMEDIATION_STATUS.md` with test results and execution evidence.
