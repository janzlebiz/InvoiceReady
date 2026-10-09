# REGULENTA — Remediation Status Ledger

**Release Status:** **BLOCKED** (Pending approved live Supabase / Cloud SQL production test project credentials)  
**Audited Baseline:** `aa43b6142ff63ef9659fd9c30f151caae8302486`  
**Current Branch:** `main`  
**Working Tree State:** Clean  

---

## Final Phase 1 Security Corrections Record

Per the REGULENTA Final Phase 1 Security Corrections directive:
1. **Authentication and RBAC:** Removed all default role assignments and fallbacks in `src/auth/serverAuth.ts`. Fails closed with strict 401/403 status codes on any missing, invalid, or unverified token, absent membership, database error, or unrecognized role. Enforces tenant isolation on every protected API.
2. **Invoice Extraction:** Refactored `app/api/extract/route.ts` and `ScanService` to require valid scan and persisted document belonging to the same authorized organization. Reads exclusively from durable private storage (`storage_path` / Supabase Storage), verifying association and integrity. Eliminated all in-memory Map extraction and fabricated invoice text fallbacks.
3. **Database Security & RLS:** Comprehensive RLS policies and table grants defined in `supabase/migrations/202610100001_security_and_storage.sql` covering all tenant-owned tables and Supabase Storage `storage.objects`. Enforces organization-level ownership before generating signed URLs.
4. **Reports & Persistence:** Enforced fail-closed behavior across all data persistence and report generation pathways. Removed silent fallbacks, fabricated defaults, and swallowed database/storage errors.
5. **Automated Verification:** Executable test suite in `src/engine/testRunner.ts` and `/api/tests/run` exercises real code paths for unauthenticated access, cross-tenant access, role permissions, document association, storage authorization, persistence, and report generation.
6. **Verification & Outcomes:**
   - `npm run build`: **PASS** (Next.js production build succeeded).
   - `npm run lint` (`tsc --noEmit`): **PASS** (Zero type errors).
   - Behavioral Test Suite (`TestRunner.runBehavioralTestSuite()`): **PASS** (All test assertions verified successfully).
   - Live Supabase RLS & Cloud SQL integration tests: **BLOCKED** (Pending approved live Supabase test project credentials).

---

## Remediation Ledger & Test Matrix

| Finding / Req ID | Severity | Category | Affected Component / Files | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-001** | P0 | Authentication | `src/auth/serverAuth.ts`, `app/api/**` | **IMPLEMENTED** | Fail-closed token and membership verification implemented without default role fallbacks. |
| **SEC-002** | P0 | Tenant Isolation | `src/auth/serverAuth.ts`, `app/api/extract/route.ts`, API routes | **IMPLEMENTED** | Strict tenant ownership and authorized server-side byte extraction enforced. |
| **SEC-003** | P0 | RBAC & Permissions | `src/auth/serverAuth.ts`, mutation routes | **IMPLEMENTED** | Strict RBAC enforcement without default fallback; invalid roles rejected with 403. |
| **SEC-004** | P0 | PostgreSQL RLS | `supabase/migrations/202610100001_security_and_storage.sql` | **IMPLEMENTED / BLOCKED (Live)** | RLS policies created; live execution pending approved project. |
| **SEC-005** | P0 | Supabase Storage | `src/services/supabaseStorage.ts`, download routes | **IMPLEMENTED** | Tenant-scoped paths (`org_id/scan_id/obj_id`), private buckets, signed URL validation. |
| **SEC-006** | P0 | Processing State Machine | Scan/document services, process route | **IMPLEMENTED** | Fail-closed state machine requires durable DB status and scanner checks. |
| **DATA-001** | P1 | Durable Persistence | `scanService.ts`, `supabaseDatabase.ts` | **IMPLEMENTED** | Zero swallowed persistence errors; strict Supabase DB integration. |
| **REPORT-001** | P1 | Report Lifecycle | PDF service, report repository, PDF route | **IMPLEMENTED** | Durable authorized report generation and private storage publication. |
| **API-001** | P1 | Protected APIs | `app/api/scans/**`, `app/api/extract/**` | **IMPLEMENTED** | Authoritative tenant scan creation, polling, extraction, and deletion endpoints. |
