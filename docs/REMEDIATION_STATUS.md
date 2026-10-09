# REGULENTA — Remediation Status Ledger

**Release Status:** **BLOCKED**  
**Audited Baseline:** `aa43b6142ff63ef9659fd9c30f151caae8302486`  
**Behavioral Reference:** `286033cfacf34e4cd421408616e729d81c1ff912`  
**Current Branch:** `remediation/phase-1-auth-rbac-rls`  
**Baseline Commit:** `aaa8971` (representing audited baseline)  
**Working Tree State:** Clean  

---

## Phase 1 Security Remediation Rework Record

Per the Phase 1 Security Remediation Rework directive:
- **SEC-001 (Authentication):** **FAILED** — Fail-closed verification implemented in `src/auth/serverAuth.ts` (removed all synthetic preview users, default organization/role assignments, and substring matching). Live verification against an approved Supabase project remains `BLOCKED`.
- **SEC-002 (Tenant Isolation):** **FAILED** — Strict tenant verification enforced across all protected routes (`/api/scans`, `/api/scans/[scanId]`, `/api/scans/[scanId]/documents`, `/api/scans/[scanId]/process`, `/api/scans/[scanId]/report/pdf`, `/api/extract`). Live PostgREST RLS multi-tenant testing remains `BLOCKED`.
- **SEC-003 (RBAC & Permissions):** **FAILED** — Server-side role derivation enforced without fail-open fallback. Live privilege escalation testing remains `BLOCKED`.
- **SEC-004 (PostgreSQL RLS):** **BLOCKED** — Security migration `supabase/migrations/202610100001_security_and_storage.sql` created; execution against live Supabase project remains `BLOCKED`.
- **SEC-005 (Supabase Storage):** **FAILED** — `src/services/supabaseStorage.ts` updated to enforce mandatory tenant path scoping (`<org_id>/<scan_id>/<object_id>`), private buckets, no local fallbacks, and strict error propagation. Live bucket policy verification remains `BLOCKED`.

---

## Remediation Ledger & Test Matrix

| Finding / Req ID | Severity | Category | Affected Component / Files | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-001** | P0 | Authentication | `src/auth/serverAuth.ts`, `app/api/**` | **FAILED** | Fail-closed token verification implemented; live validation pending approved Supabase project. |
| **SEC-002** | P0 | Tenant Isolation | `src/auth/serverAuth.ts`, scan/document services, API routes | **FAILED** | Strict tenant checks enforced in routes; live RLS validation pending approved project. |
| **SEC-003** | P0 | RBAC & Permissions | `src/auth/serverAuth.ts`, mutation routes | **FAILED** | Strict RBAC enforcement without fallback; live test pending approved project. |
| **SEC-004** | P0 | PostgreSQL RLS | `supabase/schema.sql`, migrations | **BLOCKED** | Migration `202610100001_security_and_storage.sql` created; execution pending approved project. |
| **SEC-005** | P0 | Supabase Storage | `src/services/supabaseStorage.ts`, download routes | **FAILED** | Tenant-scoped paths and strict error handling implemented; live validation pending approved project. |
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
