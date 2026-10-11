# REGULENTA — Phase 00 BASELINE: Baseline & Repository Audit Report

**Date/Timestamp**: 2026-10-11T18:44:20Z  
**Runtime**: Node.js `v22.23.2` | npm `10.9.8` | Bun Lockfile (`bun.lock`, `sha256: 0e74e6c38210137351ad21199a4e3bdc60f2d4e8c5643a6d713bd73df5a6b093`)  
**Applet ID**: `00878803-e807-4d3a-bdd1-8f75bfc410ed`  
**Supabase Instance**: `https://zgoehrmlejmehmiccete.supabase.co`

---

## 1. Environmental & Repository Inventory

### A. Environment Baseline
- **Node.js**: `v22.23.2`
- **npm**: `10.9.8`
- **Lockfile**: `bun.lock`
- **Lockfile SHA-256**: `0e74e6c38210137351ad21199a4e3bdc60f2d4e8c5643a6d713bd73df5a6b093`
- **Version Control**: Workspace export snapshot (git environment uninitialized in preview runtime)

### B. Versioned Migration Inventory (`supabase/migrations/`)
1. `202610100001_authoritative_schema.sql` (20,834 bytes) — Base relational schema & RLS tables.
2. `202610100002_security_and_storage.sql` (10,861 bytes) — Storage buckets & initial security policies.
3. `202610100003_enable_rls_explicitly.sql` (880 bytes) — Explicit RLS enabling across all tables.
4. `202610100004_drop_rogue_policies.sql` (1,245 bytes) — Hardening & policy cleanup.
5. `202610100005_schema_verification_rpc.sql` (1,401 bytes) — `get_schema_verification()` schema RPC.
6. `202610100006_reconcile_views_and_indexes.sql` (5,867 bytes) — Hardened compatibility views with `security_invoker = true`.

### C. Active API Route Inventory (`app/api/`)
- `/api/health`: Healthcheck & dependency status.
- `/api/extract`: PDF binary extraction & document parsing.
- `/api/scans`: List scan sessions and submit new scan job.
- `/api/scans/[scanId]`: Fetch scan session detail.
- `/api/scans/[scanId]/documents`: Fetch/upload scan document artifacts.
- `/api/scans/[scanId]/process`: Trigger durable processing job.
- `/api/scans/[scanId]/report/pdf`: Download rendered assessment PDF report.
- `/api/tests/run`: Internal test suite runner endpoint.

---

## 2. Code Audit & Security Invariant Checks

| Check / Code Inventory Item | Code Audit Result | Findings / Status |
| :--- | :--- | :--- |
| **`mockInvoice` usage** | **0 instances found** | No mock invoice generators or hardcoded invoice data in production paths. |
| **Fabricated defaults / fake extraction** | **0 instances found** | Extraction strictly requires real PDF bytes or binary input. |
| **Unconditional `COMPLETED` transitions** | **0 instances found** | Scan status transitions strictly depend on pipeline processing success. |
| **Compatibility Views DDL** | **`security_invoker = true`** | All 5 compatibility views (`documents`, `reports`, `consents`, `users`, `scans`) invoke caller RLS. |
| **Request-Scoped Auth** | **Verified** | Server auth constructs authenticated Supabase client carrying caller JWT. |
| **Storage Security** | **Private buckets** | `quarantine`, `invoices`, and `reports` configured as private with RLS policies. |

---

## 3. Baseline Test Suite Results

### A. Behavioral & Security Test Suite (`npm run test`)
- **Total Executed**: 43 tests
- **Passed**: 43
- **Failed**: 0
- **Duration**: ~6,793 ms
- **Key Categories Verified**:
  - `SEC-AUTH`: JWT token cryptography & bearer enforcement.
  - `SEC-EXTRACT-INTEGRITY`: Byte-level SHA-256 hash mismatch rejection.
  - `SEC-STORAGE-OWNERSHIP`: Cross-tenant prefix signed URL rejection.
  - `PROC-QUEUE-SUPERVISOR-RECOVERY`: Stale lease recovery and supervisor claiming.
  - `E2E-REAL-BINARY-PDF-EXTRACTION`: Real binary PDF stream parsing via `pdf-parse`.

### B. Migration & Target Schema Test Suite (`npm run test:migrations`)
- **Total Executed**: 4 tests
- **Passed**: 4
- **Failed**: 0
- **Verification Targets**:
  1. `FRESH-DATABASE-MIGRATION-001` (PGlite Local Simulation) — **PASS**
  2. `EXISTING-DATABASE-UPGRADE-001` (PGlite Legacy Upgrade) — **PASS**
  3. `MIGRATION-REPEATABILITY-001` (PGlite Idempotency) — **PASS**
  4. `LIVE-SUPABASE-SCHEMA-VERIFY-001` (Remote Live Supabase Target Schema Inspection) — **PASS**

---

## 4. Summary & Phase Execution Acceptance

The Phase 00 baseline audit confirms:
1. Environment baseline, lockfile hash, migration inventory, and route maps are recorded.
2. All compatibility views strictly enforce `security_invoker = true`.
3. Production execution paths contain zero fabricated invoice mocks or unconditional completion shortcuts.
4. Baseline test suites (both local behavioral tests and live remote Supabase schema checks) exit zero with 100% pass rates.

**Acceptance Status**: Phase 00 Baseline Complete.
