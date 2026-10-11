# REGULENTA — FINAL AI STUDIO REMEDIATION EXECUTION SPECIFICATION

**Repository:** `janzlebiz/InvoiceReady`  
**Product:** REGULENTA  
**Current release status:** **BLOCKED**  
**Target architecture:** Next.js App Router + Supabase Auth + Supabase PostgreSQL + private Supabase Storage + Vercel + independently deployed Node.js worker.

---

## 0. MANDATORY EXECUTION RULE

You are the implementation agent responsible for bringing REGULENTA from its currently blocked state to a genuinely production-ready state.

**Do not merely explain, plan, scaffold, mock, simulate, or report what should be done. Inspect the repository, implement the changes, run the required verification, collect evidence, and leave the repository in a verifiably corrected state.**

The authoritative requirements are:

1. The complete `remediation.md` supplied with this task.
2. This document, which consolidates the independent Codex review and the source review findings.
3. The actual current repository source and deployed/approved infrastructure.

`remediation.md` remains the full technical contract. This document does not remove any requirement from it.

If a requirement in `remediation.md` is stricter than this document, **follow the stricter requirement**.

### Absolute rules

- Keep release status **BLOCKED** until every mandatory release criterion is actually satisfied.
- Never mark something PASS because code exists, a test is mocked, a fixture is local, a UI says success, or a report claims success.
- Never fabricate invoice facts, customer data, tax IDs, dates, currency, totals, confidence, findings, reports or security state.
- Never use PGlite, memory, browser storage, Maps, local state or development fallbacks as authoritative production persistence.
- Never trust client-supplied organization, role, ownership, security state, score, findings or billing state.
- Never decode a JWT and treat the decoded payload as authentication.
- Never expose service-role, database, Gemini, scanner or worker credentials to the browser.
- Never put executable proprietary rule/scoring logic in browser bundles.
- Never silently fall back to a weaker security or persistence mode.
- Never use a static/hardcoded PASS.
- Never swallow persistence, storage, scanner, model or worker errors.
- Missing infrastructure or credentials means **BLOCKED**, not PASS.
- Do not apply destructive migrations or live fixtures to an unidentified production project.
- Do not restore Firebase/GCP/Cloud Tasks/Cloud Run as the default production architecture.
- Do not redesign unrelated UI or add unrelated features.
- Preserve REGULENTA's intended business behavior and deterministic rule logic except where a security/data-integrity correction requires a change.

---

# 1. START WITH A CURRENT-STATE AUDIT

Before modifying source:

1. Record:
   - current branch
   - exact HEAD SHA
   - working-tree status
   - all uncommitted changes
   - package manager
   - Node version
   - installed dependency state
   - migration inventory
   - deployment configuration
   - current scripts
2. Read the complete `remediation.md`.
3. Inspect the current repository rather than assuming the previously reviewed commit is still current.
4. Identify any existing remediation work and distinguish:
   - implemented
   - connected
   - tested
   - independently verified
   - blocked
5. Do not overwrite useful existing work blindly.
6. Preserve the historical baseline and behavioral references.
7. Create a finding-to-implementation-to-test matrix.

The current independent review identified the following source-level blockers. Reconfirm them against the current checkout before fixing them.

---

# 2. P0 — SECURITY AND DATA-INTEGRITY BLOCKERS

## P0-01 — Eliminate fabricated assessment processing

The production assessment path must NEVER construct a fake invoice and evaluate it.

Remove any production use of:

- `mockInvoice`
- fabricated seller/buyer identities
- fabricated invoice numbers
- fabricated dates
- fabricated currencies
- fabricated totals/tax/subtotal
- fabricated confidence
- deterministic fake extraction used as a production fallback

Processing must require:

1. Authenticated authorized caller.
2. Authorized scan.
3. Correct tenant.
4. Durable document record.
5. Actual stored document bytes.
6. Verified document hash.
7. Successful security/malware inspection.
8. Supported file type.
9. Successful strict parsing.
10. Valid canonical extraction.
11. Required review/uncertainty gates satisfied.
12. Correct jurisdiction/profile snapshot.
13. Immutable rule-pack/scoring configuration.
14. Successful deterministic rule evaluation.
15. Successful score/result persistence.
16. Successful report publication where required.

