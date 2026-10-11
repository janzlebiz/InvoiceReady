# REGULENTA — Final Security Remediation Implementation Plan

## Purpose

Implement and verify the remaining targeted security and processing remediations identified by the independent source review and Codex review.

This plan specifically addresses:

1. Cross-tenant compatibility-view isolation.
2. Same-tenant authorization and result-tampering protection.
3. Request-scoped authentication and tenant authorization.
4. Missing/invalid document fail-closed behavior.
5. Immutable document/inspection binding.
6. Elimination of fabricated invoice processing.
7. Removal of all processing bypass paths.
8. Durable processing and worker correctness.
9. Adversarial security and failure verification.
10. Accurate release-gate behavior.

**IMPORTANT: These changes do NOT by themselves authorize a RELEASE READY verdict.**

The complete `remediation.md` requirements remain authoritative. Any unresolved P0/P1 requirement, missing infrastructure, failed mandatory test, skipped mandatory test, or unverified production dependency keeps REGULENTA **BLOCKED**.

---

# 1. NON-NEGOTIABLE IMPLEMENTATION RULES

AI Studio MUST:

- Inspect the existing implementation before changing it.
- Implement actual production behavior, not scaffolding.
- Never use fabricated invoice/document data.
- Never use `mockInvoice` in a production execution path.
- Never generate a score or findings without verified source document bytes.
- Never allow the client to determine tenant ownership.
- Never trust an `organization_id` request header without server-side membership verification.
- Never trust client-supplied scan status, findings, scores, inspection state, report state, or job state.
- Never use an anonymous/shared Supabase client for authorization decisions when request identity is required.
- Never expose service-role credentials to the browser.
- Never use PGlite, in-memory state, mock adapters, or offline fallbacks as authoritative production persistence.
- Never silently fall back from a failed production dependency to simulated success.
- Never mark a scan `COMPLETED` unless the complete real processing pipeline succeeded.
- Never allow a failed test command to exit successfully.
- Never report PASS when required infrastructure or credentials are unavailable.
- Never modify an already-applied migration as the only means of changing production schema.
- Never perform destructive migration against production without an isolated verification environment and explicit data-preservation verification.
- Never declare release readiness merely because this targeted remediation passes.

---

# 2. AUTHORITATIVE ARCHITECTURE

The intended production flow is:

```text
Authenticated Client
        |
        v
Next.js API
        |
        +--> request-scoped authentication
        |
        +--> verified organization membership
        |
        +--> authorization
        |
        v
Durable Scan / Operation / Job
        |
        v
Independent Worker
        |
        +--> load authoritative scan/document revision
        |
        +--> verify tenant ownership
        |
        +--> verify immutable document
        |
        +--> verify inspection evidence
        |
        +--> verify stored bytes/hash
        |
        +--> strict document parsing
        |
        +--> validated extraction
        |
        +--> pinned jurisdiction/rules
        |
        +--> versioned scoring
        |
        +--> persisted findings/remediation
        |
        +--> durable report artifact
        |
        v
Terminal result
```

The API must not bypass the durable processing model by directly executing the complete scan pipeline synchronously.

---

# 3. PHASE 0 — BASELINE AND REPRODUCTION

Before modifying code:

1. Record:
   - exact current commit SHA
   - current branch
   - package manager
   - lockfile hash
   - Node.js version
   - package versions
   - migration inventory
   - deployed application version
   - worker version/configuration

2. Run the existing verification suite exactly as currently implemented.

3. Record failures without hiding or rewriting them.

4. Reproduce the known defects:
   - cross-tenant compatibility-view access
   - unauthenticated/incorrectly authorized access
   - missing-document scan completion
   - fabricated invoice processing
   - direct API processing bypass
   - `JobQueue.enqueueWorker` completion bypass
   - persistence loss after process restart, if still present

5. Determine whether `npm run typecheck` actually exists.

6. Verify Windows/Linux portability of required scripts.

7. Verify the test runner exits non-zero when a test fails or returns a failed assertion count.

Do not proceed by assuming previous gate results are still valid for the current commit.

---

