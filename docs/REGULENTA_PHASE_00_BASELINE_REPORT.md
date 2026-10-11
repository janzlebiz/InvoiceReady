# REGULENTA — Corrected Phase 00 Baseline Audit Report

**Audit Type**: Source Code & Security Audit Correction  
**Repository Root Report**: `docs/REGULENTA_PHASE_00_BASELINE_REPORT.md`  
**Preserved Previous Report**: `app/applet/docs/REGULENTA_PHASE_00_BASELINE_REPORT.md`  
**Timestamp**: 2026-10-11T11:53:00Z  
**Runtime Environment**: Node.js `v22.23.2` | npm `10.9.8` | Bun Lockfile `bun.lock`  
**Release Gate Verdict**: **BLOCKED** (P0 security & processing defects verified in source code)

---

## 1. Executive Summary & Report Discrepancy Note

This corrected Phase 00 report replaces the previous summary by performing exact symbol, file, and SQL object source code inspections across the workspace repository. 

**Explanation of Discrepancy**:
The previous report relied primarily on automated behavioral test suite outputs (`npm run test` and `npm run test:migrations`), which executed against mock/PGlite simulations and test bypasses (`FORCE_SUPABASE_TESTS` unset). Direct source code inspection reveals multiple critical P0 defects in production execution paths that were masked by test stubs.

---

## 2. Detailed Audit Matrix

| Audit Item | Target File / Symbol | Exact Source Evidence | Audit Status |
| :--- | :--- | :--- | :---: |
| **1. `mockInvoice` & Fabricated Data** | `src/services/scanService.ts`<br>`(processScan)` | Lines 122–165 construct `mockInvoice` with hardcoded seller/buyer tax IDs, totals, and currency, evaluating rules against fake invoice facts and setting `scan.status = 'COMPLETED'`. | **FAIL** |
| **2. Synchronous Direct API Processing** | `app/api/scans/[scanId]/process/route.ts` | Line 35 directly calls `await ScanService.processScan(...)` in the HTTP POST handler, completely bypassing `JobQueue` and returning synchronous scan JSON. | **FAIL** |
| **3. GET Handler PDF Generation & Storage Side-Effects** | `app/api/scans/[scanId]/report/pdf/route.ts` | Lines 28–56 render a PDF, upload it to Supabase Storage, and upsert records into `scan_reports` on every GET request. | **FAIL** |
| **4. Supabase Client Scoping & Auth** | `src/auth/serverAuth.ts`<br>`src/services/supabaseClient.ts` | `serverAuth.ts` uses shared singleton client `getSupabase()` rather than a request-scoped client with caller JWT. `supabaseClient.ts` returns `false` for `isSupabaseConfigured()` in `test` mode. | **FAIL** |
| **5. Compatibility Views DDL & RLS** | `supabase/migrations/202610100001`<br>`202610100006` | All 5 compatibility views (`users`, `scans`, `documents`, `reports`, `consents`) are created WITHOUT `WITH (security_invoker = true)`, running under owner context and bypassing base table RLS. | **FAIL** |
| **6. Dev Auth & Synthetic Owner Reachability** | `src/auth/serverAuth.ts` | Lines 27–42 contain dev mode fallback when Supabase is unconfigured, allowing client `x-organization-id` header selection and returning `OWNER` role. | **PARTIAL** |
| **7. Document State Machine Verification** | `src/services/scanService.ts` | `processScan()` does not inspect `scan.status`, `scan.storage_path`, or security inspection records; missing or rejected documents still reach `COMPLETED`. | **FAIL** |
| **8. Queue Worker Completion Bypass** | `src/services/jobQueue.ts`<br>`(enqueueWorker)` | Lines 47–56 directly update `scan_sessions.status = 'COMPLETED'` when `shouldUseSupabaseDirectly()` is true, skipping rule evaluation entirely. | **FAIL** |
| **9. Test Runner Fail-Closed Behavior** | `scripts/test-migrations.ts` | Line 275+ checks required environment credentials and calls `process.exit(1)` on missing variables or failed assertions. | **PASS** |
| **10. Migration Directory & Commit Alignment** | `supabase/migrations/` | Inspected root versioned migrations `0001` through `0006`. | **PASS** |

---

## 3. P0/P1 Deficiency Inventory

### P0-1: Fabricated Invoice Facts in Production Pipeline
- **File**: `src/services/scanService.ts`
- **Impact**: Real documents are ignored; `processScan()` generates synthetic invoice data (`Al-Noor Technologies Trading LLC`, `Customer Corp`) and computes compliance scores against fake data.

### P0-2: Cross-Tenant Compatibility View Isolation Leak
- **File**: `supabase/migrations/202610100001_authoritative_schema.sql` & `202610100006_reconcile_views_and_indexes.sql`
- **Impact**: Views `public.documents`, `public.reports`, `public.consents`, `public.users`, and `public.scans` lack `WITH (security_invoker = true)`. Authenticated queries against views bypass underlying table RLS policies.

### P0-3: Direct Processing & Durable Queue Bypass
- **File**: `app/api/scans/[scanId]/process/route.ts` & `src/services/jobQueue.ts`
- **Impact**: API route processes scans synchronously inline. When `enqueueWorker` is invoked in Supabase mode, it directly updates scan status to `COMPLETED` without processing the pipeline.

### P0-4: Non-Idempotent Report GET Endpoint
- **File**: `app/api/scans/[scanId]/report/pdf/route.ts`
- **Impact**: GET request modifies database state and storage buckets on every invocation.

---

## 4. Release Decision

```text
RELEASE READY Status: BLOCKED
```

**Reason**: Production execution paths contain P0 defects including fabricated invoice evaluation (`mockInvoice`), cross-tenant compatibility view isolation leaks (missing `security_invoker = true`), queue worker processing bypasses, and non-idempotent report generation.
