# REGULENTA — Phase 00 Baseline Audit Implementation Plan

## Purpose

Execute Phase 00 baseline repository audit and establish the exact system baseline, migration state, security code inventory, and baseline test behavior without making code changes or triggering `final-gate.sh`.

## User Review & Critical Decisions

> [!IMPORTANT]
> Phase 00 is an audit and baseline phase only. It does not modify application logic or run `final-gate.sh`.

- **Confirmed Decision 1**: Report delivered as a standalone markdown document at `docs/REGULENTA_PHASE_00_BASELINE_REPORT.md`.
- **Confirmed Decision 2**: Baseline test targets include both local test suite and live Supabase target schema inspection.

---

## 1. Overview & Core Concept

- **What It Does**: Conducts a thorough repository state baseline audit of git commit SHA, lockfile hash, Node/npm versions, package dependencies, migration files, API routes, authentication patterns, `ScanService`, `JobQueue`, storage buckets, and test runner exit behaviors.
- **Deliverable**: `docs/REGULENTA_PHASE_00_BASELINE_REPORT.md` capturing all findings and baseline test results.

---

## 2. Execution Walkthrough

1. **Environmental & Package Baseline**:
   - Record exact git commit, branch, Node version, npm version, lockfile hash, and package.json dependencies.
2. **Repository Inventory**:
   - Inventory all API routes under `app/api/`.
   - Inventory database migrations under `supabase/migrations/`.
   - Audit `verifyServerAuth` and request-scoped Supabase client creation patterns.
   - Audit compatibility view DDL (`security_invoker` settings).
   - Audit `ScanService.ts` for any remaining references to `mockInvoice` or fabricated defaults.
   - Audit `JobQueue.ts` worker processing flow.
3. **Baseline Test Execution**:
   - Run `npm run test` (local test suite).
   - Run `npm run test:migrations` (local PGlite and remote Supabase target schema verification).
4. **Report Generation**:
   - Compile findings into `docs/REGULENTA_PHASE_00_BASELINE_REPORT.md`.

---

## 3. Technical Architecture & Data Strategy

```text
┌─────────────────────────────────┐
│     Phase 00 Baseline Audit     │
└────────────────┬────────────────┘
                 │
                 v
┌─────────────────────────────────┐
│ Environmental & Code Inspection │
│ (Git SHA, Migrations, Routes)   │
└────────────────┬────────────────┘
                 │
                 v
┌─────────────────────────────────┐
│    Baseline Test Executions     │
│  (Local Suite & Supabase Schema)│
└────────────────┬────────────────┘
                 │
                 v
┌─────────────────────────────────┐
│ Deliverable:                    │
│ docs/REGULENTA_PHASE_00_...md   │
└─────────────────────────────────┘
```