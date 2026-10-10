# Plan: Diagnose and Fix Behavioral Test Runner Hang

The behavioral test runner currently hangs. We will implement strict timeouts, diagnostic logging, and deterministic resource management.

## Proposed Steps

1. **Implement Timeouts & Diagnostics**
   - Refactor `src/engine/testRunner.ts` to implement a per-test timeout (30s) and a global suite timeout (120s).
   - Implement diagnostic logging upon timeout (active handles/requests, database/worker states).

2. **Ensure Resource Deterministic Cleanup**
   - Ensure all resource-creating tests (DB connections, workers, storage, file handles) are wrapped in `try-finally` blocks.
   - Force `DatabaseService.close()` in the `finally` block of the entire suite execution.

3. **Execution & Diagnosis**
   - Run tests sequentially to identify the first failing/hanging test.
   - Trace resource usage for that test (Pool, PGlite, Supabase, timers, etc.).

4. **Remediation & Verification**
   - Fix identified resource leaks/hang causes.
   - Verify fix:
     - Run isolated test.
     - Run complete suite.
     - Run build and typecheck.

## Gates
- The runner must exit non-zero on failure/timeout.
- No mocking/suppression of failures.
- Final report must contain:
  - Exact hanging test.
  - Root cause analysis.
  - Resource tracked and fixed.
  - Isolated and suite test results.
  - Build/Typecheck results.
