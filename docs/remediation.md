# REGULENTA — Executable Security and Migration Remediation Specification

**Release status: BLOCKED**

**Repository:** `janzlebiz/InvoiceReady`  
**Audited baseline:** `aa43b6142ff63ef9659fd9c30f151caae8302486`  
**Behavioral reference:** `286033cfacf34e4cd421408616e729d81c1ff912`

**Target architecture:** Next.js App Router + Supabase Auth + Supabase PostgreSQL + Supabase Storage + Vercel + an independently deployed Node.js worker.

This document specifies required remediation. **No finding is marked fixed.** Existing code, new scaffolding, passing tests, successful builds, comments and UI PASS labels are not acceptance evidence.

## 1. Scope and repository-state qualification

The independent audit established:

- The original test runner returned **45/46 passing**, rather than the claimed 46/46.
- TypeScript checking and a directly invoked production Next.js build passed.
- The existing API validation harness returned **4/9 passing** against the migrated application.
- Production-mode HTTP requests reproduced unauthenticated scan creation, forged-token scan access, unauthenticated extraction and unauthenticated PDF downloads.
- A PH scan without an uploaded document returned `COMPLETED`, an assessment score and AE findings.
- A security-rejected upload could subsequently be processed successfully.
- Scan state disappeared after a process restart.
- Supabase policies permit inappropriate database and storage access.
- Important Express endpoints and durable processing capabilities were not migrated.

Before the instruction to stop repository modification, local remediation work introduced an unverified branch and scaffolding, including:

- `src/server/auth.ts`
- `src/server/database.ts`
- `src/server/storage.ts`
- `src/server/profiles.ts`
- `supabase/migrations/202610100001_security_and_jobs.sql`
- `tests/auth.test.ts`
- `scripts/run.mjs`
- `docs/REMEDIATION.md`
- Changes to `package.json`

These additions were not established as a complete implementation. Their requested executable verification did not run because automatic approval review could not complete after a usage-limit error. **Do not treat the scaffolding as reviewed, connected, tested or production-ready.**

AI Studio must begin by recording the actual checkout, commit, branch and working-tree diff. Review any local scaffolding separately from the audited baseline. Do not silently overwrite it or present it as completed remediation.

The pre-migration Express implementation is a behavioral reference for authorization, tenant derivation, durable operations, reports, deletion, retention and privacy APIs. Its Firebase/GCP mechanisms must not be restored blindly.

## 2. Non-negotiable implementation rules

1. Keep the release BLOCKED throughout implementation.
2. Preserve existing REGULENTA product behavior and deterministic business logic unless a documented security correction requires a change.
3. Do not add unrelated features or redesign the UI.
4. Verify identity using Supabase Auth. Decoding JWT payloads is not authentication.
5. Derive organization membership and role server-side. Never trust client ownership, role, security state, score or billing state.
6. Apply object-level authorization to every scan, document, report, operation, privacy request and audit resource.
7. Use durable PostgreSQL records and Supabase Storage as authoritative state. Process-local Maps and browser storage are not authoritative.
8. Never mark processing complete after a failed prerequisite, failed extraction, failed persistence or failed required report generation.
9. Production acceptance tests must use real dependencies. Mocks, PGlite, development scanner responses and offline fallbacks cannot satisfy them.
10. Preserve missing facts as missing. Do not invent tax identifiers, business identities, dates, currencies, totals, confidence or invoice text.
11. Keep executable rules, scoring, extraction credentials, worker credentials and service-role credentials server-side.
12. Implement small, reviewable changes with relevant regression tests and explicit evidence.
13. Do not apply migrations or run destructive acceptance fixtures against an unidentified or unapproved production project.
14. Label unavailable infrastructure-dependent verification **BLOCKED**, never PASS.
15. Do not use automatic dependency upgrades, blanket audit fixes or weakened security checks to obtain a passing build.

## 3. Required architecture

### 3.1 Next.js API application on Vercel

The API application must:

- Verify the caller through Supabase Auth.
- Resolve authorized organization membership and organization-specific role.
- Validate input against explicit runtime schemas.
- Authorize resources by both identifier and organization.
- Create and retrieve durable scan records.
- Accept uploads through an authenticated, authorized upload workflow.
- Persist upload/security metadata.
- Enqueue durable operations and return `202 Accepted`.
- Provide operation status, authorized reports/downloads, deletion, privacy and audit APIs.
- Never run a permanent queue supervisor inside a Vercel request.
- Never rely on a warm function instance to retain file bytes or scan state.

All protected responses must use appropriate cache controls. Private responses must not enter shared caches.

### 3.2 Supabase PostgreSQL

PostgreSQL must hold:

- Organizations and authoritative memberships.
- User profiles without client-writable privilege fields.
- Business/system questionnaire snapshots.
- Scans with pinned jurisdiction and rule-pack version.
- Documents with immutable object scope, hash and inspection evidence.
- Extraction results and manual correction history.
- Validation results, scoring inputs/results, findings and remediation.
- Durable operations/jobs, attempts, leases and terminal errors.
- Reports and retention metadata.
- Consent events, privacy requests and deletion progress.
- Append-only application audit events.

Related writes must be transactional. Every foreign key linking tenant-owned resources must prevent cross-tenant relationships.

### 3.3 Supabase Storage

Required buckets:

- `quarantine`: private; inaccessible to browser callers.
- `invoices`: private; only approved document objects may be read by authorized callers.
- `reports`: private; only published report objects may be read by authorized callers.

Required object naming:

```text
<organization_uuid>/<scan_uuid>/<object_uuid>
```

Original filenames must be stored as metadata, not trusted as storage paths.

Client-provided bucket names or object paths must never select arbitrary resources.

### 3.4 Independent Node.js worker

The worker must be separately deployed on a host supporting a persistent Node.js process and access to:

- Supabase PostgreSQL.
- Supabase Storage.
- A real malware-scanning service.
- Gemini.
- Required PDF/document-processing libraries.

The worker must claim durable jobs using transactional leasing, process verified documents, persist results and reports, maintain retries, recover abandoned leases and perform retention/deletion work.

A permanently running worker is not provided by a Vercel HTTP function. If an alternative managed queue is chosen, document its delivery, retry, lease and deployment guarantees before implementation.

### 3.5 Privileged access boundary

Browser clients must have no direct write access to authoritative results, security metadata, memberships, job leases or report publication state.

Where API/worker credentials bypass RLS:

- Keep credentials exclusively in server/worker environments.
- Require explicit organization scope on every repository operation.
- Perform membership/role checks before user-initiated privileged writes.
- Recheck authorization inside the transaction where concurrent membership changes matter.
- Restrict database privileges or callable mutation functions where practical.
- Do not equate possession of a service-role client with authorization to a requested object.
- Worker completion writes must require the current valid job lease and matching organization, scan and document.

## 4. Required data model and invariants

Use UUID identifiers consistently for persisted entities.

At minimum, implement or reconcile these logical tables:

| Entity | Required properties |
|---|---|
| `organizations` | UUID identity; controlled provisioning |
| `organization_users` | Organization/user uniqueness; authoritative organization-specific role |
| `profiles` | Identity mirror; restricted editable presentation fields |
| `scan_sessions` | Organization, creator, jurisdiction, questionnaire snapshots, pinned pack, state, result references, retention |
| `scan_documents` | Tenant/scan scope, object UUID/path, filename, MIME, size, hash, inspection state/evidence, retention |
| `processing_jobs` | Tenant/scan/document scope, kind, idempotency key, state, attempts, retry schedule, lease, error code |
| `findings` | UUID, tenant/scan scope, complete finding payload, pack provenance |
| `remediations` | UUID, tenant/scan/finding relationship, complete action payload |
| `scan_reports` | UUID, tenant/scan scope, exact result/pack provenance, object path, publication state, retention |
| `privacy_consents` | User/tenant scope, policy version, accepted preferences, timestamp |
| `privacy_requests` | User/tenant scope, request kind, lifecycle, completion/error evidence |
| `audit_logs` | Server-derived actor/tenant, action, resource, outcome, timestamp, sanitized metadata |

Required invariants:

- Tenant-owned records cannot have null organization attribution.
- Document, job, finding, remediation and report references cannot connect different tenants.
- Only verified document bytes may enter extraction.
- Processing eligibility requires a durable approved document with an unexpired retention window.
- Jobs reference a specific document version/hash.
- Questionnaire snapshots and pinned pack cannot change silently during processing.
- Corrections are versioned and attributed.
- Completed results cannot be edited directly by clients.
- Report publication cannot precede successful object storage and durable metadata.
- Deletion must hide resources before asynchronous physical cleanup.
- Failed cleanup must retain enough metadata to retry safely.
- Lease expiration prevents a stale worker from publishing results.

