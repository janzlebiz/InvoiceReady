# REGULENTA — Architecture Alignment Report
**Target Architecture**: Next.js (App Router) + Supabase (Auth, PostgreSQL, Storage) + Vercel + Gemini AI

## 1. Executive Architecture Summary
All legacy Google Cloud (Cloud Tasks, Google Cloud Storage, Cloud Run, Cloud SQL) and Firebase (Firebase Auth, firebase-admin) dependencies have been completely removed from production workflows.
The sole authoritative production stack is:
- **Framework & Hosting**: Next.js 16+ App Router hosted on Vercel.
- **Database**: Supabase PostgreSQL with strict Row Level Security (RLS) policies.
- **Authentication**: Supabase Auth (server-side verification via `supabase.auth.getUser()`).
- **Object Storage**: Supabase Storage private buckets (`invoices`, `reports`, `quarantine`) with tenant-scoped paths (`<org_id>/<scan_id>/<object_id>`).
- **AI Extraction**: Google GenAI SDK (`@google/genai`) for structured invoice extraction.

## 2. Legacy Dependency Removal Evidence
| Component Removed | Replaced By | Status |
| :--- | :--- | :--- |
| **Google Cloud Tasks** (`@google-cloud/tasks`, `CloudTasksClient`, OIDC) | Supabase PostgreSQL state tracking & synchronous durable processing | **REMOVED** |
| **Google Cloud Storage** (`@google-cloud/storage`, `CloudStorageService`) | Private Supabase Storage (`supabaseStorage.ts`, `invoices`, `reports`, `quarantine`) | **REMOVED** |
| **Firebase** (`firebase`, `firebase-admin`, `firebaseClient.ts`) | Supabase Auth (`@supabase/supabase-js`, `serverAuth.ts`) | **REMOVED** |
| **Cloud SQL / PGlite Split** | Authoritative Supabase PostgreSQL (`SupabaseDbService`) | **REMOVED** |
| **Infra Directory** (`infra/` GCP shell/yaml scripts) | Direct Vercel + Supabase deployment model | **REMOVED** |

## 3. Verification Commands & Results
- **Production Build**: `npm run build`
  - Outcome: **PASS**
- **TypeScript Typecheck**: `npm run lint`
  - Outcome: **PASS**
- **Live Supabase Integration**: `npm run test:supabase`
  - Outcome: **PASS**
- **Behavioral Test Suite**: `npm run test`
  - Outcome: **FAIL** (3/49 failures identified)
  - Remaining Blockers:
    - Foreign key constraints in `job_queue` due to missing scan record in test data.
    - `SEC-DOC-DELETED-001` - physical deletion verify failure.
    - `OIDC-REJECT-EXPLICIT-IDENTITY-001` - OIDC strict identity check.

## 4. Remaining Tasks for Release Gate
- Fix behavioral test data setup in `src/engine/testRunner.ts`.
- Finalize storage physical deletion logic to ensure prompt deletion.
- Verify OIDC strict identity logic.
- Final release validation.

## 4. Current Environment Configuration (`.env.example`)
```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```
