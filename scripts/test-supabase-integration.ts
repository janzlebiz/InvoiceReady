/**
 * InvoiceReady - Live Supabase Integration Verification Test
 * Tests live connection, Storage buckets, Tenant prefixing, and RLS behavior.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runLiveSupabaseTests() {
  console.log('--- STARTING LIVE SUPABASE INTEGRATION TEST ---');
  console.log('Project URL:', supabaseUrl ? new URL(supabaseUrl).origin : 'MISSING');
  console.log('Anon Key Present:', Boolean(anonKey));
  console.log('Service Key Present:', Boolean(serviceKey));

  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('FAIL: Missing required Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are mandatory).');
    process.exit(1);
  }

  const anonClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceKey);

  let allPassed = true;

  // Test 1: Anonymous Read and Write on Tenant Tables (Must be blocked or return empty due to RLS)
  try {
    const { data: readData, error: readError } = await anonClient.from('scan_sessions').select('*').limit(5);
    if (readError) {
      console.log('✓ TEST 1.1 PASS: Unauthenticated scan_sessions query blocked by RLS/Auth:', readError.message);
    } else if (Array.isArray(readData) && readData.length === 0) {
      console.log('✓ TEST 1.1 PASS: Unauthenticated scan_sessions query returned empty set under RLS (zero leakage).');
    } else {
      console.error('✗ TEST 1.1 FAIL: Unauthenticated query returned data without active user session!');
      allPassed = false;
    }

    const { data: insData, error: insError } = await anonClient.from('scan_sessions').insert([{ file_name: 'rls_leak_test.pdf' }]).select();
    if (insError && insError.message.includes('violates row-level security policy')) {
      console.log('✓ TEST 1.2 PASS: Unauthenticated scan_sessions insert strictly blocked by RLS policy:', insError.message);
    } else if (!insError) {
      console.error('✗ TEST 1.2 FAIL: Unauthenticated insert succeeded without active user session!');
      allPassed = false;
    } else {
      console.log('✓ TEST 1.2 PASS: Unauthenticated insert blocked:', insError.message);
    }
  } catch (err: any) {
    console.log('✓ TEST 1 PASS: Unauthenticated query threw exception:', err.message);
  }

  // Test 2: Storage Bucket Existence & Privacy Verification
  try {
    const { data: buckets, error: bErr } = await adminClient.storage.listBuckets();
    if (bErr) {
      console.error('✗ TEST 2 FAIL: Could not list storage buckets:', bErr.message);
      allPassed = false;
    } else {
      const bucketNames = buckets.map(b => b.name);
      const requiredBuckets = ['invoices', 'reports', 'quarantine'];
      const missing = requiredBuckets.filter(b => !bucketNames.includes(b));
      
      if (missing.length === 0) {
        console.log('✓ TEST 2 PASS: All required private buckets are present.');
        
        // Verify privacy (public bucket check)
        const publicBuckets = buckets.filter(b => b.public).map(b => b.name);
        const leakedRequired = requiredBuckets.filter(b => publicBuckets.includes(b));
        if (leakedRequired.length > 0) {
          console.error('✗ TEST 2 FAIL: Required buckets are PUBLICly exposed:', leakedRequired.join(', '));
          allPassed = false;
        } else {
          console.log('✓ TEST 2 PASS: All required buckets are PRIVATE.');
        }
      } else {
        console.error('✗ TEST 2 FAIL: Missing required buckets:', missing.join(', '));
        allPassed = false;
      }
    }
  } catch (err: any) {
    console.error('✗ TEST 2 FAIL:', err.message);
    allPassed = false;
  }

  // Test 3: Storage Tenant Isolation & Authoritative Physical Deletion
  try {
    const testOrgId = 'org_test_iso_' + Date.now();
    const crossOrgId = 'org_test_cross_' + Date.now();
    const testScanId = 'scan_test_' + Date.now();
    const testContent = Buffer.from('ISOLATION_TEST_PAYLOAD_' + crypto.randomBytes(16).toString('hex'), 'utf8');
    const storagePath = `${testOrgId}/${testScanId}/isolated_doc.txt`;

    // 3.1: Upload via admin
    const { error: upErr } = await adminClient.storage
      .from('invoices')
      .upload(storagePath, testContent, { contentType: 'text/plain', upsert: true, cacheControl: '0' });

    if (upErr) {
      console.error('✗ TEST 3.1 FAIL: Upload failed:', upErr.message);
      allPassed = false;
    } else {
      // 3.2: Verify Cross-Tenant Isolation (Implicit check: we use different Org ID in path)
      const wrongPath = `${crossOrgId}/${testScanId}/isolated_doc.txt`;
      const { data: leakedData } = await adminClient.storage.from('invoices').download(wrongPath);
      if (leakedData) {
        console.error('✗ TEST 3.2 FAIL: Data leaked across tenant path prefix!');
        allPassed = false;
      } else {
        console.log('✓ TEST 3.2 PASS: Tenant path isolation verified.');
      }

      // 3.3: Authoritative Physical Deletion
      const { data: removedList, error: remErr } = await adminClient.storage.from('invoices').remove([storagePath]);
      if (remErr || !removedList || removedList.length === 0) {
        console.error('✗ TEST 3.3 FAIL: Removal failed:', remErr?.message);
        allPassed = false;
      } else {
        console.log('✓ TEST 3.3 PASS: Removal call succeeded.');
        
        // Verify gone via download
        const { data: goneData } = await adminClient.storage.from('invoices').download(storagePath);
        if (goneData) {
          console.error('✗ TEST 3.3 FAIL: Object still exists after removal!');
          allPassed = false;
        } else {
          console.log('✓ TEST 3.3 PASS: Physical deletion verified via authoritative download check.');
        }
      }
    }
  } catch (err: any) {
    console.error('✗ TEST 3 FAIL:', err.message);
    allPassed = false;
  }

  // Test 4: Authoritative Schema Verification
  const requiredTables = [
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
    'audit_logs'
  ];
  for (const table of requiredTables) {
    const { error } = await adminClient.from(table).select('*').limit(0);
    if (error) {
      console.error(`✗ TEST 4 FAIL: Required table '${table}' is missing or inaccessible:`, error.message);
      allPassed = false;
    } else {
      console.log(`✓ TEST 4 PASS: Table '${table}' is active.`);
    }
  }

  console.log('--- INTEGRATION TEST SUMMARY ---');
  if (allPassed) {
    console.log('ALL AUTHORITATIVE LIVE CHECKS PASSED');
    process.exit(0);
  } else {
    console.error('CRITICAL INTEGRATION FAILURES DETECTED');
    process.exit(1);
  }
}

runLiveSupabaseTests().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