Historical rows that violate these invariants must be identified and quarantined from customer-facing processing. Do not invent ownership or silently assign them to a default organization.

## 5. Finding specifications

### SEC-001 — Real Supabase authentication and server-side identity

**Priority:** P0

1. **Finding ID:** SEC-001.
2. **Current implementation/problem:** Protected Next.js handlers do not verify the caller. Production requests without credentials or with forged credentials returned successful responses.
3. **Root cause:** Firebase Express middleware was retained but not replaced with connected Supabase request authentication.
4. **Exact required change:** Introduce one mandatory authentication boundary for protected handlers. Verify the access token using Supabase Auth, such as `auth.getUser(token)`, or a documented cryptographic verification mechanism with issuer, audience, expiry and key validation. Construct a request-scoped client. Reject missing, malformed, forged, expired or invalid credentials. Distinguish authentication rejection from dependency unavailability.
5. **Files/modules likely affected:** Every `app/api/**/route.ts`; `src/server/auth.ts`; `src/services/supabaseClient.ts`; `src/context/AuthContext.tsx`.
6. **Database/schema/RLS changes:** Read the verified user’s membership/profile under appropriate policies. Do not derive identity from writable profile fields or user metadata.
7. **Security requirements:** Decoded JWT claims are untrusted until verified. Never accept test tokens, anonymous identities or client-supplied user IDs as production identity. Enforce documented account-verification requirements.
8. **Required tests:** Actual route tests for valid Supabase authentication and session renewal.
9. **Negative/security tests:** Missing token, malformed token, signature forgery, expired token, wrong issuer/project, revoked session where supported, anonymous/unverified account and Auth outage.
10. **Acceptance criteria:** Every protected route rejects invalid identity before reading or mutating protected resources. Auth outages produce an unavailable response without granting access.
11. **Definition of Done:** All protected handlers use the boundary; real Supabase tests pass; no production test-token path remains.

### SEC-002 — Tenant derivation and object-level authorization

**Priority:** P0

1. **Finding ID:** SEC-002.
2. **Current implementation/problem:** Scans are returned by ID alone; tenant IDs are hardcoded; server calls do not carry the caller’s session.
3. **Root cause:** The migration replaced tenant-scoped persistence with shared Maps and anonymous Supabase calls.
4. **Exact required change:** Resolve organization membership from verified identity. A requested organization is only a selector and must be validated against membership. Require explicit tenant scope on all scan/document/report/job operations. Authorize nested resources against their parent scan and tenant.
5. **Files/modules likely affected:** `src/server/auth.ts`; scan/document/report/operation services; every resource route.
6. **Database/schema/RLS changes:** Non-null tenant columns, organization/user membership uniqueness and composite foreign keys for tenant-linked resources.
7. **Security requirements:** Never use organization IDs from questionnaire objects as authority. Avoid distinguishable cross-tenant existence disclosure. Recheck authorization for privileged transactional mutations.
8. **Required tests:** Authorized access to own organization; legitimate multi-organization selection; membership revocation.
9. **Negative/security tests:** Tenant B using tenant A’s scan, document, report, operation or privacy-request ID; forged organization header; inconsistent parent/child IDs.
10. **Acceptance criteria:** All cross-tenant reads and writes fail; authorized same-tenant behavior survives process restart.
11. **Definition of Done:** Repository/service methods require scope; API and real RLS tests prove isolation.

### SEC-003 — RBAC and privilege-field protection

**Priority:** P0

1. **Finding ID:** SEC-003.
2. **Current implementation/problem:** API roles are unenforced; profile fetch failures assign `OWNER`; users can update their own profile role under current permissions.
3. **Root cause:** UI role display is confused with authoritative authorization, and privilege fields are not protected.
4. **Exact required change:** Use organization membership role as authority. Implement explicit permissions: VIEWER reads; ANALYST creates/uploads/processes/corrects assessments; ADMIN manages approved administrative operations and tenant audit access; OWNER performs owner-only tenant-wide erasure and governance operations. Confirm any product-specific differences against requirements.
5. **Files/modules likely affected:** Auth boundary; mutation routes; `AuthContext.tsx`; `Navigation.tsx`; administrative UI.
6. **Database/schema/RLS changes:** Revoke client writes to membership roles and privileged profile fields. If profile editing remains, grant only approved presentation columns.
7. **Security requirements:** Missing membership/profile data must not elevate privileges. User metadata must not establish roles. Membership changes require controlled administration.
8. **Required tests:** Each permission exercised through actual APIs for each role.
9. **Negative/security tests:** VIEWER mutations; ANALYST audit administration; profile-role changes; membership self-insertion; organization reassignment; forged role fields.
10. **Acceptance criteria:** Unauthorized operations fail regardless of UI visibility; a profile lookup failure grants no administrative access.
11. **Definition of Done:** Permission matrix is documented and enforced in API and database boundaries with real tests.

### SEC-004 — PostgreSQL RLS redesign

**Priority:** P0

1. **Finding ID:** SEC-004.
2. **Current implementation/problem:** Policies allow null-user visibility, arbitrary authenticated scan insertion, unconditional finding/remediation/audit insertion and unrestricted member result updates.
3. **Root cause:** Policies test broad authentication or incomplete ownership rather than tenant and operation authority.
4. **Exact required change:** Replace permissive policies atomically. Grant authenticated users only required reads and narrowly approved edits. Route authoritative mutations through controlled server/worker boundaries. Protect results and security state. Remove null-owner access conditions and unconditional write checks.
5. **Files/modules likely affected:** `supabase/schema.sql`; migration files; database services; live policy tests.
6. **Database/schema/RLS changes:** Explicit grants/revokes; RLS on all tenant-owned tables; pinned `search_path` on SECURITY DEFINER functions; restricted function execution; coherent tenant foreign keys; migration inventory of existing policies and grants.
7. **Security requirements:** Account for PostgreSQL’s OR-composition of permissive policies. A new restrictive-looking policy cannot neutralize an old permissive policy. Ensure helpers do not expose unauthorized memberships.
8. **Required tests:** Real PostgreSQL/PostgREST policy evaluation using anon and authenticated identities.
9. **Negative/security tests:** Cross-tenant SELECT/INSERT/UPDATE/DELETE; null ownership; forged creator; result JSON tampering; findings/audit injection; direct RPC privilege escalation.
10. **Acceptance criteria:** No unauthorized policy/grant combination allows access or mutation. Every sanctioned operation still works.
11. **Definition of Done:** Reviewed migration applies to fresh and upgraded schemas; catalog inspection and adversarial live tests pass.

### SEC-005 — Supabase Storage tenant isolation

**Priority:** P0

1. **Finding ID:** SEC-005.
2. **Current implementation/problem:** Every authenticated user can read all objects in invoice/report buckets; upload policies do not verify tenant/path ownership.
3. **Root cause:** Policies check bucket ID only.
4. **Exact required change:** Keep all buckets private. Use validated UUID-scoped paths. Deny browser quarantine reads and direct authoritative writes. Allow invoice/report reads only through authorized APIs or policies tied to approved durable metadata and organization membership.
5. **Files/modules likely affected:** Storage migrations; `src/server/storage.ts`; document/report download routes; legacy Supabase storage service.
6. **Database/schema/RLS changes:** Object policies joined to clean documents or published reports; matching tenant/scan/path; expiry checks; inventory/removal of conflicting policies.
7. **Security requirements:** No arbitrary bucket/path parameters; short-lived signed URLs issued only after authorization; no raw public URL fallback. Force existing target buckets private rather than leaving their state unchanged on conflict.
8. **Required tests:** Real upload, download and signed-URL access using authorized users.
9. **Negative/security tests:** Tenant B listing/reading/signing tenant A objects; path traversal; forged prefix; quarantine access; unauthenticated access; direct client object insertion/replacement.
10. **Acceptance criteria:** Unauthorized object access fails at Storage and API boundaries; signed URLs expire and reference the intended object.
11. **Definition of Done:** Live bucket configuration and policies are verified; cross-tenant storage tests pass.

### SEC-006 — Fail-closed document processing state machine

**Priority:** P0

