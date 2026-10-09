# REGULENTA — Remediation Status Ledger

**Release Status:** **BLOCKED**  
**Audited Baseline:** `aa43b6142ff63ef9659fd9c30f151caae8302486`  
**Behavioral Reference:** `286033cfacf34e4cd421408616e729d81c1ff912`  
**Current Branch:** `remediation/phase-1-auth-rbac-rls`  
**Baseline Commit:** `aaa8971` (representing audited baseline)  
**Working Tree State:** Clean  

---

## Phase 0 Safety Correction & Execution Record

- **Deviation Corrected:** Initial Phase 0 report incorrectly classified build/lint static check success as proof of complete regression safety and HTTP behavior.
- **Evidence Classification Correction:** `npm run build` and `npm run lint` establish TypeScript compilation and Next.js static asset optimization success only. They **do not** prove HTTP route authentication, live Supabase RLS isolation, Storage permissions, malware scanning, or production readiness.
- **Branch Establishment:** Created and checked out dedicated remediation branch `remediation/phase-1-auth-rbac-rls` preserving all existing codebase files and remediation documents (`docs/remediation.md`, `docs/AI_STUDIO_REMEDIATION_MASTER_PROMPT.md`, `docs/REMEDIATION_STATUS.md`).

---

## Phase 1 Implementation & Verification Record

- **SEC-001 (Authentication):** **IMPLEMENTED / BLOCKED (Live)** — Server-side token verification implemented in `src/auth/serverAuth.ts` and integrated across all protected Next.js API routes (`/api/scans`, `/api/scans/[scanId]`, `/api/scans/[scanId]/documents`, `/api/scans/[scanId]/process`, `/api/scans/[scanId]/report/pdf`). Live execution evidence against a real Supabase Auth project remains `BLOCKED`.
- **SEC-002 (Tenant Isolation):** **IMPLEMENTED / BLOCKED (Live)** — Strict organization ID enforcement and cross-tenant checks implemented across all API handlers. Live multi-tenant RLS acceptance verification remains `BLOCKED`.
- **SEC-003 (RBAC & Permissions):** **IMPLEMENTED / BLOCKED (Live)** — Server-side role derivation (`VIEWER`, `ANALYST`, `ADMIN`, `OWNER`) enforced on mutation routes. Live privilege escalation testing remains `BLOCKED`.
- **SEC-004 (PostgreSQL RLS):** **NOT STARTED / BLOCKED (Live)** — Ordered Supabase migrations pending approved test project execution.
- **SEC-005 (Supabase Storage):** **IMPLEMENTED / BLOCKED (Live)** — Storage service paths bound to server-controlled tenant scope (`organization_id/scan_id/...`) and private buckets. Live bucket policy verification remains `BLOCKED`.

---

## Remediation Ledger & Test Matrix

| Finding / Req ID | Severity | Category | Affected Component / Files | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-001** | P0 | Authentication | `src/auth/serverAuth.ts`, `app/api/**` | **IMPLEMENTED / BLOCKED (Live)** | Server-side bearer token verification implemented; live Supabase Auth test pending approved project. |
| **SEC-002** | P0 | Tenant Isolation | `src/auth/serverAuth.ts`, scan/document services, API routes | **IMPLEMENTED / BLOCKED (Live)** | Tenant ownership check enforced in routes; live RLS verification pending approved project. |
| **SEC-003** | P0 | RBAC & Permissions | `src/auth/serverAuth.ts`, mutation routes | **IMPLEMENTED / BLOCKED (Live)** | Role checks (`ANALYST`, `ADMIN`, `OWNER`) enforced; live RBAC test pending approved project. |
| **SEC-004** | P0 | PostgreSQL RLS | `supabase/schema.sql`, database migrations | **BLOCKED** | Requires ordered execution of schema migrations on approved Supabase test project. |
| **SEC-005** | P0 | Supabase Storage | `src/services/supabaseStorage.ts`, download routes | **IMPLEMENTED / BLOCKED (Live)** | Private bucket path structure enforced; live bucket policy verification pending approved project. |
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
