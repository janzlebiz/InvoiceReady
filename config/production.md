# InvoiceReady v1.0 Production Architecture & Trust Controls Specification

## 1. Cloud SQL PostgreSQL (Authoritative Datastore)
- **Role**: The sole authoritative state store for organizations, users, scans, documents, job queue states, consents, privacy requests, and audit logs.
- **Connection**: Connect via Cloud SQL Auth Proxy Unix Domain Socket (`/cloudsql/PROJECT:REGION:INSTANCE`) or IAM database authentication.
- **Multi-Tenancy**: All queries enforce strict tenant boundary isolation: `WHERE organization_id = $X`.
- **Integrity**: Full foreign key cascading, unique constraints on `(organization_id, user_id)`, and retention timestamp indexes.
- **Zero In-Memory Fallback**: No `Map` collections or `/tmp` JSON files exist in production execution paths.

## 2. Server-Side Authentication & Tenant Resolution
- **Identity Provider**: Real Firebase Authentication verified on server via `firebase-admin/auth`.
- **Flow**:
  1. Client sends Bearer ID token.
  2. Server invokes `adminAuth.verifyIdToken(token)` cryptographically.
  3. Server queries PostgreSQL `users` and `organization_users` to derive `user_id`, `organization_id`, and `role`.
  4. Test token generation (`POST /api/auth/token`) is hard-disabled in production (`403 Forbidden`).

## 3. Google Cloud Storage (Quarantine & Private Buckets)
- **Quarantine Bucket (`GCS_QUARANTINE_BUCKET`)**: Uploads are initially written here in an isolated state.
- **Private Bucket (`GCS_PRIVATE_BUCKET`)**: Uploads are promoted here only after the security inspection returns `passed: true`.
- **Signed URLs**: Clients never receive raw `gs://` or internal paths; downloads are served via short-lived signed URLs (15–30 min expiration).
- **Physical Deletion**: On scan deletion or retention expiry, objects are permanently unlinked via Cloud Storage API.

## 4. Asynchronous Queue & Idempotent Worker Processing
- **Queue**: Durable job states tracked in PostgreSQL `job_queue` table with attempt counts and operation IDs.
- **Idempotency**: Clients pass `x-idempotency-key`. Duplicate requests for completed operations return the cached result immediately; in-flight operations return `202 Accepted`.
- **Worker Execution**: Worker handles Gemini AI extraction, statutory normalization, deterministic rule validation, 100-point dimensional scoring, and persistent PDF report generation.

## 5. Document Retention Lifecycle
- **Scheduler**: Cloud Scheduler invokes `POST /api/jobs/retention` with authorization header or `x-cloudscheduler`.
- **Policy**: Invoices are subject to a 24-hour retention TTL (`retention_expires_at`).
- **Audit**: Every purged document produces an append-only audit event in PostgreSQL (`DOCUMENT_RETENTION_PURGED`).

## 6. Security Scanning & Exploit Prevention
- **Antivirus Scanner Abstraction**: Production scanner engine interface with threat classification.
- **Structural Exploit Analysis**:
  - PDFs: Inspected for embedded `/JavaScript`, `/Launch`, `/EmbeddedFiles`.
  - Spreadsheets: Inspected for macros (`vbaProject.bin`) and DDE injection.
  - Executables: Prohibited DOS MZ and ELF binaries quarantined immediately.