1. **Finding ID:** SEC-006.
2. **Current implementation/problem:** Missing or security-rejected documents can produce `COMPLETED` assessments.
3. **Root cause:** Processing does not require an approved durable document and replaces missing bytes with placeholder text.
4. **Exact required change:** Enforce persisted legal transitions. Processing requires an uploaded, durably stored, unexpired, security-approved document. Bind the job to its exact document ID/hash. Reject missing, pending, rejected, failed, expired, purged or deleting documents.
5. **Files/modules likely affected:** Scan/document services; upload/process routes; worker; state schemas.
6. **Database/schema/RLS changes:** Constrained document/scan/job states; transactional enqueue preconditions; immutable approved-document reference.
7. **Security requirements:** No bypass based on caller role, request body or development mode. Repeat validation after worker lease acquisition and before publication.
8. **Required tests:** Valid upload through security approval to queued processing.
9. **Negative/security tests:** Process without upload; after rejection; during scanning; after storage failure; after deletion/expiry; caller-supplied `CLEAN`; concurrent upload/process races.
10. **Acceptance criteria:** Ineligible documents never cause extraction, scoring or completed reports.
11. **Definition of Done:** Actual API and worker tests prove every forbidden transition and valid transition.

### SEC-007 — Actual malware and structural inspection

**Priority:** P0

1. **Finding ID:** SEC-007.
2. **Current implementation/problem:** Development connection errors return CLEAN; production depends on localhost ClamAV without a demonstrated deployment; structural checks are shallow string searches.
3. **Root cause:** Scanner availability and development fallback are mistaken for a real inspection result.
4. **Exact required change:** Require a reachable production scanner. Persist scanner identity, timestamp, document hash and result. Fail closed on timeout, connection error, unexpected output or stale inspection. Validate supported formats, signatures and active-content restrictions before approval.
5. **Files/modules likely affected:** `malwareScanner.ts`; `securityScanner.ts`; upload/security worker; worker deployment configuration.
6. **Database/schema/RLS changes:** Immutable inspection evidence linked to document ID/hash; explicit FAILED/REJECTED states.
7. **Security requirements:** No DevMock CLEAN path in acceptance/production. Apply upload limits before expensive processing. Reject unsupported or structurally invalid files; document scanner protocol and response handling.
8. **Required tests:** Real harmless-file scan, real scanner-delivered EICAR detection and persisted inspection evidence.
9. **Negative/security tests:** Scanner outage/timeout; empty/unrecognized response; executable payload; PDF active content; MIME mismatch; oversized file; malformed document; prompt-injection content.
10. **Acceptance criteria:** Only actual CLEAN inspection of the stored bytes permits promotion/processing.
11. **Definition of Done:** Deployed scanner is verified independently; unavailable scanner tests cannot pass by local signature recognition alone.

### DATA-001 — UUID compatibility and durable scan persistence

**Priority:** P1

1. **Finding ID:** DATA-001.
2. **Current implementation/problem:** Prefixed IDs are written to UUID columns; scans and bytes reside in Maps; database failures can be ignored.
3. **Root cause:** New schema and old identifiers were not reconciled, and memory became authoritative.
4. **Exact required change:** Generate UUIDs for persisted entities. Replace Maps with durable repositories. Persist questionnaire snapshots, state and relationships. Check every database result and transaction outcome.
5. **Files/modules likely affected:** `scanService.ts`; `supabaseDatabase.ts`; new server repositories; `ruleEngine.ts`; schema/migrations.
6. **Database/schema/RLS changes:** UUID-compatible IDs and FKs; non-null ownership; proper uniqueness; historical-row reconciliation.
7. **Security requirements:** No fabricated default owner or tenant during migration. Errors must not become successful API responses.
8. **Required tests:** Create/read/restart/reload; complete persistence; fresh and upgraded schema.
9. **Negative/security tests:** Invalid IDs; database outage; insert failure; transaction rollback; partial result writes; incompatible historical records.
10. **Acceptance criteria:** All authoritative state survives restarts and failed writes produce failure responses.
11. **Definition of Done:** No customer-path Map/localStorage fallback remains; real database tests pass.

### DATA-002 — Durable document storage and error propagation

**Priority:** P1

1. **Finding ID:** DATA-002.
2. **Current implementation/problem:** Upload can return a path after failure; attachment treats it as success; processing cannot reload stored bytes.
3. **Root cause:** Paths are treated as evidence of stored objects and bytes remain process-local.
4. **Exact required change:** Persist upload intent, write quarantine bytes, read/verify stored bytes and hash, inspect, then promote. Persist each step. On failure, retain recoverable cleanup metadata and an explicit failure state.
5. **Files/modules likely affected:** Document repository; storage service; upload route; scanner worker.
6. **Database/schema/RLS changes:** Document lifecycle, hash, size, MIME, bucket/path, inspection and cleanup metadata.
7. **Security requirements:** Approval must refer to the same immutable bytes eventually processed. Prevent concurrent overwrite/replacement.
8. **Required tests:** Actual storage write/read/hash verification and restart recovery.
9. **Negative/security tests:** Storage write/read failure; promotion failure; hash mismatch; replacement attempt; database failure after upload; cleanup failure.
10. **Acceptance criteria:** No durable object means no approved document or successful assessment.
11. **Definition of Done:** Real storage failure tests prove correct states and safe recovery without swallowed errors.

### FUNC-001 — Jurisdiction and questionnaire preservation

**Priority:** P1

1. **Finding ID:** FUNC-001.
2. **Current implementation/problem:** Processing discards submitted profiles and substitutes AE defaults, including for PH scans.
3. **Root cause:** The process request omits profiles and the handler invents replacements.
4. **Exact required change:** Validate questionnaire input at creation; persist complete accepted answers; load those snapshots during processing. Remove fabricated identity/tax defaults. Reject jurisdiction/profile mismatch.
5. **Files/modules likely affected:** `App.tsx`; profile validators; scan creation/process routes; scan repository.
6. **Database/schema/RLS changes:** Durable business/system snapshots with version/revision and jurisdiction constraints.
7. **Security requirements:** Ignore client tenant IDs and privileged fields. Validate enums, booleans, numeric ranges and jurisdiction-specific values.
8. **Required tests:** AE and PH questionnaire round trips; all supported answers; restart preservation.
9. **Negative/security tests:** PH scan with AE profile; unknown jurisdiction; missing identity; invalid enum/number; forged ownership; post-enqueue profile mutation.
10. **Acceptance criteria:** Worker uses exactly the authorized saved questionnaire revision and selected jurisdiction.
11. **Definition of Done:** End-to-end PH and AE tests prove correct rules, profiles and stored answers.

### FUNC-002 — Manual corrections and review workflow

**Priority:** P1

1. **Finding ID:** FUNC-002.
2. **Current implementation/problem:** Extraction-review edits are discarded by confirmation and are not persisted or rescored.
3. **Root cause:** UI confirmation only navigates to the dashboard.
4. **Exact required change:** Add an authorized correction operation that validates editable factual fields, records before/after evidence and actor, persists a revision and enqueues/reexecutes deterministic evaluation against the pinned pack.
5. **Files/modules likely affected:** `ExtractionReview.tsx`; `App.tsx`; correction API/service; worker.
6. **Database/schema/RLS changes:** Correction revisions, evidence history, actor/timestamp and job revision references.
7. **Security requirements:** Clients may correct facts, not scores, rule outcomes, pack versions or security state. Preserve original extraction evidence.
8. **Required tests:** Correction persistence, restart retrieval and expected rescoring.
9. **Negative/security tests:** Cross-tenant correction; VIEWER correction; score injection; stale revision; invalid factual type; correction during deletion.
10. **Acceptance criteria:** Accepted corrections affect the resulting assessment and remain traceable.
11. **Definition of Done:** UI-to-API-to-worker correction flow passes real end-to-end verification.

### AI-001 — Strict Gemini output validation and uncertainty

**Priority:** P1

1. **Finding ID:** AI-001.
2. **Current implementation/problem:** Validation checks only an object root; defaults invent fields/confidence; heuristic parsing invents issue dates and marks incomplete output extracted.
3. **Root cause:** TypeScript interfaces and prompt instructions are treated as runtime validation.
4. **Exact required change:** Define an executable canonical extraction schema. Validate nested structures, supported enums, finite numbers, dates, nullable fields, line items, evidence and confidence. Reject malformed output. Preserve absent values and unresolved evidence. Remove production heuristic success fallback after model/configuration failures.
5. **Files/modules likely affected:** `geminiExtractor.ts`; canonical validators; `types.ts`; worker; extraction route.
6. **Database/schema/RLS changes:** Store model/version, extraction revision, validation outcome and evidence provenance.
7. **Security requirements:** Treat document/model output as untrusted. No document instruction may control rules or scores. Missing/zero confidence must not be upgraded silently.
8. **Required tests:** Valid model output, nullable fields, confidence boundaries, multi-page evidence and real Gemini extraction.
9. **Negative/security tests:** Invalid JSON; array root; wrong types; NaN/nonfinite values; impossible dates; absent critical evidence; confidence zero; prompt injection; model timeout/quota/error.
10. **Acceptance criteria:** Unvalidated or unresolved critical extraction cannot produce definitive completion/scoring.
11. **Definition of Done:** Schema tests and real model tests pass; production fallback paths cannot fabricate successful extraction.

