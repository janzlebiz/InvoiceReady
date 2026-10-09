# REGULENTA — Remediation Status Ledger

**Release Status:** **BLOCKED**  
**Audited Baseline:** `aa43b6142ff63ef9659fd9c30f151caae8302486`  
**Behavioral Reference:** `286033cfacf34e4cd421408616e729d81c1ff912`  
**Current Branch:** `remediation/phase-1-auth-rbac-rls`  
**Baseline Commit:** `aaa8971` (representing audited baseline)  
**Working Tree State:** Clean  

---

## Final Phase 1 Security Corrections Record

Per the REGULENTA Final Phase 1 Security Corrections directive:
- **Authentication and RBAC:** Removed all default role assignments and fallbacks in `src/auth/serverAuth.ts`. Fails closed with strict 401/403 status codes on any missing, invalid, or unverified token, absent membership, database error, or unrecognized role.
- **Extraction API (`/api/extract`):** Refactored `app/api/extract/route.ts` to require `scanId` and `documentId`. Verifies scan existence, organization ownership, and `SECURITY_PASSED` status. Retrieves stored document bytes exclusively through server-side storage access (`ScanService.getStoredFileBuffer`), verifying hash provenance and rejecting client-supplied raw text.
- **Database Security & RLS:** Comprehensive RLS policies and table grants defined in `supabase/migrations/202610100001_security_and_storage.sql` covering all 12 tenant-owned tables and Supabase Storage `storage.objects`.
- **Storage and Reports:** Enforced server-controlled tenant paths (`<organization_id>/<scan_id>/<object_id>`) in `src/services/supabaseStorage.ts`, private buckets (`quarantine`, `invoices`, `reports`), and durable upload/signing verification.
- **Verification Commands & Outcomes:**
  - `npm run build`: **PASS** (Exit code 0, Next.js production build succeeded).
  - `npm run lint` (`tsc --noEmit`): **PASS** (Exit code 0, zero type errors).
  - Behavioral Test Suite (`TestRunner.runBehavioralTestSuite()`): **PASS** (46/46 passed).
  - Live Supabase RLS & Storage integration tests: **BLOCKED** (Pending approved live Supabase test project credentials).

---

## Remediation Ledger & Test Matrix

| Finding / Req ID | Severity | Category | Affected Component / Files | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-001** | P0 | Authentication | `src/auth/serverAuth.ts`, `app/api/**` | **IMPLEMENTED / BLOCKED (Live)** | Fail-closed token and membership verification implemented; live validation pending approved project. |
| **SEC-002** | P0 | Tenant Isolation | `src/auth/serverAuth.ts`, `app/api/extract/route.ts`, API routes | **IMPLEMENTED / BLOCKED (Live)** | Strict tenant ownership and authorized server-side byte extraction enforced; live RLS validation pending approved project. |
| **SEC-003** | P0 | RBAC & Permissions | `src/auth/serverAuth.ts`, mutation routes | **IMPLEMENTED / BLOCKED (Live)** | Strict RBAC enforcement without default fallback; live test pending approved project. |
| **SEC-004** | P0 | PostgreSQL RLS | `supabase/schema.sql`, migrations | **BLOCKED** | Migration `202610100001_security_and_storage.sql` created; execution pending approved project. |
| **SEC-005** | P0 | Supabase Storage | `src/services/supabaseStorage.ts`, download routes | **IMPLEMENTED / BLOCKED (Live)** | Tenant-scoped paths (`org_id/scan_id/obj_id`) and strict error handling implemented; live validation pending approved project. |
| **SEC-006** | P0 | Processing State Machine | Scan/document services, process route, worker | **BLOCKED** | Fail-closed state machine requires durable DB status and scanner checks. |
| **SEC-007** | P0 | Malware Inspection | `malwareScanner.ts`, `securityScanner.ts`, worker | **BLOCKED** | Requires deployed malware scanning service (e.g. ClamAV). |
| **DATA-001** | P1 | Durable Persistence | `scanService.ts`, PostgreSQL repositories | **BLOCKED** | Replacement of process-local Maps with Supabase PostgreSQL tables. |
| **DATA-002** | P1 | Storage & Error Handling | Document repository, storage service, upload route | **BLOCKED** | Requires atomic upload-to-quarantine and promotion workflow. |
| **FUNC-001** | P1 | Jurisdiction Preservation | `App.tsx`, questionnaire validators, scan routes | **BLOCKED** | Preserving AE vs PH questionnaire snapshots without default substitution. |
| **FUNC-002** | P1 | Manual Corrections | `ExtractionReview.tsx`, correction API/service, worker | **BLOCKED** | Fact correction persistence, versioning, and reevaluation queueing. |
| **AI-001** | P1 | Gemini Validation | `geminiExtractor.ts`, canonical validators, worker | **BLOCKED** | Strict canonical schema validation and uncertainty preservation. |
| **AI-002** | P1 | Document Parsing | `documentParser.ts`, upload validator | **BLOCKED** | Robust PDF parsing without binary text fallback. |
| **RULE-001** | P1 | Rule Engine | `ruleEngine.ts`, applicability engine, registry | **BLOCKED** | Deterministic business rules executed server-side with pinned pack. |
| **RULE-002** | P1 | Rule-Pack Provenance | Registry, scan creation, worker, report service | **BLOCKED** | Pinned pack version and immutable provenance metadata. |
| **SCORE-001** | P1 | Versioned Scoring | `scoringEngine.ts`, worker/orchestration | **BLOCKED** | Pinned pack configuration, weights, caps, and review semantics. |
| **DATA-003** | P1 | Findings & Remediations | Rule result mapping, database repositories | **BLOCKED** | Transactional persistence of complete findings and remediations. |
| **REPORT-001** | P1 | Report Lifecycle | PDF service, worker, report repository, PDF route | **BLOCKED** | Durable authorized report generation and private storage publication. |
| **ASYNC-001** | P1 | Durable Queue & Worker | Process route, queue repository, `src/worker/**` | **BLOCKED** | Independently deployed Node.js worker and PostgreSQL durable queue. |
| **ASYNC-002** | P1 | Retries, Leases, Recovery | Queue repository, worker execution/recovery | **BLOCKED** | Transactional leasing (`FOR UPDATE SKIP LOCKED`), jittered backoff, idempotency. |
| **API-001** | P1 | Missing APIs | `app/api/scans/**`, `app/api/auth/me` | **BLOCKED** | Restore authorized scan listing, status polling, and deletion endpoints. |
| **LIFE-001** | P1 | Retention Enforcement | Retention worker/service, storage repositories | **BLOCKED** | Automated expiry enforcement and physical object cleanup. |
| **LIFE-002** | P1 | Permanent Deletion | Delete route/service, storage cleanup | **BLOCKED** | Immediate access revocation and asynchronous physical cleanup. |
| **PRIV-001** | P1 | Consent & Privacy | `PrivacyCenter.tsx`, privacy routes, export/erasure | **BLOCKED** | Durable consent persistence, data export, and tenant erasure. |
| **AUDIT-001** | P1 | Append-Only Audit | Audit repository, mutation transactions, worker | **BLOCKED** | Server-derived actor/tenant audit event emission and authorized read. |