Missing, rejected, expired, corrupted, unverified or uncertain input must never become `COMPLETED`.

Unknown values must remain unknown.

---

## P0-02 — Close compatibility-view tenant isolation

Inspect every exposed compatibility view.

Views must not bypass tenant RLS.

For every exposed view:

- inspect owner
- inspect `security_invoker`
- inspect grants
- inspect underlying table permissions
- test SELECT/INSERT/UPDATE/DELETE as appropriate
- test cross-tenant access using real authenticated users

Prefer `security_invoker` where compatible with the design, or remove unnecessary compatibility views.

Do not consider a view secure merely because the underlying table has RLS.

Required adversarial test:

- User A creates document/scan.
- User B authenticates with a real JWT.
- User B attempts to access A's resource through every table and view.
- Read/write/delete must be denied.

---

## P0-03 — Prevent same-tenant privilege and result tampering

Tenant isolation is not enough.

Restrict direct client mutation of:

- scan status
- score
- security state
- findings
- remediation
- ownership
- organization ID
- document inspection state
- report publication state
- job lease/attempt state
- audit actor
- audit timestamp
- privileged profile fields

Only the appropriate server/worker operation may change authoritative processing state.

Audit events must be server/worker generated and append-only.

Job state must not be writable by ordinary tenant members.

---

## P0-04 — Secure Storage lifecycle

Required buckets:

- `invoices`
- `reports`
- `quarantine`

All must be private.

Quarantine must not be browser-readable.

Authoritative report objects must not be directly overwritable by ordinary clients.

Document object paths must be immutable and tenant/scan/document scoped.

Use an authenticated upload reservation/capability workflow.

Recommended object scope:

`<organization_uuid>/<scan_uuid>/<document_uuid>`

Do not use a path convention alone as authorization.

The database must bind:

- organization
- scan
- document
- object key
- uploader
- declared metadata
- hash
- inspection state
- retention

Enforce the 15 MiB product limit independently in UI, API reservation, Storage and worker validation.

Do not send invoice bytes through Vercel when the deployed request-body limit makes that unreliable. Prefer direct authenticated Supabase Storage upload using a narrowly scoped capability.

---

## P0-05 — Remove production PGlite/memory fallback

Production must fail closed if durable PostgreSQL is unavailable.

Never initialize PGlite because:

- `DATABASE_URL` is missing
- configuration is incomplete
- Supabase public configuration exists
- connection validation fails

Public Supabase URL/anon/publishable key does not authorize a local database fallback.

PGlite/memory may exist only in explicitly isolated unit/simulation environments and must be impossible to activate in production.

Add a regression test proving:

`NODE_ENV=production + missing durable DB configuration => startup/readiness failure`

---

## P0-06 — Enforce real request-scoped authentication

Every protected route must:

1. Verify the supplied Supabase Auth token.
2. Establish the caller's authenticated database context for RLS-sensitive operations, or use a narrowly scoped server-side privileged lookup followed by explicit authorization.
3. Resolve organization membership from authoritative server data.
4. Resolve organization-specific role.
5. Reject forged, expired, revoked, anonymous or malformed identities.
6. Never trust an organization header unless it is checked against verified membership.
7. Never create synthetic OWNER identities in production.

Test:

- no token
- malformed token
- expired token
- forged token
- valid user
- revoked user
- anonymous user
- multi-organization user
- unauthorized organization
- role downgrade
- same-tenant unauthorized object access

---

# 3. P0 — DURABLE PROCESSING AND WORKER

## P0-07 — Processing must enqueue, not execute inline

`POST /api/scans/:scanId/process` must:

1. authenticate
2. authorize
3. validate prerequisites
4. verify document/security state
5. create an idempotent durable operation
6. enqueue the job transactionally
7. return `202 Accepted`
8. return an operation ID

It must not execute the complete assessment inside the Vercel request.

Required:

`GET /api/scans/:scanId/operations/:operationId`

must return authorized durable operation state.

---