### AI-002 — Strict document parsing and supported-format handling

**Priority:** P1

1. **Finding ID:** AI-002.
2. **Current implementation/problem:** PDF parse failure falls back to binary UTF-8 text; non-PDF formats are not demonstrated as correctly parsed.
3. **Root cause:** A permissive text fallback conceals parser failure and missing format support.
4. **Exact required change:** Parse supported formats explicitly. Use strict PDF parsing for PDFs. Reject malformed/unreadable formats or enter a documented review/failure state. Implement required OCR/format support only where product requirements demand it; otherwise disclose unsupported formats accurately.
5. **Files/modules likely affected:** `documentParser.ts`; upload validator; extraction service; upload UI messaging.
6. **Database/schema/RLS changes:** Persist detected format and parser outcome/version.
7. **Security requirements:** No binary-to-text fallback for failed PDFs. Bound parsing time, memory, decompression and page count.
8. **Required tests:** Real binary PDFs and each supported structured format; scanned PDFs if supported.
9. **Negative/security tests:** Corrupt PDF; text renamed `.pdf`; empty/scanned unreadable content; archive bomb; unsupported spreadsheet/image; MIME mismatch.
10. **Acceptance criteria:** Parsing failure remains a failure and never yields placeholder invoice facts.
11. **Definition of Done:** Supported-format matrix is accurate and executable parser tests pass.

### RULE-001 — Deterministic Rule Engine preservation

**Priority:** P1

1. **Finding ID:** RULE-001.
2. **Current implementation/problem:** Core rules remain, but migrated orchestration can supply wrong profiles, unchecked facts and incomplete applicability.
3. **Root cause:** Migration testing covered isolated rule helpers rather than authorized production inputs.
4. **Exact required change:** Preserve business-rule semantics; execute only rules from the pinned jurisdiction/version using validated canonical facts and stored questionnaire revisions. Persist applicable, not-applicable and unknown-rule determinations.
5. **Files/modules likely affected:** `ruleEngine.ts`; `applicabilityEngine.ts`; registry/packs; worker.
6. **Database/schema/RLS changes:** Durable applicability and validation results with evaluation input revision.
7. **Security requirements:** AI and client input cannot select outcomes or redefine rules. Unknown applicability must not silently count as compliance.
8. **Required tests:** Behavioral fixtures for existing AE/PH rules and applicability boundaries, compared with reference behavior.
9. **Negative/security tests:** Wrong jurisdiction; unsupported pack; missing applicability inputs; adversarial canonical facts; client-supplied validation results.
10. **Acceptance criteria:** Identical pinned inputs produce identical rule states and scoring inputs.
11. **Definition of Done:** Business-rule regression evidence is reviewed; migration orchestration tests pass.

### RULE-002 — Rule-pack provenance and reproducibility

**Priority:** P1

1. **Finding ID:** RULE-002.
2. **Current implementation/problem:** Metadata says `2026.1-GA` while active evaluations use jurisdiction-specific 2026.2 packs.
3. **Root cause:** Hardcoded version labels are disconnected from actual registry selection.
4. **Exact required change:** Pin the pack at scan creation. Validate pack existence and jurisdiction. Persist actual version and immutable pack/source metadata. Use that exact pack in evaluation, scoring and reports.
5. **Files/modules likely affected:** Registry; scan creation; worker; report service; report UI.
6. **Database/schema/RLS changes:** Required pack/version metadata and result/report revision references.
7. **Security requirements:** No silent fallback to a different pack. Clients cannot overwrite provenance.
8. **Required tests:** Historical-pack replay and consistent scan/result/report versions.
9. **Negative/security tests:** Unknown pack; cross-jurisdiction pack; registry default change mid-job; forged metadata.
10. **Acceptance criteria:** All outputs identify the exact executed pack and remain reproducible.
11. **Definition of Done:** Pack-provenance tests pass and no hardcoded false version remains.

### SCORE-001 — Versioned scoring and review/failure semantics

**Priority:** P1

1. **Finding ID:** SCORE-001.
2. **Current implementation/problem:** Migrated scoring omits pack configuration and processing unconditionally becomes completed.
3. **Root cause:** The worker’s versioned scoring/state behavior was omitted from the new service.
4. **Exact required change:** Load configuration for the pinned pack; apply its dimensions, weights and critical caps. Propagate critical UNKNOWN/REVIEW_REQUIRED evidence. Failed extraction must stop assessment production.
5. **Files/modules likely affected:** `scoringEngine.ts`; worker/orchestration; API serialization.
6. **Database/schema/RLS changes:** Persist scoring inputs, configuration provenance, results and definitive-score-blocked reason.
7. **Security requirements:** No browser score writes. No conversion of null/blocked scores into numeric success defaults.
8. **Required tests:** Critical caps, dimension weighting, partial states, unknown evidence and null-score round trip.
9. **Negative/security tests:** Failed extraction; low-confidence critical field; omitted config; empty applicable set caused by validation errors; score tampering.
10. **Acceptance criteria:** Scores match pinned configuration and unresolved critical evidence blocks definitive output.
11. **Definition of Done:** Behavioral scoring and actual persistence tests pass.

### DATA-003 — Findings and remediation persistence

**Priority:** P1

1. **Finding ID:** DATA-003.
2. **Current implementation/problem:** Finding/action identifiers conflict with UUID columns; write errors are ignored; reconstructed scans omit findings/remediation.
3. **Root cause:** Persistence mappings discard structure and are not transactionally verified.
4. **Exact required change:** Persist complete finding/remediation payloads with valid UUID identities and proper relationships. Save validation, score and related outputs atomically. Rehydrate complete scan results after restart.
5. **Files/modules likely affected:** Rule result mapping; database repositories; scan retrieval; findings/remediation screens.
6. **Database/schema/RLS changes:** Tenant/scan/finding FKs; supported severity/category values; full payload/provenance; transaction boundaries.
7. **Security requirements:** Clients cannot inject or modify authoritative findings/actions. Cross-tenant references must fail.
8. **Required tests:** Complete save/reload; multiple findings/actions; no duplicate results after retry.
9. **Negative/security tests:** Mid-transaction failure; invalid severity; invalid UUID; foreign tenant reference; client direct insert/update.
10. **Acceptance criteria:** Retrieved results are complete and consistent with the committed assessment revision.
11. **Definition of Done:** Real persistence and rollback tests pass without swallowed errors.

### REPORT-001 — Durable, authorized report lifecycle

**Priority:** P1

1. **Finding ID:** REPORT-001.
2. **Current implementation/problem:** Reports are generated on GET, accessible without authorization and can succeed despite storage failure.
3. **Root cause:** Persistent report generation/metadata was replaced with ad hoc rendering.
4. **Exact required change:** Generate reports from committed assessment revisions in the worker. Persist upload intent, actual object and publication metadata. GET must retrieve an authorized published report or report its pending/failure state.
5. **Files/modules likely affected:** PDF service; worker; report repository; PDF route; report UI.
6. **Database/schema/RLS changes:** Report ID, tenant/scan/result revision, pack, object path, lifecycle and retention.
7. **Security requirements:** Short-lived authorized signed URLs; no success fallback after storage failure; no fabricated auditor identity or verification metadata.
8. **Required tests:** Real PDF generation, storage, restart retrieval and provenance consistency.
9. **Negative/security tests:** Tenant B report access; missing report; incomplete scan; storage failure; stale result revision; unsigned/public path access.
10. **Acceptance criteria:** Published reports are durable, authorized and match the committed assessment.
11. **Definition of Done:** Real report lifecycle tests pass; download does not create false publication.

### ASYNC-001 — Durable queue and independent worker

**Priority:** P1

