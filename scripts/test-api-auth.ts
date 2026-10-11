/**
 * REGULENTA Phase 01 AUTH — Direct API Route Handler Integration Test Suite
 * Tests actual Next.js route handlers against negative and positive authorization cases:
 * 1. Missing Authorization header (401)
 * 2. Malformed / Forged / Expired JWT (401)
 * 3. Role-Based Authorization & Privilege Escalation (403 for VIEWER on POST/DELETE)
 * 4. Cross-Tenant Access Attempt (Org B trying to access Org A resource) (403/404)
 * 5. Authorized Positive Controls (200 for valid JWT + authorized tenant/role)
 */

import { NextRequest } from 'next/server';
import { POST as createScanPOST, GET as listScansGET } from '../app/api/scans/route';
import { GET as getScanGET, DELETE as deleteScanDELETE } from '../app/api/scans/[scanId]/route';
import { POST as uploadDocPOST } from '../app/api/scans/[scanId]/documents/route';
import { POST as processScanPOST } from '../app/api/scans/[scanId]/process/route';
import { GET as getPdfGET } from '../app/api/scans/[scanId]/report/pdf/route';
import { POST as extractPOST } from '../app/api/extract/route';
import { DatabaseService } from '../src/db/postgres';
import { ScanService } from '../src/services/scanService';
import { TokenVerifier } from '../src/auth/tokenVerifier';

interface TestResult {
  testId: string;
  name: string;
  passed: boolean;
  expectedStatus: number;
  actualStatus: number;
  details: string;
}