## P0-08 — Independent Node worker

Implement an independently deployable Node.js worker.

The worker must:

- poll bounded SQL queries
- claim jobs transactionally
- use lease ownership/fencing
- heartbeat long-running jobs
- enforce attempt limits
- retry transient failures with bounded backoff
- record terminal failures
- be idempotent
- prevent stale workers from publishing results
- survive process termination
- recover expired leases
- never mark a job complete merely because a scan exists

Do not implement the worker as a Vercel request timer.

Do not treat an in-process supervisor as an independently deployed worker.

---

## P0-09 — Real immutable processing pipeline

The worker pipeline must be:

**stored bytes → security inspection → strict parser → canonical extraction → validation → jurisdiction/profile snapshot → pinned rules → scoring → review/uncertainty decision → findings/remediation → report publication → durable completion**

Every stage must fail closed.

No stage may silently substitute:

- fake data
- regex-only success
- default jurisdiction
- default dates
- default currency
- default confidence
- fake scanner result
- fake Gemini result

---

# 4. P0 — TENANT DATA MODEL

## P0-10 — Enforce tenant consistency in the database

Every tenant-owned child record must be prevented from referencing a parent from another tenant.

Separate `organization_id` foreign keys are not sufficient if a child can reference a scan from another organization.

Implement appropriate composite foreign keys or equivalent database-enforced constraints for:

- documents → scans
- reports → scans
- findings → scans
- remediations → findings/scans
- operations/jobs → scans/organizations
- privacy requests → users/organizations where applicable

Add adversarial cross-tenant parent/child tests.

---

## P0-11 — Preserve canonical data types and managed Supabase functions

Do not redefine managed `auth.uid()` or other managed Supabase functions in a way that conflicts with existing return types.

Do not convert canonical UUID identifiers to arbitrary VARCHAR merely to make local tests pass.

Perform:

1. fresh schema migration
2. upgrade from the actual audited schema
3. representative historical data migration
4. invalid-data reconciliation/quarantine
5. repeated migration test
6. rollback/failure test

Test against an isolated real Supabase project.

---

# 5. P1 — EXTRACTION, RULES AND SCORING

## P1-01 — Strict canonical extraction

Gemini extraction must validate against an explicit schema.

Do not invent missing values.

Do not use `||` fallback logic that turns valid zero/empty semantics into defaults.

Preserve:

- null
- unknown
- low confidence
- conflicting values
- source evidence

Store extraction provenance.

---

## P1-02 — Strict document parsing

Supported file types must match actual implementation.

Do not fall back from failed PDF parsing to arbitrary UTF-8 text and call the document successfully parsed.

Unsupported/corrupt formats must fail safely.

Implement and test actual required PDF/CSV/XML/XLSX/OCR paths according to `remediation.md`.

---

## P1-03 — Jurisdiction/profile immutability

A scan must retain the authoritative:

- jurisdiction
- business profile
- system profile
- questionnaire answers
- correction history

Do not let process requests substitute a new profile/jurisdiction.

Corrections must be explicit, attributed, versioned and trigger a durable reevaluation operation.

Support at least AE and PH workflows required by the specification.

---

## P1-04 — Pin rule and scoring provenance

Persist immutable:

- rule pack ID
- rule pack version
- rule/source snapshot hash
- scoring configuration version
- scoring configuration hash
- jurisdiction
- profile snapshot
- extraction version

The worker must execute against those pinned values.

A label such as `UAE-v1` is not sufficient provenance.

Results must be reproducible after a registry changes.

---

# 6. P1 — REPORTS AND LIFECYCLE

## P1-01 — Report publication must be separate from retrieval

Do not generate a new report during a GET request.

Worker processing must:

1. render report
2. upload actual bytes
3. verify upload
4. persist report metadata/hash
5. mark publication complete
6. only then allow retrieval

`GET /api/scans/:scanId/report/pdf` must retrieve an existing authorized published artifact.

Repeated GET requests must not create duplicate reports.

---

## P1-02 — Physical deletion

Deleting a scan must cover:

- scan records
- document records
- report records
- storage objects
- quarantine objects
- pending jobs
- leases
- operation state
- audit/deletion events according to retention policy

Deletion must be:

- durable
- retryable
- observable
- idempotent
- non-resurrecting

If deletion happens during processing, the worker must not recreate deleted results.

Subsequent authoritative checks must prove physical object absence.

---

## P1-03 — Retention

Implement actual retention execution, not only expiry columns.

Expired:

- documents
- reports
- temporary/quarantine artifacts

must become inaccessible and be physically removed according to the approved retention policy.

Use bounded queries and retryable cleanup.

---

# 7. P1 — PRIVACY AND AUDIT

Implement real APIs and durable state for:

- consent
- privacy requests
- data export
- erasure
- request status

The UI must not claim success from local state alone.

Export must contain the actual authorized customer data, including permitted artifacts.

Erasure must remove all required durable records and files.

Audit must be:

- append-only
- server/worker generated
- tenant scoped
- actor attributed
- resistant to caller forgery

Audit failure behavior must be explicitly defined and tested.

---

# 8. P1 — PROPRIETARY IP PROTECTION

Executable rule evaluators, scoring algorithms, proprietary source snapshots and privileged extraction logic must remain server-side.

Client components must not import executable RuleRegistry/rule packs.

Client may receive only approved metadata such as:

- jurisdiction
- published version
- display name
- non-proprietary description
- approved source references

After production build, inspect emitted client assets and source maps.

A source grep for secret strings is insufficient.

---

# 9. P1 — TEST AND RELEASE-GATE CORRECTIONS

The current test system must itself become trustworthy.

## Required changes

### Test failures must propagate

Any failed test must produce a non-zero exit code.

Do not allow:

`43/44 failed=1 exit=0`

or equivalent.

### Remove hardcoded PASS

Replace any hardcoded test result such as:

`SEC-AUTH-TOKEN-ENDPOINT-DISABLED-001: PASS`

with an actual executable assertion.

### Separate test classes

Clearly label:

- UNIT
- SIMULATION
- LOCAL HTTP
- REAL SUPABASE
- REAL STORAGE
- REAL SCANNER
- REAL GEMINI
- REAL WORKER
- END-TO-END

A local mock cannot satisfy a real infrastructure acceptance row.

### Disable unsafe production test execution

Remove or strictly disable mutating production test routes such as `/api/tests/run`.

Administrative tenant status does not authorize destructive shared production fixtures.

---

# 10. REQUIRED API CONTRACT

At minimum implement and verify:

- `GET /api/health`
- `GET /api/scans`
- `POST /api/scans`
- `GET /api/scans/:scanId`
- `POST /api/scans/:scanId/documents`
- `GET /api/scans/:scanId/documents/:documentId`
- `POST /api/scans/:scanId/process`
- `GET /api/scans/:scanId/operations/:operationId`
- `POST /api/scans/:scanId/corrections`
- `GET /api/scans/:scanId/report/pdf`
- `DELETE /api/scans/:scanId`
- `POST /api/privacy/consent`
- `POST /api/privacy/requests`
- `GET /api/privacy/requests/:requestId`
- `GET /api/admin/audit-logs`
- `GET /api/rules/packs`
- `GET /api/rules/sources`
- `GET /api/rules/:jurisdiction`

All protected endpoints require verified identity and object/tenant authorization.

---

# 11. REQUIRED ADVERSARIAL REGRESSION TESTS

Permanently test:

1. Unauthenticated scan creation → denied.
2. Forged token → denied.
3. Unauthorized scan read → denied.
4. Unauthorized PDF download → denied.
5. Unauthorized extraction → denied.
6. Missing document processing → denied/not completed.
7. Rejected document processing → denied/not completed.
8. Scanner unavailable → fail closed.
9. Scanner rejection → cannot become CLEAN.
10. Upload failure → no false success.
11. DB failure → rollback/no false completion.
12. Report upload failure → no completed report.
13. Cross-tenant table access → denied.
14. Cross-tenant view access → denied.
15. Same-tenant viewer result mutation → denied.
16. Same-tenant analyst privileged-state mutation → denied.
17. Forged organization ID → denied.
18. Forged role → ignored/denied.
19. Quarantine browser read → denied.
20. Direct report overwrite → denied.
21. Cross-tenant Storage access → denied.
22. Process restart → durable state survives.
23. Worker kill → lease recovery.
24. Stale worker → cannot publish.
25. Duplicate delivery → one logical result.
26. Maximum retries → durable terminal failure.
27. Delete during processing → no resurrection.
28. Cleanup failure → retryable cleanup.
29. Retention expiry → access denied and physical purge.
30. Privacy export → complete authorized data.
31. Privacy erasure → complete authorized deletion.
32. Audit actor forgery → denied.
33. Rule pack change after enqueue → job uses pinned version.
34. Manual correction → attributed durable reevaluation.
35. AE end-to-end → real stored invoice to report.
36. PH end-to-end → real stored invoice to report.
37. Production configuration missing DB → startup/readiness fails.
38. Production cannot initialize PGlite.
39. Production browser bundle contains no executable proprietary rules.
40. Any test failure → release gate non-zero.

---

# 12. UPLOAD ARCHITECTURE

Because the target deployment is Vercel, do not assume a 15 MiB multipart request can safely pass through a Vercel function.

Implement:

1. authenticated upload reservation
2. server-generated document UUID
3. exact object key
4. declared size/type validation
5. tenant resource quota checks
6. short-lived upload capability
7. direct private Storage upload
8. completion/finalization endpoint
9. stored-byte size verification
10. stored-byte SHA-256 verification
11. malware/security inspection
12. immutable clean-document state

Never expose service-role credentials.

---

# 13. MIGRATION REQUIREMENTS

Migrations must be:

- ordered
- repeatable
- safe
- reviewable
- compatible with managed Supabase functions
- tested fresh
- tested from the actual audited schema
- tested with representative historical data

Verify effective:

- grants
- RLS
- policy bodies
- view owners
- `security_invoker`
- function execution permissions
- Storage policies
- bucket privacy
- UUID types
- foreign keys
- composite tenant constraints
- indexes

Do not rely only on policy names/counts.

Do not declare schema security PASS from a local PGlite simulation.

---

# 14. PERFORMANCE AND OPERABILITY

Implement:

- cursor pagination for scans/audits/operations
- bounded worker polling
- bounded concurrency
- provider timeouts
- upload limits
- PDF page limits
- decompressed spreadsheet limits
- extraction token limits
- bounded retries
- truthful readiness

Worker queries must not load the entire job table and filter in JavaScript.

Health/readiness must distinguish:

- process alive
- database available
- schema compatible
- Storage available
- worker heartbeat
- scanner configured
- extraction service configured

---

# 15. PORTABLE DELIVERY

Fix platform-dependent scripts.

Do not depend on:

`NODE_ENV=test ...`

shell syntax that only works on Unix.

Use a portable mechanism such as `cross-env` or Node-based script configuration.

Require:

- clean install
- lockfile
- deterministic dependency installation
- typecheck
- tests
- API tests
- production build
- dependency audit
- release gate

Review dependency advisories individually.

Do not use blanket forced upgrades just to obtain a green audit.

---

# 16. IMPLEMENTATION ORDER

Execute in this order.

## Phase 0 — Baseline

Record source state and establish isolated acceptance infrastructure.

## Phase 1 — Authentication and authorization

Fix Auth, tenant derivation, RBAC, RLS, views, grants, Storage and direct mutation.

**Exit:** all P0 authorization findings have real evidence.

## Phase 2 — Durable document/security state

Implement direct Storage upload, hashes, scanner state, immutable documents and production fail-closed persistence.

**Exit:** missing/rejected/unverified documents cannot process.

## Phase 3 — Real assessment pipeline

Implement strict parsing, Gemini validation, AE/PH profiles, correction history, pinned rules/scoring and durable results.

**Exit:** no fabricated assessment and reproducible results.

## Phase 4 — Durable worker

Implement 202 operations, independent worker, leases, fencing, retries, idempotency and recovery.

**Exit:** multi-process processing survives restart safely.

## Phase 5 — Reports/lifecycle/privacy