1. **Finding ID:** ASYNC-001.
2. **Current implementation/problem:** `/process` runs synchronously; retained Cloud Tasks code is disconnected; no replacement worker is deployed.
3. **Root cause:** Infrastructure migration removed queue/worker wiring without replacing guarantees.
4. **Exact required change:** Implement a PostgreSQL-backed durable queue and independent Node.js worker, or an explicitly approved equivalent. API enqueue must transactionally validate eligibility, create/reuse a job and return `202` with operation ID.
5. **Files/modules likely affected:** Process route; queue repository; `src/worker/**`; deployment/run scripts.
6. **Database/schema/RLS changes:** Durable jobs, kinds, tenant/document scope, attempts, leases, scheduling and indexes.
7. **Security requirements:** Worker-only lease/completion mutation; no public worker endpoint with forgeable shared identity.
8. **Required tests:** Enqueue, independent execution and durable results across API/worker restarts.
9. **Negative/security tests:** Missing worker; unauthorized enqueue; invalid document; direct job-state changes; queue database failure.
10. **Acceptance criteria:** Processing does not depend on a request staying alive or a warm API instance.
11. **Definition of Done:** Independently hosted worker and real durable queue integration are verified.

### ASYNC-002 — Retries, idempotency, leases and recovery

**Priority:** P1

1. **Finding ID:** ASYNC-002.
2. **Current implementation/problem:** The connected path lacks retries, deduplication, job leases and restart recovery.
3. **Root cause:** Legacy resilience helpers are not invoked by migrated routes.
4. **Exact required change:** Implement atomic claim with `FOR UPDATE SKIP LOCKED` or equivalent; lease token/expiry; heartbeat; bounded attempts; exponential backoff with jitter; explicit retryable/terminal error classes; stable idempotency scope.
5. **Files/modules likely affected:** Queue repository; worker execution/recovery; operation APIs.
6. **Database/schema/RLS changes:** Uniqueness by tenant/scan/operation/request revision; active-job constraint; attempt history; terminal error and lease fields.
7. **Security requirements:** Stale workers cannot publish. Duplicate delivery cannot duplicate results/reports. Expired/rejected inputs cannot be retried into success.
8. **Required tests:** Duplicate concurrent enqueue, worker kill/restart, lease expiry, transient retry and maximum-attempt termination.
9. **Negative/security tests:** Stale lease completion; double claim; changed payload under same key; retry after deletion; unlimited retry; conflicting operations.
10. **Acceptance criteria:** Exactly one committed result per logical operation; abandoned work recovers; exhausted jobs become durable terminal failures.
11. **Definition of Done:** Real multi-process resilience tests pass with recorded attempt/lease evidence.

### API-001 — Missing scan and operation APIs

**Priority:** P1

1. **Finding ID:** API-001.
2. **Current implementation/problem:** Scan listing/deletion, operation status and authenticated context endpoints are absent.
3. **Root cause:** Only a subset of Express routes was ported.
4. **Exact required change:** Restore authenticated scan listing, scan retrieval, deletion request, operation status and `/api/auth/me`. Use explicit response contracts, pagination and terminal-state semantics.
5. **Files/modules likely affected:** `app/api/scans/**`; `app/api/auth/me`; repositories; `App.tsx`.
6. **Database/schema/RLS changes:** Required list/status indexes; durable lifecycle fields.
7. **Security requirements:** Authorize nested operation against scan and tenant; avoid private caching; validate pagination and identifiers.
8. **Required tests:** Listing, status polling, restart recovery and UI terminal handling.
9. **Negative/security tests:** Cross-tenant enumeration; operation/scan mismatch; VIEWER mutation; malformed IDs; pagination abuse.
10. **Acceptance criteria:** Required routes exist and return correct authorized durable state.
11. **Definition of Done:** Actual Next.js HTTP contract tests pass.

### LIFE-001 — Retention enforcement

**Priority:** P1

1. **Finding ID:** LIFE-001.
2. **Current implementation/problem:** UI claims 24-hour document and 30-day result/report retention without a connected purge mechanism.
3. **Root cause:** Cloud Scheduler/GCS lifecycle behavior was not replaced.
4. **Exact required change:** Implement worker/scheduler-driven retention using persisted deadlines. Deny expired access immediately and perform actual object/record cleanup with retryable progress and audit events.
5. **Files/modules likely affected:** Retention worker/service; storage; repositories; retention API if required.
6. **Database/schema/RLS changes:** Retention deadlines, cleanup state and expiry indexes for documents, results and reports.
7. **Security requirements:** Scheduler authentication if an HTTP trigger exists. No public retention execution. Protect active work through documented expiry/cancellation rules.
8. **Required tests:** Clock-boundary expiry and real physical cleanup.
9. **Negative/security tests:** Expired reads; cleanup storage failure; worker restart mid-purge; forged scheduler request; active-job race.
10. **Acceptance criteria:** Expired data cannot be accessed and eventual physical deletion is evidenced.
11. **Definition of Done:** Real retention tests verify metadata, objects and audit outcomes.

### LIFE-002 — Permanent scan/document/report deletion

**Priority:** P1

1. **Finding ID:** LIFE-002.
2. **Current implementation/problem:** “Delete Scan” only clears React state; no migrated physical deletion path exists.
3. **Root cause:** Deletion UI was retained without backend lifecycle.
4. **Exact required change:** Add authorized durable deletion. Mark the scan inaccessible, cancel/prevent processing, delete every associated object, remove required records and retain a minimal allowed audit tombstone. Retry failed cleanup.
5. **Files/modules likely affected:** Delete route/service; worker; storage; `App.tsx`; `ReportScreen.tsx`.
6. **Database/schema/RLS changes:** Deleting state, cleanup job/progress and safe FK behavior.
7. **Security requirements:** Never delete metadata needed to retry object cleanup first. Stale workers must not resurrect deleted data.
8. **Required tests:** Actual object/record deletion and repeated idempotent requests.
9. **Negative/security tests:** Cross-tenant deletion; unauthorized role; partial storage failure; deletion during processing; restart during cleanup; stale signed/object access.
10. **Acceptance criteria:** Deleted resources become inaccessible immediately and physical cleanup completes or remains visibly pending/failed.
11. **Definition of Done:** Real deletion tests pass; UI waits for durable status and does not claim premature completion.

### PRIV-001 — Consent, privacy requests and actual data export

**Priority:** P1

1. **Finding ID:** PRIV-001.
2. **Current implementation/problem:** Consent save changes local flags; export contains notices rather than customer records; privacy APIs are missing.
3. **Root cause:** Product-facing privacy controls were not connected to durable services.
4. **Exact required change:** Persist consent events and policy versions. Restore authorized privacy requests. Export actual permitted customer data, including scan facts/results/corrections and relevant user records. Implement erasure according to approved scope and role.
5. **Files/modules likely affected:** `PrivacyCenter.tsx`; privacy routes/services; deletion/export worker.
6. **Database/schema/RLS changes:** Consent/request lifecycle, actor/tenant attribution and export/deletion completion evidence.
7. **Security requirements:** Export only authorized scope; exclude secrets/internal credentials and other tenants; require OWNER authorization for tenant-wide erasure where appropriate.
8. **Required tests:** Consent persistence, actual export contents, request status and erasure completion.
9. **Negative/security tests:** Cross-tenant export; false completion after failure; unauthorized tenant erasure; sensitive credential inclusion; stale request access.
10. **Acceptance criteria:** UI success corresponds to committed durable operations and exports contain the expected actual records.
11. **Definition of Done:** Real privacy tests pass and product claims match implemented behavior.

### AUDIT-001 — Real append-only audit logging

**Priority:** P1

1. **Finding ID:** AUDIT-001.
2. **Current implementation/problem:** Administrative logs are mock data; clients can insert audit records under permissive policy; migrated mutations lack demonstrated audit coverage.
3. **Root cause:** Audit UI and schema exist without trusted event production.
4. **Exact required change:** Emit server/worker audit events for authorized lifecycle actions, failures, corrections, publication, deletion, retention and privacy operations. Restore authorized administrative audit access.
5. **Files/modules likely affected:** Audit repository; mutation transactions; worker; audit route; `AdminConsole.tsx`.
6. **Database/schema/RLS changes:** Restricted inserts; denied client UPDATE/DELETE; tenant/actor/resource/outcome fields; minimal privacy-preserving retention.
7. **Security requirements:** Server-derived actor and tenant; no invoice contents, tokens, signed URLs or secrets in logs. Handle IP/proxy attribution under documented trusted-host rules.
8. **Required tests:** Events for successful and failed workflows; admin reads.
9. **Negative/security tests:** Client log injection/modification/deletion; cross-tenant audit read; ANALYST access; sensitive-data leakage.
10. **Acceptance criteria:** Displayed audit events are durable and attributable; required mutation/audit consistency is transactional.
11. **Definition of Done:** Mock logs are removed from customer paths and real audit tests pass.