async function runApiAuthTests() {
  console.log('================================================================');
  console.log('       REGULENTA Phase 01 AUTH — API Route Handler Test Suite     ');
  console.log('================================================================');

  await DatabaseService.initialize();

  const results: TestResult[] = [];

  const addResult = (testId: string, name: string, expectedStatus: number, actualStatus: number, responseBody: any) => {
    const passed = expectedStatus === actualStatus;
    results.push({
      testId,
      name,
      passed,
      expectedStatus,
      actualStatus,
      details: passed
        ? `Status matches expected ${expectedStatus}. Response: ${JSON.stringify(responseBody)}`
        : `EXPECTED ${expectedStatus} BUT GOT ${actualStatus}. Response: ${JSON.stringify(responseBody)}`,
    });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'} | ${testId.padEnd(25)} | Expected: ${expectedStatus} | Actual: ${actualStatus}`);
  };

  const makeReq = (url: string, method: string = 'GET', headers: Record<string, string> = {}, body?: any) => {
    const init: RequestInit = {
      method,
      headers: new Headers(headers),
    };
    if (body) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
      (init.headers as Headers).set('content-type', 'application/json');
    }
    return new NextRequest(new URL(url, 'http://localhost:3000'), init);
  };

  // ---------------------------------------------------------------------------
  // 1. UNAUTHENTICATED REQUESTS (Missing Authorization Header) -> 401
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Testing Unauthenticated Requests (No Auth Header) ---');

  {
    const req = makeReq('http://localhost:3000/api/scans', 'POST', {}, { jurisdiction: 'AE' });
    const res = await createScanPOST(req);
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-UNAUTH-001', 'POST /api/scans without Auth header', 401, res.status, json);
  }

  {
    const req = makeReq('http://localhost:3000/api/scans', 'GET', {});
    const res = await listScansGET(req);
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-UNAUTH-002', 'GET /api/scans without Auth header', 401, res.status, json);
  }

  {
    const req = makeReq('http://localhost:3000/api/scans/scan_dummy_123', 'GET', {});
    const res = await getScanGET(req, { params: Promise.resolve({ scanId: 'scan_dummy_123' }) });
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-UNAUTH-003', 'GET /api/scans/[scanId] without Auth header', 401, res.status, json);
  }

  {
    const req = makeReq('http://localhost:3000/api/scans/scan_dummy_123', 'DELETE', {});
    const res = await deleteScanDELETE(req, { params: Promise.resolve({ scanId: 'scan_dummy_123' }) });
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-UNAUTH-004', 'DELETE /api/scans/[scanId] without Auth header', 401, res.status, json);
  }

  {
    const req = makeReq('http://localhost:3000/api/scans/scan_dummy_123/process', 'POST', {}, { force_reprocess: true });
    const res = await processScanPOST(req, { params: Promise.resolve({ scanId: 'scan_dummy_123' }) });
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-UNAUTH-005', 'POST /api/scans/[scanId]/process without Auth header', 401, res.status, json);
  }

  {
    const req = makeReq('http://localhost:3000/api/scans/scan_dummy_123/report/pdf', 'GET', {});
    const res = await getPdfGET(req, { params: Promise.resolve({ scanId: 'scan_dummy_123' }) });
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-UNAUTH-006', 'GET /api/scans/[scanId]/report/pdf without Auth header', 401, res.status, json);
  }

  {
    const req = makeReq('http://localhost:3000/api/extract', 'POST', {}, { scanId: 'scan_1', documentId: 'doc_1' });
    const res = await extractPOST(req);
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-UNAUTH-007', 'POST /api/extract without Auth header', 401, res.status, json);
  }

  // ---------------------------------------------------------------------------
  // 2. MALFORMED / FORGED / EXPIRED JWT -> 401
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Malformed / Forged / Expired JWT ---');

  const badHeaders = { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.forged.signature' };

  {
    const req = makeReq('http://localhost:3000/api/scans', 'POST', badHeaders, { jurisdiction: 'AE' });
    const res = await createScanPOST(req);
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-FORGED-001', 'POST /api/scans with forged JWT', 401, res.status, json);
  }

  {
    const req = makeReq('http://localhost:3000/api/scans', 'GET', badHeaders);
    const res = await listScansGET(req);
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-FORGED-002', 'GET /api/scans with forged JWT', 401, res.status, json);
  }

  // ---------------------------------------------------------------------------
  // 3. ROLE-BASED AUTHORIZATION & PRIVILEGE ESCALATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Role Authorization & Privilege Escalation ---');

  const userAlphaOwner = await DatabaseService.resolveUserAndTenant('usr_alpha_owner_001', 'owner@alpha.com', 'Alpha Owner');
  await DatabaseService.updateUserRole(userAlphaOwner.userId, userAlphaOwner.organizationId, 'OWNER');

  const userAlphaViewer = await DatabaseService.resolveUserAndTenant('usr_alpha_viewer_001', 'viewer@alpha.com', 'Alpha Viewer');
  await DatabaseService.updateUserRole(userAlphaViewer.userId, userAlphaViewer.organizationId, 'VIEWER');

  // Test VIEWER role attempting POST /api/scans
  {
    TokenVerifier.setMockUser({
      uid: userAlphaViewer.userId,
      email: 'viewer@alpha.com',
      name: 'Alpha Viewer',
      emailVerified: true,
      isAnonymous: false,
    });
    const headers = { Authorization: 'Bearer mock-test-token' };
    const req = makeReq('http://localhost:3000/api/scans', 'POST', headers, { jurisdiction: 'AE' });
    const res = await createScanPOST(req);
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-RBAC-001', 'POST /api/scans blocked for VIEWER role', 403, res.status, json);
    TokenVerifier.setMockUser(null);
  }

  // Test VIEWER role attempting DELETE /api/scans/[scanId]
  {
    TokenVerifier.setMockUser({
      uid: userAlphaViewer.userId,
      email: 'viewer@alpha.com',
      name: 'Alpha Viewer',
      emailVerified: true,
      isAnonymous: false,
    });
    const headers = { Authorization: 'Bearer mock-test-token' };
    const req = makeReq('http://localhost:3000/api/scans/scan_dummy_999', 'DELETE', headers);
    const res = await deleteScanDELETE(req, { params: Promise.resolve({ scanId: 'scan_dummy_999' }) });
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-RBAC-002', 'DELETE /api/scans/[scanId] blocked for VIEWER role', 403, res.status, json);
    TokenVerifier.setMockUser(null);
  }

  // ---------------------------------------------------------------------------
  // 4. AUTHORIZED POSITIVE CONTROLS & CROSS-TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Authorized Positive Controls & Cross-Tenant Access ---');

  let createdScanId = '';

  // Positive Control: OWNER creating scan via POST /api/scans
  {
    TokenVerifier.setMockUser({
      uid: userAlphaOwner.userId,
      email: 'owner@alpha.com',
      name: 'Alpha Owner',
      emailVerified: true,
      isAnonymous: false,
    });
    const headers = { Authorization: 'Bearer mock-test-token' };
    const req = makeReq('http://localhost:3000/api/scans', 'POST', headers, {
      jurisdiction: 'AE',
      business_profile: { company_name: 'Alpha Corp' },
      system_profile: { ERP_type: 'SAP' },
    });
    const res = await createScanPOST(req);
    const json = await res.json().catch(() => ({}));
    createdScanId = json.scan_id || '';
    addResult('AUTH-POS-001', 'POST /api/scans succeeds for authorized OWNER', 200, res.status, json);
    TokenVerifier.setMockUser(null);
  }

  // Positive Control: OWNER listing scans via GET /api/scans
  {
    TokenVerifier.setMockUser({
      uid: userAlphaOwner.userId,
      email: 'owner@alpha.com',
      name: 'Alpha Owner',
      emailVerified: true,
      isAnonymous: false,
    });
    const headers = { Authorization: 'Bearer mock-test-token' };
    const req = makeReq('http://localhost:3000/api/scans', 'GET', headers);
    const res = await listScansGET(req);
    const json = await res.json().catch(() => ([]));
    addResult('AUTH-POS-002', 'GET /api/scans lists tenant scans for authorized OWNER', 200, res.status, { count: json.length });
    TokenVerifier.setMockUser(null);
  }

  // Cross-Tenant Access Control: User from Tenant Beta attempting to access Tenant Alpha scan
  const userBetaOwner = await DatabaseService.resolveUserAndTenant('usr_beta_owner_001', 'owner@beta.com', 'Beta Owner');
  await DatabaseService.updateUserRole(userBetaOwner.userId, userBetaOwner.organizationId, 'OWNER');

  {
    TokenVerifier.setMockUser({
      uid: userBetaOwner.userId,
      email: 'owner@beta.com',
      name: 'Beta Owner',
      emailVerified: true,
      isAnonymous: false,
    });
    const headers = { Authorization: 'Bearer mock-test-token' };
    const req = makeReq(`http://localhost:3000/api/scans/${createdScanId}`, 'GET', headers);
    const res = await getScanGET(req, { params: Promise.resolve({ scanId: createdScanId }) });
    const json = await res.json().catch(() => ({}));
    addResult('AUTH-CROSS-TENANT-002', 'Beta tenant reading Alpha scan returns 404 (not found in tenant)', 404, res.status, json);
    TokenVerifier.setMockUser(null);
  }

  // Direct database level isolation check
  const crossTenantDbResult = await ScanService.getScan(createdScanId, userBetaOwner.organizationId);
  const isBlockedInDb = crossTenantDbResult === null;
  addResult(
    'AUTH-CROSS-TENANT-003',
    'Database tenant query isolates resource from cross-tenant lookup',
    200,
    isBlockedInDb ? 200 : 500,
    { isolated: isBlockedInDb }
  );

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('             API AUTH TEST SUITE EXECUTION SUMMARY               ');
  console.log('================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Total API Auth Tests: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);
  console.log('================================================================\n');

  if (passedCount !== results.length) {
    console.error('API ROUTE AUTH SUITE FAILED');
    process.exit(1);
  } else {
    console.log('ALL API ROUTE AUTH CHECKS PASSED SUCCESSFULLY');
    process.exit(0);
  }
}

runApiAuthTests().catch((e) => {
  console.error('UNCAUGHT API AUTH SUITE FAILURE:', e);
  process.exit(1);
});
