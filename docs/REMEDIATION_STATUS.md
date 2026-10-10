# REGULENTA — Phase 1 Release Gate Evidence Report

## 1. Live Integration Results & Evidence (Supabase Project: `zgoehrmlejmehmiccete`)
- **Credentials Validation**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` successfully loaded and verified.
- **Unauthenticated RLS Enforcement**: **PASS** (Direct anonymous queries to `scan_sessions` return empty sets under active RLS).
- **Private Storage Buckets**: **PASS** (Buckets `invoices`, `reports`, and `quarantine` verified present and strictly private `public = false`).
- **Cryptographic Storage Roundtrip**: **PASS** (Uploaded file payload to tenant-prefixed storage path, downloaded, and verified exact SHA-256 digest match; test object cleanly deleted).
- **Database Schema Audit**: Base tables (`organizations`, `profiles`, `organization_users`, `business_profiles`, `system_profiles`, `scan_sessions`, `findings`, `remediations`, `audit_logs`) are verified active. Table `scan_documents` pending migration execution.

## 2. Locally Executed Checks & Evidence
- **Build (`npm run build`)**: **PASS** (Next.js Turbopack production build compiled with zero errors).
- **Lint (`npm run lint`)**: **PASS** (`tsc --noEmit` clean, zero type diagnostics).
- **Behavioral & Unit Suite (`npm run test`)**: **PASS** (Deterministic rule pack validation, security scanners, fail-closed secret checks pass).
- **Live Supabase Test Script (`npm run test:supabase`)**: **PASS** (Live connection, bucket privacy, and cryptographic storage roundtrip validated).

## 3. Remaining Action Item
- **Migration Application**: Run `supabase/migrations/202610100001_security_and_storage.sql` in your Supabase project's SQL Editor (or sync via the GitHub connected branch) to add the `scan_documents` and `scan_reports` tables to the PostgREST schema cache.
