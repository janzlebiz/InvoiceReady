/**
 * InvoiceReady v1.0 - Reproducible Fresh-Database & Upgrade Migration Test Suite
 * Validates:
 * 1. Fresh-database migration application from scratch applying versioned migrations (0001..0004).
 * 2. Existing-database upgrade migration with representative legacy data preservation.
 * 3. Repeatability and idempotency of migrations.
 */

import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

function getMigrationFiles(): { name: string; sql: string }[] {
  const dir = path.resolve(process.cwd(), 'supabase/migrations');
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found at ${dir}`);
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  return files.map(f => ({
    name: f,
    sql: fs.readFileSync(path.join(dir, f), 'utf8')
  }));
}

async function runMigrationTests() {
  console.log('================================================================');
  console.log('       INVOICEREADY MIGRATION & UPGRADE VERIFICATION SUITE       ');
  console.log('================================================================');

  let passed = true;
  const results: { name: string; passed: boolean; details: string }[] = [];
  const migrations = getMigrationFiles();
  console.log(`Found ${migrations.length} versioned migration files in supabase/migrations/`);

  // -------------------------------------------------------------------------
  // TEST 1: Fresh-Database Migration Test
  // -------------------------------------------------------------------------
  console.log('\n[1/3] Running Fresh-Database Migration Test...');
  try {
    const freshDb = new PGlite();

    for (const m of migrations) {
      await freshDb.exec(m.sql);
    }

    const tablesToCheck = [
      'organizations',
      'profiles',
      'organization_users',
      'business_profiles',
      'system_profiles',
      'scan_sessions',
      'scan_documents',
      'scan_reports',
      'findings',
      'remediations',
      'job_queue',
      'audit_logs',
      'privacy_consents',
      'privacy_requests'
    ];

    let allFreshTablesPresent = true;
    for (const t of tablesToCheck) {
      const res = await freshDb.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${t}'`);
      if (res.rows.length === 0) {
        allFreshTablesPresent = false;
        console.error(`  ✗ Fresh migration missing table: ${t}`);
      }
    }

    const bucketRes = await freshDb.query(`SELECT id FROM storage.buckets`);
    const bucketIds = bucketRes.rows.map((r: any) => r.id);
    const bucketsValid = bucketIds.includes('quarantine') && bucketIds.includes('invoices') && bucketIds.includes('reports');

    await freshDb.close();

    const freshPass = allFreshTablesPresent && bucketsValid;
    results.push({
      name: 'FRESH-DATABASE-MIGRATION-001',
      passed: freshPass,
      details: freshPass
        ? 'Fresh database migrations applied successfully; all 14 tables and storage buckets verified.'
        : `Fresh migration incomplete: tablesPresent=${allFreshTablesPresent}, bucketsValid=${bucketsValid}`
    });
    console.log(`  ✓ Fresh-Database Migration: ${freshPass ? 'PASS' : 'FAIL'}`);
    if (!freshPass) passed = false;
  } catch (err: any) {
    passed = false;
    results.push({
      name: 'FRESH-DATABASE-MIGRATION-001',
      passed: false,
      details: `Fresh migration failed with exception: ${err.message}`
    });
    console.error('  ✗ Fresh-Database Migration threw exception:', err);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Existing-Database Upgrade Test (Legacy v1.0 Schema + Legacy Data)
  // -------------------------------------------------------------------------
  console.log('\n[2/3] Running Existing-Database Upgrade Test with Legacy Data...');
  try {
    const upgradeDb = new PGlite();

    // Setup legacy schema
    await upgradeDb.exec(`
      CREATE TABLE IF NOT EXISTS public.organizations (
        organization_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        country_code VARCHAR(2) NOT NULL DEFAULT 'AE',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.scan_sessions (
        session_id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id),
        jurisdiction VARCHAR(2) NOT NULL DEFAULT 'AE',
        status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
        business_profile JSONB DEFAULT '{}'::jsonb,
        system_profile JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed legacy data
    await upgradeDb.exec(`
      INSERT INTO public.organizations (organization_id, name, country_code)
      VALUES ('org_legacy_001', 'Legacy Trading FZE', 'AE');

      INSERT INTO public.scan_sessions (session_id, organization_id, jurisdiction, status, business_profile)
      VALUES ('scan_legacy_001', 'org_legacy_001', 'AE', 'COMPLETED', '{"business_name": "Legacy Trading FZE"}');
    `);

    // Verify pre-upgrade state
    const preRes = await upgradeDb.query(`SELECT session_id, status FROM public.scan_sessions WHERE session_id = 'scan_legacy_001'`);
    const legacyDataIntactBefore = preRes.rows.length === 1 && (preRes.rows[0] as any).status === 'COMPLETED';

    // Apply migrations 0001 through 0004 sequentially
    for (const m of migrations) {
      await upgradeDb.exec(m.sql);
    }

    // Verify data preservation
    const postRes = await upgradeDb.query(`SELECT session_id, organization_id, jurisdiction, status FROM public.scan_sessions WHERE session_id = 'scan_legacy_001'`);
    const postRow = postRes.rows[0] as any;
    const legacyDataPreserved = postRes.rows.length === 1 &&
      postRow.organization_id === 'org_legacy_001' &&
      postRow.status === 'COMPLETED' &&
      postRow.jurisdiction === 'AE';

    // Verify upgraded tables
    const newTableCheck = await upgradeDb.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_queue'`);
    const upgradeComplete = newTableCheck.rows.length === 1;

    await upgradeDb.close();

    const upgradePass = legacyDataIntactBefore && legacyDataPreserved && upgradeComplete;
    results.push({
      name: 'EXISTING-DATABASE-UPGRADE-001',
      passed: upgradePass,
      details: upgradePass
        ? 'Upgrade migration applied successfully over legacy schema; representative legacy data fully preserved.'
        : `Upgrade test failed: legacyIntact=${legacyDataIntactBefore}, preserved=${legacyDataPreserved}, upgradeComplete=${upgradeComplete}`
    });
    console.log(`  ✓ Existing-Database Upgrade: ${upgradePass ? 'PASS' : 'FAIL'}`);
    if (!upgradePass) passed = false;
  } catch (err: any) {
    passed = false;
    results.push({
      name: 'EXISTING-DATABASE-UPGRADE-001',
      passed: false,
      details: `Upgrade migration failed with exception: ${err.message}`
    });
    console.error('  ✗ Existing-Database Upgrade threw exception:', err);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Migration Repeatability & Idempotency Test
  // -------------------------------------------------------------------------
  console.log('\n[3/3] Running Migration Repeatability & Idempotency Test...');
  try {
    const repeatDb = new PGlite();

    // First pass
    for (const m of migrations) {
      await repeatDb.exec(m.sql);
    }

    // Second pass (idempotency check)
    let repeatabilityPassed = true;
    try {
      for (const m of migrations) {
        await repeatDb.exec(m.sql);
      }
    } catch (repErr: any) {
      repeatabilityPassed = false;
      console.error('  ✗ Repeat application threw error:', repErr.message);
    }

    await repeatDb.close();

    results.push({
      name: 'MIGRATION-REPEATABILITY-001',
      passed: repeatabilityPassed,
      details: repeatabilityPassed
        ? 'Versioned migration scripts are fully idempotent and repeatable without failure.'
        : 'Migration scripts failed on second consecutive execution.'
    });
    console.log(`  ✓ Migration Repeatability: ${repeatabilityPassed ? 'PASS' : 'FAIL'}`);
    if (!repeatabilityPassed) passed = false;
  } catch (err: any) {
    passed = false;
    results.push({
      name: 'MIGRATION-REPEATABILITY-001',
      passed: false,
      details: `Repeatability test threw exception: ${err.message}`
    });
  }

  console.log('\n================================================================');
  console.log('              MIGRATION TEST SUITE SUMMARY                     ');
  console.log('================================================================');
  let successCount = 0;
  for (const r of results) {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark} | ${r.name}`);
    console.log(`       ${r.details}`);
    if (r.passed) successCount++;
  }
  console.log('----------------------------------------------------------------');
  console.log(`Total Migration Tests: ${results.length} | Passed: ${successCount} | Failed: ${results.length - successCount}`);
  console.log('================================================================\n');

  if (successCount !== results.length || !passed) {
    console.error('MIGRATION TEST SUITE FAILED');
    process.exit(1);
  } else {
    console.log('ALL MIGRATION TESTS PASSED SUCCESSFULLY');
    process.exit(0);
  }
}

runMigrationTests().catch((e) => {
  console.error('Uncaught exception in migration test suite:', e);
  process.exit(1);
});