### IP-001 — Proprietary rules and scoring server boundary

**Priority:** P1

1. **Finding ID:** IP-001.
2. **Current implementation/problem:** Client components import a registry that brings executable rule packs into compiled browser assets.
3. **Root cause:** Display metadata and executable regulatory logic share import boundaries.
4. **Exact required change:** Separate safe display metadata from executable packs. Keep rule execution, scoring and source-integrity implementation in server/worker modules. Restore rule/source APIs with approved metadata-only response contracts.
5. **Files/modules likely affected:** Registry/packs; `LandingScreen.tsx`; `AdminConsole.tsx`; rule/source routes; build checks.
6. **Database/schema/RLS changes:** None unless metadata publication requires durable versions.
7. **Security requirements:** Enforce server-only imports where supported. Do not serialize evaluator functions, algorithms or privileged configuration.
8. **Required tests:** Production bundle/import-graph inspection and metadata API rendering.
9. **Negative/security tests:** Client import of evaluator/scoring module; executable function serialization; secret/proprietary marker leakage.
10. **Acceptance criteria:** Compiled browser assets contain approved display metadata only.
11. **Definition of Done:** Build boundary tests and actual client-bundle scans pass.

### OPS-001 — Production configuration and truthful readiness

**Priority:** P1

1. **Finding ID:** OPS-001.
2. **Current implementation/problem:** Production accepts work without Supabase configuration; health always says healthy; connectivity is a string check.
3. **Root cause:** Missing dependencies trigger placeholders/offline behavior rather than explicit unavailability.
4. **Exact required change:** Define mandatory API/worker configuration and validate it. Separate liveness from readiness. Readiness must verify required dependency connectivity/schema and worker heartbeat without exposing secrets.
5. **Files/modules likely affected:** Environment/config modules; health route; API startup/request initialization; worker startup; deployment docs.
6. **Database/schema/RLS changes:** Schema-version and worker-heartbeat evidence if used.
7. **Security requirements:** Keep `DATABASE_URL`, service-role, Gemini and scanner credentials private. Support publishable-key configuration accurately. No automatic success when required dependencies are missing.
8. **Required tests:** Correct configuration, database/schema readiness, Storage access, scanner/model availability and worker freshness.
9. **Negative/security tests:** Missing/placeholder credentials; wrong project; database outage; inaccessible bucket; absent/stale worker; scanner unavailable.
10. **Acceptance criteria:** Requests requiring unavailable services fail closed; readiness cannot report connected without verifying dependencies.
11. **Definition of Done:** Deployment-specific checks pass against the approved real environment.

### OPS-002 — Obsolete Firebase/GCP/PGlite and production fallbacks

**Priority:** P1

1. **Finding ID:** OPS-002.
2. **Current implementation/problem:** Legacy Firebase/GCP services, infrastructure assumptions, PGlite and local mock storage remain alongside migrated services.
3. **Root cause:** Migration added new services without retiring or clearly isolating old production paths.
4. **Exact required change:** Inventory imports and responsibilities. Remove obsolete production wiring/dependencies after replacement behavior is verified. Preserve historical reference through Git. Clearly isolate any retained non-acceptance fixtures.
5. **Files/modules likely affected:** `tokenVerifier.ts`; Firebase/GCS services; legacy PostgreSQL/job queue; `infra/**`; package/lockfiles; old configuration.
6. **Database/schema/RLS changes:** Replace legacy identity references through reviewed data migration, not fabricated attribution.
7. **Security requirements:** No test secret, local storage, PGlite, dev token or DevMock scanner may satisfy production/acceptance execution.
8. **Required tests:** Production import/config audit and real end-to-end execution without legacy environment variables.
9. **Negative/security tests:** Missing Supabase must not activate legacy/local fallback; production startup must reject unsupported fallback settings.
10. **Acceptance criteria:** Target deployment operates exclusively through documented target dependencies.
11. **Definition of Done:** Obsolete production assumptions are removed, dependency changes reviewed and replacement coverage passes.

### TEST-001 — Genuine regression and security verification

**Priority:** P1

1. **Finding ID:** TEST-001.
2. **Current implementation/problem:** Legacy tests omit migrated routes/policies; some tests are hardcoded PASS or duplicated local logic.
3. **Root cause:** Verification labels were trusted without examining tested boundaries.
4. **Exact required change:** Replace misleading assertions with behavioral tests. Maintain separate unit, local HTTP and real Supabase/worker acceptance suites. Remove unsupported “live” claims and static test/traceability success labels.
5. **Files/modules likely affected:** `testRunner.ts`; test modal; traceability matrix; `tests/**`; infrastructure harnesses; CI.
6. **Database/schema/RLS changes:** Isolated real test fixtures and schema validation.
7. **Security requirements:** No production acceptance mocks or local fallbacks. Missing prerequisites must produce BLOCKED with non-success exit status.
8. **Required tests:** Actual Next.js APIs, Supabase Auth, PostgreSQL policies, Storage, worker, parser, Gemini and complete workflows.
9. **Negative/security tests:** All attack/failure cases in this specification; assertions must fail when protections are deliberately broken.
10. **Acceptance criteria:** Test evidence identifies environment, commit, dependencies, commands and actual outcomes.
11. **Definition of Done:** Every P0/P1 requirement maps to executable tests and independently reviewed results.

### OPS-003 — Windows/CI scripts and dependency security

**Priority:** P2

1. **Finding ID:** OPS-003.
2. **Current implementation/problem:** Windows build script fails; no test script existed; audit reports vulnerable legacy dependency chains.
3. **Root cause:** Shell-specific commands and unresolved migration dependencies undermine reproducibility.
4. **Exact required change:** Use portable Node-based task execution or supported cross-platform scripts. Provide unit, acceptance, typecheck, build and worker commands. Review each advisory and update/remove affected dependencies in small changes.
5. **Files/modules likely affected:** `package.json`; lockfiles; `scripts/**`; CI; deployment documentation.
6. **Database/schema/RLS changes:** None.
7. **Security requirements:** No blanket `audit fix --force`; no manually edited dependency resolution; document runtime reachability and remaining risk.
8. **Required tests:** Frozen-lockfile installation, Windows and CI execution, typecheck/build and dependency-specific regression checks.
9. **Negative/security tests:** Missing executable/dependency; nonzero child exit; missing acceptance configuration; scripts incorrectly returning success.
10. **Acceptance criteria:** Commands are reproducible and propagate failures; advisories are resolved or explicitly accepted by the release authority.
11. **Definition of Done:** Lockfile review, clean installation and platform checks pass.

### OPS-004 — Safe, repeatable migrations and historical reconciliation

**Priority:** P2

1. **Finding ID:** OPS-004.
2. **Current implementation/problem:** Schema setup uses non-repeatable policy creation, incompatible existing records and insufficient upgrade evidence.
3. **Root cause:** Fresh-install SQL was treated as a complete migration strategy.
4. **Exact required change:** Implement ordered, versioned migrations with preflight checks, transactional policy replacement, fresh-install and upgrade paths, backups and documented recovery. Reconcile or quarantine invalid historical records explicitly.
5. **Files/modules likely affected:** Schema/migrations; migration runner; setup docs; acceptance fixtures.
6. **Database/schema/RLS changes:** Full security/data upgrade; ownership validation; constraint validation after reconciliation; policy/grant inventory.
7. **Security requirements:** No period of permissive access during rollout; no silent destructive data conversion; no migration applied to an unapproved project.
8. **Required tests:** Fresh database, audited-schema upgrade, repeated runner invocation and rollback on injected failure.
9. **Negative/security tests:** Null ownership; invalid tenant links; existing public buckets; conflicting policies; partial migration; unsupported schema version.
10. **Acceptance criteria:** Migration completes consistently or rolls back safely, with unresolved data explicitly blocking use.
11. **Definition of Done:** Reviewed migration evidence and recovery instructions exist; historical reconciliation is complete or release-blocking.

## 6. Required API contracts

Preserve existing routes where compatible; restore missing behavior without unrelated UI changes.