# 4. PHASE 1 — COMPATIBILITY VIEW HARDENING

## 4.1 Add a NEW corrective migration

Do NOT rely on editing:

- `202610100001_authoritative_schema.sql`
- `202610100006_reconcile_views_and_indexes.sql`

because those migrations may already be recorded as applied.

Create a new migration that:

- hardens all five existing compatibility views
- reconciles grants
- verifies configuration
- is safe for upgrade from the actual audited schema

Views:

```text
public.documents
public.reports
public.consents
public.users
public.scans
```

Use:

```sql
WITH (security_invoker = true)
```

where supported by the existing PostgreSQL/Supabase version.

---

## 4.2 Do NOT treat security_invoker as the complete security solution

`security_invoker = true` does not itself establish tenant isolation.

Verify all of the following:

### View layer

- `security_invoker = true`
- correct view definition
- no accidental tenant bypass
- no unsafe owner/security context

### Base tables

- RLS enabled
- correct tenant policies
- correct role restrictions
- correct INSERT/UPDATE/DELETE policies
- no policy that trusts arbitrary client `organization_id`

### Permissions

- revoke unnecessary anonymous privileges
- revoke unnecessary authenticated privileges
- restrict direct base-table permissions where appropriate
- expose only required compatibility views/functions
- verify grants for every relevant database role

### Identity

All tests requiring tenant isolation must use real authenticated user JWTs.

Do NOT use a service-role client to prove RLS isolation.

---

# 5. PHASE 2 — REQUEST-SCOPED AUTHENTICATION

The existing `verifyServerAuth` flow must be reviewed and corrected.

A valid JWT alone is insufficient if subsequent membership queries use an anonymous/shared client.

Implement one of:

### Preferred

A request-scoped Supabase client carrying the verified caller JWT.

OR:

### Controlled alternative

A narrowly authorized privileged membership lookup that receives the already verified authenticated identity and cannot be influenced by client-supplied organization data.

Requirements:

- verify token server-side
- derive authenticated user ID from verified token
- derive organization membership server-side
- derive role server-side
- ignore untrusted organization headers for authorization
- reject mismatched organization claims
- prevent cross-tenant UUID guessing
- prevent same-tenant privilege escalation

Every protected API route must use the same authorization model.

---

# 6. PHASE 3 — DOCUMENT STATE MACHINE

Do NOT collapse all document conditions into `FAILED`.

Use the following distinctions:

| Situation | Required behavior |
|---|---|
| Upload/inspection legitimately pending | Preserve pending state; processing request returns `409` |
| Security inspection rejects document | Preserve `SECURITY_REJECTED` |
| Missing finalized document | Terminal `FAILED` + `DOCUMENT_MISSING` |
| Empty document | Terminal `FAILED` + `DOCUMENT_EMPTY` |
| Integrity/hash mismatch | Terminal `FAILED` + `DOCUMENT_INTEGRITY_FAILED` |
| Temporary storage/scanner outage | Durable retry |
| Permanent processing failure after retry exhaustion | Terminal `FAILED` + actionable error code |

Never treat `SECURITY_REJECTED` as a generic processing failure.

Never allow a rejected document to enter successful evaluation.

---

# 7. PHASE 4 — IMMUTABLE DOCUMENT/INSPECTION BINDING

A `SECURITY_PASSED` flag alone is insufficient.

Before evaluation, the worker MUST verify:

1. Authorized tenant/scan/document relationship.
2. Correct immutable document revision.
3. Security inspection evidence exists.
4. Inspection belongs to the same document revision.
5. Inspection references the expected SHA-256.
6. Stored object is private.
7. Stored object exists.
8. Stored bytes are readable.
9. Downloaded bytes match the recorded hash.
10. Document has not expired.
11. Document has not been revoked/deleted.
12. Object has not been overwritten after inspection.

Prevent document replacement between inspection and evaluation.

The authoritative evaluation input must be:

```text
immutable document revision
        +
inspection evidence
        +
verified stored bytes
        +
matching SHA-256
```

---

# 8. PHASE 5 — ELIMINATE FABRICATED PROCESSING

Refactor:

