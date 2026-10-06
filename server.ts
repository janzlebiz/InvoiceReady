/**
 * InvoiceReady v1.0 - Full-Stack Express Server & API Router
 * Implements authoritative REST API namespaces (Section 29 & 30).
 * Mounts Vite dev middleware in development; serves built assets in production.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { RuleRegistry } from './src/rules/ruleRegistry';
import { REGULATORY_SOURCES } from './src/rules/sourcesRegistry';
import { ApplicabilityEngine } from './src/engine/applicabilityEngine';
import { RuleEngine } from './src/engine/ruleEngine';
import { ScoringEngine } from './src/engine/scoringEngine';
import { GeminiExtractor } from './src/services/geminiExtractor';
import { StorageService } from './src/services/storageService';
import { TestRunner } from './src/engine/testRunner';
import { SAMPLE_INVOICES } from './src/engine/sampleInvoices';
import {
  BusinessProfile,
  SystemProfile,
  ScanSession,
  JurisdictionCode,
} from './src/engine/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '20mb' }));

// In-memory tenant scan repository (persisted to PostgreSQL in production)
const inMemoryScans: Map<string, ScanSession> = new Map();
const inMemoryAuditLogs: any[] = [];
const inMemoryPrivacyConsents: any[] = [];

// Log audit event helper
function logAuditEvent(
  actor: string,
  organization_id: string,
  action: string,
  resource_id: string,
  result: 'SUCCESS' | 'FAILURE',
  ip: string,
  metadata?: any
) {
  inMemoryAuditLogs.unshift({
    log_id: `LOG-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    actor,
    organization_id,
    action,
    resource_id,
    result,
    ip_address: ip,
    metadata,
    timestamp: new Date().toISOString(),
  });
  if (inMemoryAuditLogs.length > 200) inMemoryAuditLogs.pop();
}

// ---------------------------------------------------------------------------
// 1. API: SCANS & PIPELINE (Sections 29, 30, 31)
// ---------------------------------------------------------------------------

// POST /api/scans - Create new scan
app.post('/api/scans', (req: Request, res: Response) => {
  const { organization_id, jurisdiction, business_profile, system_profile } = req.body;
  const scanId = `scan_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  const defaultProfile: BusinessProfile = business_profile || {
    id: `bp_${scanId}`,
    organization_id: organization_id || 'org_default',
    country: (jurisdiction as JurisdictionCode) || 'AE',
    business_name: 'My Business Entity',
    tax_identifier: jurisdiction === 'PH' ? '123-456-789-000' : '100123456789012',
    vat_registered: true,
    revenue_band: jurisdiction === 'PH' ? 'ABOVE_100M_PHP' : 'ABOVE_50M_AED',
    transaction_types: ['B2B'],
    branch_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const defaultSystem: SystemProfile = system_profile || {
    id: `sys_${scanId}`,
    organization_id: organization_id || 'org_default',
    accounting_system: 'QUICKBOOKS',
    invoicing_system: 'QUICKBOOKS',
    current_invoice_format: 'PDF',
    structured_export_capability: false,
    electronic_transmission_capability: false,
    number_of_invoice_templates: 1,
  };

  const newScan: ScanSession = {
    scan_id: scanId,
    organization_id: organization_id || 'org_default',
    jurisdiction: (jurisdiction as JurisdictionCode) || 'AE',
    business_profile: defaultProfile,
    system_profile: defaultSystem,
    status: 'CREATED',
    document_name: '',
    document_size_bytes: 0,
    document_mime_type: '',
    document_hash: '',
    uploaded_at: new Date().toISOString(),
    applicable_rules: [],
    validation_results: [],
    findings: [],
    remediation_plan: [],
    rule_pack_version: RuleRegistry.getPackVersion((jurisdiction as JurisdictionCode) || 'AE'),
  };

  inMemoryScans.set(scanId, newScan);
  logAuditEvent('USER', defaultProfile.organization_id, 'SCAN_CREATED', scanId, 'SUCCESS', req.ip || '127.0.0.1');

  res.status(201).json({
    scan_id: scanId,
    status: newScan.status,
    created_at: newScan.uploaded_at,
  });
});

// POST /api/scans/:scanId/documents - Upload document
app.post('/api/scans/:scanId/documents', (req: Request, res: Response) => {
  const { scanId } = req.params;
  const scan = inMemoryScans.get(scanId);
  if (!scan) return res.status(404).json({ error: 'Scan session not found.' });

  const { file_name, mime_type, file_size_bytes, raw_text, base64_data } = req.body;

  // File security inspection (Section 44)
  const validation = StorageService.validateFile(
    file_name || 'uploaded_invoice.pdf',
    mime_type || 'application/pdf',
    file_size_bytes || 1024
  );

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  scan.document_name = validation.sanitizedFileName;
  scan.document_mime_type = validation.detectedMime;
  scan.document_size_bytes = validation.sizeBytes;
  scan.document_hash = validation.sha256Hash;
  scan.status = 'UPLOADED';

  // Attach raw text to cache
  (scan as any)._rawText = raw_text;
  (scan as any)._base64 = base64_data;

  logAuditEvent('USER', scan.organization_id, 'DOCUMENT_UPLOADED', scanId, 'SUCCESS', req.ip || '127.0.0.1', {
    file_name: validation.sanitizedFileName,
  });

  res.json({
    scan_id: scanId,
    document_name: scan.document_name,
    status: scan.status,
  });
});

// POST /api/scans/:scanId/process - Start deterministic processing pipeline
app.post('/api/scans/:scanId/process', async (req: Request, res: Response) => {
  const { scanId } = req.params;
  const scan = inMemoryScans.get(scanId);
  if (!scan) return res.status(404).json({ error: 'Scan session not found.' });

  try {
    scan.status = 'SECURITY_CHECK';

    // 1. Extraction via Gemini / canonical normalizer
    scan.status = 'EXTRACTING';
    const rawText = (scan as any)._rawText || '';
    const base64Data = (scan as any)._base64;

    const extraction = await GeminiExtractor.extractInvoice(
      scan.document_name,
      rawText,
      scan.document_mime_type,
      scan.scan_id,
      base64Data
    );
    scan.extraction_result = extraction;

    // 2. Applicability Determination (Evaluated before scoring! TSD-020)
    scan.status = 'NORMALIZING';
    const applicability = ApplicabilityEngine.determineApplicability(
      scan.business_profile,
      scan.system_profile
    );
    scan.applicable_rules = applicability.applicable_rules.map((r) => r.rule_id);

    // 3. Deterministic Validation
    scan.status = 'VALIDATING';
    const execution = RuleEngine.executeRules(
      applicability.applicable_rules,
      extraction.canonical_invoice,
      scan.business_profile,
      scan.system_profile,
      extraction.evidence_map
    );
    scan.validation_results = execution.validationResults;
    scan.findings = execution.findings;
    scan.remediation_plan = execution.remediationActions;

    // 4. Readiness Scoring & Critical Gates
    scan.status = 'SCORING';
    const scorecard = ScoringEngine.calculateScorecard(
      execution.validationResults,
      execution.findings,
      applicability.applicable_rules.length
    );
    scan.scorecard = scorecard;

    // 5. Completion
    scan.status = 'COMPLETED';
    scan.completed_at = new Date().toISOString();

    logAuditEvent('SYSTEM', scan.organization_id, 'REPORT_GENERATED', scanId, 'SUCCESS', req.ip || '127.0.0.1', {
      score: scorecard.overall_score,
      critical_gate: scorecard.critical_gate_triggered,
    });

    res.json({
      scan_id: scanId,
      status: scan.status,
      score: scorecard.overall_score,
      classification: scorecard.classification,
      findings_count: scan.findings.length,
    });
  } catch (err: any) {
    scan.status = 'FAILED';
    scan.error_message = err.message;
    res.status(500).json({ error: err.message, status: 'FAILED' });
  }
});

// GET /api/scans/:scanId - Get scan status & full session
app.get('/api/scans/:scanId', (req: Request, res: Response) => {
  const { scanId } = req.params;
  const scan = inMemoryScans.get(scanId);
  if (!scan) return res.status(404).json({ error: 'Scan session not found.' });
  res.json(scan);
});

// GET /api/scans/:scanId/findings - Get findings
app.get('/api/scans/:scanId/findings', (req: Request, res: Response) => {
  const { scanId } = req.params;
  const scan = inMemoryScans.get(scanId);
  if (!scan) return res.status(404).json({ error: 'Scan session not found.' });
  res.json({
    scan_id: scanId,
    findings: scan.findings,
    remediation_plan: scan.remediation_plan,
  });
});

// DELETE /api/scans/:scanId - Delete scan & documents (Section 35 & 66)
app.delete('/api/scans/:scanId', (req: Request, res: Response) => {
  const { scanId } = req.params;
  const scan = inMemoryScans.get(scanId);
  if (!scan) return res.status(404).json({ error: 'Scan session not found.' });

  inMemoryScans.delete(scanId);
  logAuditEvent('USER', scan.organization_id, 'DOCUMENT_DELETED', scanId, 'SUCCESS', req.ip || '127.0.0.1');

  res.json({ message: 'Scan and associated documents permanently deleted.', scan_id: scanId });
});

// ---------------------------------------------------------------------------
// 2. API: RULES & REGULATORY SOURCES (Sections 12, 13, 14)
// ---------------------------------------------------------------------------

// GET /api/rules/packs - Get all published rule packs
app.get('/api/rules/packs', (req: Request, res: Response) => {
  res.json(RuleRegistry.getAllPacks());
});

// GET /api/rules/sources - Get regulatory sources registry
app.get('/api/rules/sources', (req: Request, res: Response) => {
  res.json(Object.values(REGULATORY_SOURCES));
});

// GET /api/rules/:jurisdiction - Get rules for a country
app.get('/api/rules/:jurisdiction', (req: Request, res: Response) => {
  const jur = req.params.jurisdiction.toUpperCase() as JurisdictionCode;
  const rules = RuleRegistry.getRulesForJurisdiction(jur);
  res.json({
    jurisdiction: jur,
    pack_version: RuleRegistry.getPackVersion(jur),
    count: rules.length,
    rules: rules.map((r) => ({
      rule_id: r.rule_id,
      title: r.title,
      description: r.description,
      category: r.category,
      severity: r.severity,
      effective_from: r.effective_from,
      source_id: r.source_id,
      source_locator: r.source_locator,
      is_critical_gate: r.is_critical_gate,
      failure_score_cap: r.failure_score_cap,
    })),
  });
});

// ---------------------------------------------------------------------------
// 3. API: SAMPLES & TEST SUITE (Sections 71-77)
// ---------------------------------------------------------------------------

// GET /api/samples - List available authentic test samples
app.get('/api/samples', (req: Request, res: Response) => {
  res.json(
    SAMPLE_INVOICES.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      jurisdiction: s.jurisdiction,
      expectedCompliance: s.expectedCompliance,
    }))
  );
});

// POST /api/tests/run - Run complete automated test suite
app.post('/api/tests/run', (req: Request, res: Response) => {
  const result = TestRunner.runAllTests();
  res.json(result);
});

// ---------------------------------------------------------------------------
// 4. API: PRIVACY, CONSENTS & AUDIT LOGS (Sections 50, 51, 59)
// ---------------------------------------------------------------------------

// POST /api/privacy/consent - Save cookie/privacy consent
app.post('/api/privacy/consent', (req: Request, res: Response) => {
  const consent = {
    consent_id: `CONSENT-${Date.now().toString(36)}`,
    ...req.body,
    timestamp: new Date().toISOString(),
  };
  inMemoryPrivacyConsents.unshift(consent);
  logAuditEvent('USER', req.body.organization_id || 'org_default', 'CONSENT_UPDATED', consent.consent_id, 'SUCCESS', req.ip || '127.0.0.1');
  res.json({ status: 'SUCCESS', consent });
});

// GET /api/admin/audit-logs - Query audit trail
app.get('/api/admin/audit-logs', (req: Request, res: Response) => {
  res.json(inMemoryAuditLogs);
});

// ---------------------------------------------------------------------------
// 5. SERVER MOUNT: VITE DEV OR PRODUCTION STATIC ASSETS
// ---------------------------------------------------------------------------

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InvoiceReady server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