Implement report publication, retrieval, deletion, retention, privacy and audit.

**Exit:** UI claims correspond to durable backend state.

## Phase 6 — IP and delivery hardening

Remove client executable rules, obsolete fallbacks, misleading tests, broken scripts and migration weaknesses.

**Exit:** production architecture is secure and reproducible.

## Phase 7 — Independent release verification

Run the complete acceptance matrix against the final commit and approved isolated real infrastructure.

**Exit:** release may change from BLOCKED only if every required criterion passes.

---

# 17. RELEASE ACCEPTANCE — NON-NEGOTIABLE

REGULENTA is **RELEASE READY** only if ALL are true:

1. Every P0 finding is closed.
2. Every applicable P1 is implemented and verified.
3. Real Supabase Auth is verified.
4. Real PostgreSQL/RLS/views/grants are verified.
5. Real private Storage is verified.
6. Real malware/security inspection is verified.
7. Real Gemini/extraction is verified.
8. Real worker deployment is verified.
9. Real AE workflow passes.
10. Real PH workflow passes.
11. Missing/rejected/uncertain documents cannot complete.
12. Physical deletion is verified.
13. Retention is verified.
14. Privacy/export/erasure is verified.
15. Audit is verified.
16. Proprietary executable rules are absent from client bundles.
17. Production has no authoritative local/mock fallback.
18. Fresh installation works.
19. Upgrade from the actual audited schema works.
20. Test failures propagate.
21. Clean dependency installation works.
22. Typecheck passes.
23. Production build passes.
24. Required API tests pass.
25. Real acceptance tests pass.
26. Worker restart/recovery passes.
27. Evidence identifies the exact tested commit.
28. No mandatory acceptance item is BLOCKED, SKIPPED or simulated.
29. Independent review confirms the evidence.
30. Release documentation claims exactly what the evidence proves.

---

# 18. FINAL EVIDENCE PACKAGE

Before declaring readiness, produce:

- final commit SHA
- branch
- clean working-tree status
- dependency lockfile/hash
- Node/package versions
- migration inventory
- schema verification
- grants/policies/RLS evidence
- Storage policy evidence
- authentication/RBAC evidence
- API acceptance results
- scanner evidence
- extraction/Gemini evidence
- worker deployment identifier
- worker recovery evidence
- AE E2E evidence
- PH E2E evidence
- report evidence
- deletion evidence
- retention evidence
- privacy evidence
- audit evidence
- browser bundle inspection
- dependency audit
- typecheck
- production build
- complete test counts
- blocked/skipped items, if any

Every result must identify whether it was:

`PASS`, `FAIL`, `BLOCKED`, or `SKIPPED`.

Never convert BLOCKED or SKIPPED into PASS.

---

# 19. FINAL STATUS RULE

At the beginning and throughout execution:

**RELEASE STATUS = BLOCKED**

Only change it to:

**RELEASE READY**

after the complete acceptance matrix passes against the final implementation commit and all required real infrastructure is independently verified.

If anything remains unresolved, finish with:

**RELEASE BLOCKED**

and list the exact remaining blockers.

Do not produce a “conditionally ready”, “technically ready”, “ready pending deployment”, or similar status when a mandatory release requirement is unavailable.

---

# 20. EXECUTION INSTRUCTION

Now execute the remediation.

Do not stop after creating a plan.

Do not stop after implementing scaffolding.

Do not stop after unit tests.

Do not stop after local tests.

Do not stop after a successful build.

Continue through implementation, integration, adversarial verification, migration verification, real dependency verification and final evidence generation.

Use the complete `remediation.md` as the authoritative acceptance contract.

**The objective is not to make the report green. The objective is to make the product genuinely satisfy the contract.**

When complete, provide:

1. What was changed.
2. Files changed.
3. Database migrations added/changed.
4. API/worker architecture changes.
5. Tests added/changed.
6. Exact commands executed.
7. Exact results.
8. Real infrastructure verified.
9. Remaining BLOCKED items, if any.
10. Final release decision.

**Never claim RELEASE READY unless every mandatory requirement is actually proven.**