```text
src/services/scanService.ts
```

and every other production execution path that can process a scan.

Remove:

- `mockInvoice`
- fake supplier/customer values
- fake invoice numbers
- fake dates
- fake tax IDs
- fake currency
- fake subtotal/tax/total
- arbitrary default invoice facts
- fabricated extraction success
- simulated production findings
- unconditional completion branches

No production path may manufacture an invoice when the source document is missing.

---

# 9. PHASE 6 — AUTHORITATIVE PROCESSING PIPELINE

“Real extraction & evaluation” is not sufficient as an implementation description.

The actual pipeline must be:

```text
Stored document bytes
        ↓
Security inspection verification
        ↓
Strict parsing
        ↓
Validated extraction
        ↓
Canonical invoice facts
        ↓
Pinned jurisdiction/profile
        ↓
Pinned rules-pack/version
        ↓
Versioned scoring
        ↓
Persisted findings
        ↓
Persisted remediation guidance
        ↓
Durable report artifact
```

Each stage must have explicit success/failure semantics.

A failure at any stage must prevent `COMPLETED`.

No downstream stage may manufacture data missing from an upstream stage.

---

# 10. PHASE 7 — FIX EVERY EXECUTION PATH

Fixing `ScanService.processScan()` alone is insufficient.

Audit all callers and processing mechanisms.

In particular, inspect and correct:

```text
JobQueue.enqueueWorker
```

If the Supabase worker branch can currently mark a scan completed without executing the authoritative pipeline, remove that behavior.

Every worker execution path must use the same processing invariants.

There must be exactly one authoritative definition of successful scan completion.

A scan may become `COMPLETED` only after the real pipeline has produced and durably persisted the required result.

---

# 11. PHASE 8 — DURABLE PROCESSING

The API processing route must not remain a hidden synchronous worker.

Preferred flow:

```text
POST /api/scans/:scanId/process
        ↓
authenticate
        ↓
authorize
        ↓
validate scan state
        ↓
create durable operation/job
        ↓
return 202
        ↓
independent worker
        ↓
process job
```

The worker must support:

- durable queue
- lease acquisition
- heartbeat
- stale lease recovery
- retry/backoff
- bounded concurrency
- idempotency
- duplicate-job protection
- terminal failure
- process restart recovery
- worker fencing where required

A worker crash must not leave the system permanently stuck.

A retry must not duplicate findings or reports.

---

# 12. PHASE 9 — TRANSACTIONAL FAILURE HANDLING

When a permanent document-processing failure occurs:

```text
scan status = FAILED
error code = specific actionable code
audit event = persisted
```

The state transition must be protected against stale requests.

Use conditional/optimistic updates so an older worker cannot overwrite a newer scan revision or terminal state.

Examples:

```text
DOCUMENT_MISSING
DOCUMENT_EMPTY
DOCUMENT_INTEGRITY_FAILED
SCANNER_UNAVAILABLE
EXTRACTION_FAILED
RULE_EVALUATION_FAILED
REPORT_GENERATION_FAILED
```

Do not use a generic error code when the failure can be identified more precisely.

---

# 13. PHASE 10 — AUTHORIZATION AND RESULT-TAMPERING PROTECTION

Verify that clients cannot directly modify:

- scores
- findings
- remediation results
- inspection status
- document security status
- report publication status
- scan completion status
- worker/job state
- organization ownership
- audit records

Test both:

### Cross-tenant attacks

Org B attempting to access/modify Org A.

### Same-tenant privilege escalation

A lower-privileged user attempting administrative/result-changing operations.

Tenant isolation must protect both reads AND mutations.

---

# 14. PHASE 11 — STORAGE SECURITY

Verify:

- private document bucket
- private report bucket
- quarantine objects inaccessible to normal browser clients
- no arbitrary storage-path authorization
- no client-controlled object ownership
- immutable document revision semantics
- upload capability is tenant/scan/document scoped
- upload size limits
- MIME/content validation
- object existence verification
- SHA-256 verification
- report objects cannot be arbitrarily overwritten

Direct browser upload may be used only when backed by a properly scoped upload capability/reservation.

