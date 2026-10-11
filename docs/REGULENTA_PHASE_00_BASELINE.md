# REGULENTA — Phase 00 BASELINE: Baseline & Repository Audit

Execute Phase 00 only. Establish the real repository state before changing implementation.

DO NOT implement later remediation phases, run the final release gate, or declare release readiness.

Inspect and record: exact branch/commit; package manager/lockfile; Node/package versions; migration inventory; API routes; authentication and Supabase client creation; compatibility views; RLS/policies/grants; Storage; ScanService; JobQueue/worker; report generation; document upload/inspection; PGlite/in-memory/mock fallbacks; client bundle proprietary-rule exposure; test commands and exit-code behavior.

Search for `mockInvoice`, fabricated invoice defaults, unconditional `COMPLETED`, production PGlite/memory fallback, shared/anonymous auth in authorization paths, direct API→ScanService processing, `JobQueue.enqueueWorker`, GET report generation, and client executable rules.

Run the existing relevant tests as baseline. Record failures exactly. If commands do not exist or failed assertions return exit 0, record those as defects.

Deliver a Phase 00 report with exact commit, commands/results, P0/P1 findings, affected files, migration state, infrastructure gaps, and execution order.

ACCEPTANCE: repository execution paths and known blockers are accurately mapped.

STOP. Do not run `final-gate.sh`.