| Endpoint | Required behavior |
|---|---|
| `GET /api/auth/me` | Verified user and authorized organization-specific role |
| `POST /api/scans` | Validate and persist questionnaire/jurisdiction; return durable UUID |
| `GET /api/scans` | Authorized, paginated tenant scans |
| `GET /api/scans/:scanId` | Complete authorized durable scan state |
| `POST /api/scans/:scanId/documents` | Authorized durable upload/security workflow |
| `GET /api/scans/:scanId/documents/:documentId` | Authorized approved-document access/status |
| `POST /api/scans/:scanId/process` | Validate prerequisites; durable idempotent enqueue; return 202 |
| `GET /api/scans/:scanId/operations/:operationId` | Authorized durable operation state |
| `POST /api/scans/:scanId/corrections` | Validated factual corrections and reevaluation operation |
| `GET /api/scans/:scanId/report/pdf` | Authorized published report access; no generation-as-read fallback |
| `DELETE /api/scans/:scanId` | Durable deletion request and observable cleanup lifecycle |
| `POST /api/privacy/consent` | Durable consent event |
| `POST /api/privacy/requests` | Authorized export/erasure request |
| `GET /api/privacy/requests/:requestId` | Authorized request state/result |
| `GET /api/admin/audit-logs` | Tenant-scoped ADMIN/OWNER audit access |
| `GET /api/rules/packs` | Approved metadata only |
| `GET /api/rules/sources` | Approved source metadata only |
| `GET /api/rules/:jurisdiction` | Approved rule metadata only |
| `GET /api/health` | Clearly defined liveness/readiness; no false connectivity claims |

If `/api/extract` remains, it must authenticate and authorize the associated scan. Production assessment extraction must use approved stored document bytes rather than caller-supplied arbitrary text.

Administrative test execution must not provide an unsafe public production test runner. Use controlled CI/acceptance execution; retain a UI test capability only if required and safely implemented.

## 7. Ordered implementation phases

### Phase 0 — Baseline, requirements and acceptance environment

1. Record actual commit, branch, diff and unverified local scaffolding.
2. Preserve audited and Express references.
3. Map every finding to product requirements and acceptance tests.
4. Identify the approved isolated Supabase project and independent worker host.
5. Configure credentials locally or through secret management.
6. Document migration authorization, fixture cleanup and backup/recovery.
7. Keep all live checks BLOCKED until their prerequisites are satisfied.

### Phase 1 — Close authorization and access-policy gaps

1. Connect verified Supabase authentication to every protected route.
2. Implement authoritative tenant membership and RBAC.
3. Replace unsafe RLS/grants atomically.
4. Protect privilege/result/security fields.
5. Restrict Storage policies and paths.
6. Run actual-route authentication and real cross-tenant/RLS/Storage tests.

**Exit gate:** No P0 access finding is considered closed without real dependency evidence.

### Phase 2 — Establish durable state and security gating

1. Reconcile UUID/schema mappings and historical data.
2. Replace memory/offline persistence.
3. Implement durable upload/quarantine lifecycle.
4. Integrate actual malware inspection.
5. Enforce processing prerequisites and legal transitions.
6. Verify storage/database failures and security rejection.

**Exit gate:** Missing, rejected, unverified or unstored documents cannot produce assessments.

### Phase 3 — Restore authoritative business processing

1. Preserve questionnaire/jurisdiction snapshots.
2. Implement strict document parsing and Gemini validation.
3. Preserve missing facts, uncertainty and evidence.
4. Pin packs and versioned scoring configuration.
5. Persist complete evaluation outputs transactionally.
6. Implement correction history and reevaluation.
7. Verify AE/PH business-rule regressions.

**Exit gate:** Results are correct, durable, reproducible and never fabricated.

### Phase 4 — Deploy durable worker and resilience

1. Implement transactional enqueue and leased job claims.
2. Deploy independent Node worker.
3. Implement heartbeat, backoff, bounded retries and terminal errors.
4. Prevent stale-worker publication.
5. Restore operation/status APIs.
6. Test process kills, duplicate delivery and recovery.

**Exit gate:** Durable multi-process execution survives restarts without duplicate or unauthorized results.

### Phase 5 — Restore lifecycle and customer-data capabilities

1. Implement durable report publication/download.
2. Restore scan listing/deletion.
3. Implement retention and actual physical cleanup.
4. Restore privacy consent, requests, export and erasure.
5. Implement real append-only audit logging.
6. Connect existing UI behavior to durable APIs.

**Exit gate:** Customer-facing success claims correspond to verified committed operations.

### Phase 6 — Remove obsolete paths and harden delivery

1. Remove obsolete production Firebase/GCP/PGlite wiring.
2. Separate proprietary executable rules from browser metadata.
3. Replace misleading tests and static PASS claims.
4. Fix Windows/CI scripts.
5. Review and safely resolve dependency advisories.
6. Validate fresh installation and upgrade migrations.

### Phase 7 — Independent release verification

1. Execute the complete real acceptance matrix.
2. Review code, migrations, privileges and compiled bundles independently.
3. Review unresolved findings and deployment evidence.
4. Record exact commands, versions, fixtures, outcomes and artifact references.
5. Keep release BLOCKED unless every release criterion below is satisfied.

## 8. Exact verification checklist

### Repository and implementation

- [ ] Record audited baseline and implemented commit.
- [ ] Record working-tree changes and review each commit.
- [ ] Confirm no unrelated feature/UI changes.
- [ ] Confirm every protected route invokes verified authentication.
- [ ] Confirm every resource operation enforces tenant/object scope.
- [ ] Confirm organization-specific RBAC is enforced server-side.
- [ ] Confirm no privileged identity derives from user metadata or profile fallback.
- [ ] Confirm no authoritative customer-path Maps/localStorage/PGlite fallback.
- [ ] Confirm no placeholder invoice text or fabricated assessment facts.
- [ ] Confirm every persistence/storage error is checked and propagated.
- [ ] Confirm rules and scoring remain server-side.
- [ ] Inspect compiled browser assets, not only source files.

### Schema, grants and Storage

- [ ] Apply migrations to an approved isolated fresh Supabase database.
- [ ] Apply upgrade migrations from the audited schema.
- [ ] Inspect final table grants, policies and function execution grants.
- [ ] Verify RLS is enabled on all tenant-owned tables.
- [ ] Verify no remaining permissive policy bypass.
- [ ] Verify SECURITY DEFINER functions use pinned search paths.
- [ ] Verify UUID/FK/tenant constraints.
- [ ] Reconcile or quarantine historical invalid rows.
- [ ] Verify all target buckets are private in the actual project.
- [ ] Verify quarantine is inaccessible to browser callers.
- [ ] Verify direct authoritative object writes are denied.
- [ ] Verify signed URLs are authorized, bounded and expiring.

### Processing and lifecycle

- [ ] Verify durable upload and stored-byte hash.
- [ ] Verify actual malware inspection with scanner evidence.
- [ ] Verify only approved stored documents can enqueue.
- [ ] Verify worker rechecks document state/hash/expiry.
- [ ] Verify strict parsing and Gemini schema validation.
- [ ] Verify PH and AE profiles/pack selection.
- [ ] Verify review/failure propagation.
- [ ] Verify versioned scoring and critical gates.
- [ ] Verify transactional findings/remediation persistence.
- [ ] Verify durable report publication.
- [ ] Verify lease heartbeat, stale-worker rejection and restart recovery.
- [ ] Verify retry limits, terminal failures and idempotency.
- [ ] Verify actual deletion and retention cleanup.
- [ ] Verify privacy exports contain authorized actual records.
- [ ] Verify audit events are real, scoped and non-sensitive.

### Executable commands

The implementation must provide these commands or document exact equivalents:

```text
npm ci
npm run test
npm run typecheck
npm run build
npm run test:api
npm run test:acceptance
npm run worker
npm audit --json
```

- [ ] Run installation from a reviewed frozen lockfile.
- [ ] Run unit/regression tests.
- [ ] Run actual Next.js HTTP route tests.
- [ ] Run real Supabase/worker acceptance tests.
- [ ] Run typecheck.
- [ ] Run production build.
- [ ] Run Windows and CI script checks.
- [ ] Review dependency audit output.
- [ ] Confirm every command propagates nonzero failure.
- [ ] Missing real dependencies produce BLOCKED/non-success, not skipped-success.
- [ ] Archive sanitized test evidence with commit and environment identifiers.

## 9. Required test matrix

