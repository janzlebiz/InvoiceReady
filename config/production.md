# InvoiceReady v1.0 Production Architecture & Trust Controls Specification
Approved Architecture: Next.js + Supabase + Vercel

## 1. Supabase PostgreSQL (Authoritative Datastore)
- **Role**: The sole authoritative state store for organizations, profiles, scans, documents, findings, remediations, consents, and audit logs.
- **Connection**: Connect via Supabase client with PostgreSQL Row Level Security (RLS) enforcement.
- **Multi-Tenancy**: All queries enforce strict tenant boundary isolation: `WHERE organization_id = $X` and RLS policies on `organization_users`.
- **Integrity**: Full foreign key cascading, unique constraints on `(organization_id, user_id)`, and retention timestamp indexes.
- **Zero In-Memory Fallback**: No `Map` collections or `/tmp` JSON files exist in production execution paths.

## 2. Server-Side Authentication & Tenant Resolution
- **Identity Provider**: Supabase Authentication verified on server via `supabase.auth.getUser(token)`.
- **Flow**:
  1. Client sends Bearer session token.
  2. Server invokes `supabase.auth.getUser(token)` cryptographically.
  3. Server queries Supabase `organization_users` to derive `user_id`, `organization_id`, and `role`.
  4. Fails closed with 401/403 on missing token, invalid session, or unverified organization membership.

## 3. Supabase Storage (Quarantine, Invoices & Reports Buckets)
- **Quarantine Bucket (`quarantine`)**: Uploads are initially written here in an isolated private state.
- **Invoices Bucket (`invoices`)**: Verified documents promoted here with tenant path scoping (`<organization_id>/<scan_id>/<object_id>`).
- **Reports Bucket (`reports`)**: Generated PDF audit reports stored privately with 30-day retention.
- **Signed URLs**: Clients never receive direct public URLs; downloads are served via short-lived signed URLs (15–60 min expiration).
- **Physical Deletion**: On scan deletion or compensating rollback, objects are permanently unlinked via Supabase Storage API.

## 4. Assessment Processing & Durable State Tracking
- **State Tracking**: Scans progress durably through `CREATED` -> `SECURITY_PASSED` -> `COMPLETED` / `REVIEW_REQUIRED` in `scan_sessions`.
- **Pipeline Execution**: Validates SHA-256 byte integrity, extracts canonical schema via Gemini AI (`@google/genai`), executes deterministic rule packs (UAE / PH), computes 100-point scorecards, and persists to PostgreSQL.
- **Compensating Rollback**: Automatic cleanup of storage objects and session metadata reset on partial failure.

## 5. Security Scanning & Exploit Prevention
- **Structural Exploit Analysis**:
  - PDFs: Inspected for embedded `/JavaScript`, `/Launch`, `/EmbeddedFiles`.
  - Spreadsheets: Inspected for macros (`vbaProject.bin`) and DDE injection.
  - Executables: Prohibited DOS MZ and ELF binaries rejected immediately.
- **Cryptographic Integrity**: SHA-256 computed on bytes at upload and re-verified prior to extraction and processing.