---

# 15. PHASE 12 — ADVERSARIAL TEST MATRIX

Add real integration tests.

## Authentication

- unauthenticated request
- valid authenticated user
- invalid JWT
- expired JWT
- mismatched organization header
- forged organization identifier

## Tenant isolation

Org B:

- reads Org A scan
- reads Org A document
- reads Org A report
- reads Org A consent
- reads Org A user
- inserts into Org A
- updates Org A
- deletes Org A
- modifies Org A job
- modifies Org A results

Expected: denied/zero rows according to API contract.

## Positive controls

Also prove:

- Org A can access its own authorized data.
- Authorized roles can perform their intended operations.

This prevents a broken authorization system from appearing secure simply because everything is denied.

## Same-tenant authorization

Test:

- member vs admin
- privileged result mutation
- job manipulation
- audit manipulation
- report publication manipulation

## Document lifecycle

Test:

- no document
- pending inspection
- rejected document
- empty document
- expired document
- deleted document
- overwritten document
- hash mismatch
- valid document

## Processing failures

Inject/induce:

- database failure
- storage failure
- scanner failure
- extraction failure
- Gemini/model failure
- rule evaluation failure
- report generation failure
- worker crash
- process restart
- stale lease
- duplicate job

Verify correct retry/terminal behavior.

## Result invariants

For failed processing:

- no `COMPLETED`
- no score
- no findings
- no published report
- no fabricated facts

---

# 16. PHASE 13 — ACTUAL NEXT.JS ROUTE TESTING

Security tests must exercise actual application routes.

Do not rely exclusively on:

- direct service calls
- SQL-only tests
- PGlite
- schema RPCs
- unit tests

Required routes include, where implemented:

```text
GET    /api/health
GET    /api/scans
POST   /api/scans
GET    /api/scans/:scanId
POST   /api/scans/:scanId/documents
GET    /api/scans/:scanId/documents/:documentId
POST   /api/scans/:scanId/process
GET    /api/scans/:scanId/operations/:operationId
POST   /api/scans/:scanId/corrections
GET    /api/scans/:scanId/report/pdf
DELETE /api/scans/:scanId
```

If `/api/extract` remains:

- authenticate
- authorize associated scan
- do not accept arbitrary caller-controlled invoice text as production input
- process only approved stored document bytes

---

# 17. PHASE 14 — REPORT GENERATION

The report endpoint must not generate a report as a side effect of a GET request.

Required architecture:

```text
processing pipeline
        ↓
generate report
        ↓
persist immutable report artifact
        ↓
publish report metadata
        ↓
GET /report/pdf
        ↓
retrieve existing authorized artifact
```

GET must not silently create/recalculate the assessment.

Report access must remain tenant-scoped.

---

# 18. PHASE 15 — TEST-GATE CORRECTIONS

Correct the verification infrastructure itself.

Required:

- `npm run typecheck` exists if required by the release gate, or the gate must use the actual canonical typecheck command.
- test scripts work on supported environments.
- Windows/Linux path handling is portable.
- failed assertion counts cause non-zero exit.
- a deliberately injected failing test proves the gate fails.
- missing credentials cause `BLOCKED`, not `PASS`.
- missing Supabase/worker infrastructure causes `BLOCKED`.
- no static/hardcoded PASS.
- no swallowed subprocess errors.
- no test that reports success while the underlying process failed.

---

# 19. PHASE 16 — LIVE SUPABASE VERIFICATION

Schema/RPC checks and PGlite simulations are not sufficient for security acceptance.

Run against an isolated real Supabase environment:

### Fresh installation

Apply all migrations from zero.

### Upgrade

Start from the actual audited schema state and apply the new corrective migration.

Verify:

- views
- RLS
- policies
- grants
- foreign keys
- indexes
- constraints
- functions
- storage buckets
- storage policies

Then execute actual API requests using real authenticated user JWTs.

---

# 20. PHASE 17 — MIGRATION SAFETY

Before applying migrations:

1. Create an isolated verification project/database.
2. Apply the current production/audited schema.
3. Apply the new remediation migration.
4. Verify existing data remains intact.
5. Verify compatibility views.
6. Verify permissions.
7. Verify RLS.
8. Verify upgrade behavior.
9. Verify fresh installation separately.

Do not assume fresh-install success proves upgrade safety.

---

# 21. PHASE 18 — EXISTING UNRESOLVED RELEASE BLOCKERS

These targeted changes do NOT automatically close the following broader findings.

Continue tracking and resolving them under the authoritative `remediation.md` matrix:

- production PGlite/in-memory fallback
- durable independent worker deployment
- deletion/retention workflows
- privacy/export workflows
- complete audit lifecycle
- proprietary client-side executable logic
- production infrastructure configuration
- migration/data preservation verification
- remaining authorization weaknesses
- report lifecycle
- complete storage lifecycle
- any unresolved P0/P1 from the independent audit

Do not mark these PASS merely because related tests pass locally.

---

# 22. RELEASE GATE

Run the complete gate only after implementation.

At minimum:

```text
npm ci
typecheck
lint
production build
unit tests
integration tests
security tests
migration tests
live Supabase tests
live Storage tests
worker tests
failure-injection tests
fresh-install migration
upgrade migration
API adversarial tests
bundle/IP inspection
```

Every mandatory test must have one of:

```text
PASS
FAIL
BLOCKED
```

There is no acceptable:

```text
SKIPPED
ASSUMED PASS
NOT TESTED
```

for a mandatory release requirement.

---

# 23. RELEASE DECISION RULE

REGULENTA remains:

```text
BLOCKED
```

if ANY of the following is true:

- any P0 remains unresolved
- any release-critical P1 remains unresolved
- mandatory security test fails
- mandatory test is skipped
- mandatory test is blocked
- production infrastructure is unavailable
- required credentials are unavailable
- real Supabase verification is unavailable
- real Storage verification is unavailable
- durable worker verification is unavailable
- migration upgrade is unproven
- data preservation is unproven
- production build is not reproducible
- test runner cannot reliably propagate failures
- documentation claims exceed demonstrated evidence

Only when the complete authoritative remediation matrix is satisfied may the status become:

```text
RELEASE READY
```

---

# 24. REQUIRED FINAL AI STUDIO REPORT

After implementation, provide:

## A. Exact implementation

- files changed
- migrations added
- schema changes
- API changes
- worker changes
- security changes
- storage changes

## B. Exact commit

```text
commit SHA
```

## C. Verification

For every mandatory test:

```text
Test | Result | Evidence
```

Use:

```text
PASS
FAIL
BLOCKED
```

with no ambiguous wording.

## D. Security evidence

Include:

- cross-tenant positive/negative results
- same-tenant role tests
- Storage authorization tests
- document integrity tests
- result-tampering tests
- worker failure/recovery tests

## E. Migration evidence

Include:

- fresh install result
- upgrade result
- data-preservation result
- view configuration
- RLS configuration
- grants
- policies

## F. Processing evidence

Demonstrate:

```text
stored bytes
→ inspection
→ hash verification
→ parsing
→ extraction
→ rules
→ scoring
→ findings
→ report
```

using a real approved document.

## G. Failure evidence

Demonstrate at least:

```text
missing document → FAILED
empty document → FAILED
hash mismatch → FAILED
security rejection → SECURITY_REJECTED
temporary outage → RETRY
worker crash → RECOVERY
successful real document → COMPLETED
```

## H. Gate result

State exactly:

```text
RELEASE READY
```

only if every authoritative requirement is proven.

Otherwise:

```text
BLOCKED
```

and list every remaining blocker.

---

# FINAL EXECUTION INSTRUCTION

Do not merely describe how these requirements could be implemented.

**Inspect the current REGULENTA repository, implement the required changes, run the actual verification suite, fix failures, and provide evidence for every requirement.**

Do not manufacture test results.

Do not convert unavailable infrastructure into PASS.

Do not declare release readiness from local simulation.

Do not stop after fixing `mockInvoice` and compatibility views.

The implementation is complete only when the complete authoritative remediation matrix has been verified, and the final release decision accurately reflects the evidence.