| Test ID | Scenario | Required environment | Expected evidence |
|---|---|---|---|
| AUTH-01 | Missing credentials on every protected route | Actual Next API | 401; no protected reads/writes |
| AUTH-02 | Forged signature and wrong-project token | Real Supabase + API | Rejected identity |
| AUTH-03 | Expired/invalid session | Real Supabase + API | Rejection; no operation |
| AUTH-04 | Auth dependency unavailable | Controlled real environment | Unavailable response; no granted access |
| TENANT-01 | Tenant B reads tenant A scan | Real Supabase + API | Denied/not found |
| TENANT-02 | Cross-tenant document/report/job IDs | Real Supabase + API + Storage | All denied |
| TENANT-03 | Forged organization/owner fields | Real Supabase + API | Rejected or ignored without unauthorized write |
| RBAC-01 | VIEWER attempts each mutation | Real Supabase + API | Denied |
| RBAC-02 | Direct profile/membership escalation | Real PostgreSQL/PostgREST | Privilege fields unchanged |
| RLS-01 | Anon/authenticated table privilege matrix | Real PostgreSQL/PostgREST | Only permitted operations succeed |
| RLS-02 | Direct score/result/finding/audit tampering | Real PostgreSQL/PostgREST | Denied |
| RLS-03 | Cross-tenant FK references | Real PostgreSQL | Constraint/policy rejection |
| STORE-01 | Tenant B reads/signs tenant A object | Real Supabase Storage | Denied |
| STORE-02 | Quarantine and direct upload/overwrite attempts | Real Supabase Storage | Denied |
| STORE-03 | Signed URL expiry and wrong object | Real Supabase Storage | Correct bounded access |
| GATE-01 | Process without document | Real API + database | No job/result completion |
| GATE-02 | Process rejected/pending/failed document | Real API + worker | Denied; no extraction |
| GATE-03 | Process expired/purged/deleting document | Real API + worker | Denied/cancelled |
| MAL-01 | Harmless document scanned by real daemon | Real scanner + Storage | Actual CLEAN evidence |
| MAL-02 | EICAR delivered through scanner protocol | Real scanner | INFECTED; no processing |
| MAL-03 | Scanner unavailable/timeout | Real infrastructure failure | Fail closed |
| DOC-01 | Stored bytes/hash survive restart | Real Storage + database | Exact matching durable bytes |
| DOC-02 | Storage/database failure during upload | Controlled real failure | Failure state; no false approval |
| PARSE-01 | Real PDF and supported format parsing | Actual parsers | Valid facts and page evidence |
| PARSE-02 | Corrupt/renamed/unreadable document | Actual parsers | Failure/review; no binary-text success |
| AI-01 | Real Gemini extraction | Real Gemini + approved document | Valid canonical schema |
| AI-02 | Malformed/types/confidence/missing-fact validation | Unit plus actual boundary tests | Rejected or preserved uncertainty |
| AI-03 | Gemini outage/quota/timeout | Controlled real failure | Retry/terminal failure; no fabricated success |
| AI-04 | Prompt-injection document | Real pipeline | Facts only; no rule/score override |
| PROFILE-01 | AE/PH questionnaire round trip | Real API + database + worker | Exact jurisdiction/answers preserved |
| CORRECT-01 | Manual correction and reevaluation | Real complete pipeline | Durable attributed revision and changed result |
| RULE-01 | Existing business-rule boundaries | Deterministic unit fixtures | Preserved expected behavior |
| PACK-01 | Pack pinned across registry/restart changes | Real database + worker | Exact consistent version |
| SCORE-01 | Critical caps and blocked/null scores | Unit + real pipeline | Correct configured semantics |
| RESULT-01 | Findings/remediation reload after restart | Real database | Complete durable output |
| RESULT-02 | Mid-result transaction failure | Real database failure | Rollback; no partial success |
| REPORT-01 | PDF publication and restart retrieval | Real database + Storage + worker | Durable authorized matching report |
| REPORT-02 | Report storage failure | Controlled real failure | Unpublished/failed; no false completion |
| QUEUE-01 | Independent worker processes queued job | Real API/database/worker | 202 operation then durable result |
| QUEUE-02 | Concurrent duplicate enqueue/delivery | Multiple real processes | One logical committed result |
| QUEUE-03 | Worker killed and restarted | Real worker + database | Lease recovery |
| QUEUE-04 | Stale lease publishes | Real concurrent workers | Rejected stale commit |
| RETRY-01 | Transient failure and backoff | Controlled real dependency failure | Recorded bounded attempts/schedule |
| RETRY-02 | Maximum attempts exhausted | Real worker + database | Durable terminal failure |
| DELETE-01 | Delete scan with document/report | Real complete environment | Immediate denial and physical cleanup |
| DELETE-02 | Delete during processing/cleanup failure | Real concurrent environment | No resurrection; retryable cleanup |
| RETAIN-01 | Document/result/report expiry | Real complete environment | Access denied and verified purge |
| PRIV-01 | Consent/request lifecycle | Real API + database | Durable policy/actor/status |
| PRIV-02 | Actual customer export/erasure | Real complete environment | Correct authorized records/cleanup |
| AUDIT-01 | Mutation/failure/correction/cleanup events | Real database + API | Actual append-only scoped events |
| BUNDLE-01 | Proprietary/secret client leakage | Production build | No executable rules/scoring/secrets |
| MIGRATE-01 | Fresh install and audited-schema upgrade | Isolated real Supabase | Correct schema/policies/data treatment |
| MIGRATE-02 | Migration failure/repeated invocation | Isolated real Supabase | Safe rollback/version behavior |
| CONFIG-01 | Missing required dependency/configuration | API and worker deployment | Fail closed/readiness unavailable |
| E2E-01 | Complete AE upload-to-report workflow | All real target dependencies | Authorized durable correct assessment |
| E2E-02 | Complete PH upload-to-report workflow | All real target dependencies | PH profiles/rules/provenance |
| E2E-03 | Complete review/correction workflow | All real target dependencies | No premature definitive assessment |

Unit tests may use controlled input fixtures to test pure validators and deterministic business logic. Such tests must not be labeled as proof of live Auth, RLS, Storage, malware scanning, Gemini, worker recovery or production readiness.

## 10. Release acceptance criteria

Production release is acceptable only when:

1. Every P0 finding is independently closed with actual API and real Supabase/scanner evidence.
2. Relevant P1 capabilities are implemented, connected and verified.
3. All required target infrastructure is deployed and identified.
4. Fresh-install and upgrade migrations are reviewed and tested.
5. Existing invalid historical data is reconciled or safely excluded under an approved migration decision.
6. Tenant/RBAC/RLS/Storage tests pass for real users with distinct organizations and roles.
7. Missing, rejected, unverified, expired and unstored documents cannot produce completed assessments.
8. AE and PH end-to-end processing preserves questionnaire, facts, uncertainty, pack provenance and scoring.
9. Durable operations, restart recovery, retries and idempotency are proven with independent worker processes.
10. Reports, deletion, retention, privacy and audit capabilities operate on actual durable data.
11. No proprietary executable rule/scoring logic or private credentials appears in browser assets.
12. Production paths contain no authoritative local/mock fallback.
13. Typecheck, build, regression, HTTP and real acceptance suites pass.
14. Dependency risks are resolved or explicitly accepted by the authorized release owner.
15. The final evidence package distinguishes source review, unit tests, local HTTP checks and real infrastructure checks.
16. An independent reviewer approves the implementation and evidence.

## 11. Conditions that must BLOCK production release

Production release must remain **BLOCKED** if any of the following is true:

- Any protected route accepts absent, forged or unauthorized identity.
- Tenant/object authorization or organization-specific RBAC is incomplete.
- A database grant, policy or exposed function permits cross-tenant access, forged ownership, role escalation or result tampering.
- Storage permits unauthorized object listing, reads, signing, uploads or replacement.
- Documents are public or quarantine is browser-accessible.
- Processing can start without actual approved durable document bytes.
- Scanner failure, missing configuration or development fallback can count as CLEAN.
- Extraction/parser failure can become a fabricated or completed assessment.
- Jurisdiction, questionnaire, corrections, pack version or scoring configuration is lost or substituted.
- Persistence/storage errors are swallowed or converted into success.
- Jobs/results depend on a warm Vercel instance or process-local memory.
- No independent worker is deployed, or retries/recovery/leases are unverified.
- A stale worker can publish, duplicate operations can duplicate results, or deletion can resurrect data.
- Required listing/status/report/deletion/retention/privacy/audit capabilities are missing.
- Customer-facing privacy, deletion, retention or verification claims are unsupported by actual behavior.
- Proprietary executable rules, scoring logic or private credentials ship to the browser.
- Obsolete Firebase/GCP/PGlite paths remain authoritative in production.
- Migrations are unsafe, unreviewed or untested against the existing schema.
- Relevant security/regression tests fail or lack meaningful assertions.
- Real dependency tests are unavailable, skipped, mocked or labeled PASS without execution.
- Credentials, isolated test-project approval, worker infrastructure, scanner access or Gemini access are unavailable.
- Production acceptance evidence is incomplete or independent review has not approved release.

**Final release status remains BLOCKED until these conditions are resolved and independently verified.**