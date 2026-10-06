/**
 * InvoiceReady v1.0 - Durable Processing Job Queue & Asynchronous Worker
 * Conforms to Requirements 19-24, Section 32 & 33.
 *
 * Production Hardening Guarantees:
 * 1. Persists every job state in PostgreSQL (survives container restarts).
 * 2. Idempotency across duplicate queue deliveries via x-idempotency-key.
 * 3. Process endpoint only enqueues work and returns 202 with operation ID.
 * 4. Asynchronous worker performs Gemini extraction, normalization, deterministic rules, scoring, and report generation.
 */

import { DatabaseService } from '../db/postgres';
import { StorageService } from './storageService';
import { GeminiExtractor } from './geminiExtractor';
import { ApplicabilityEngine } from '../engine/applicabilityEngine';
import { RuleEngine } from '../engine/ruleEngine';
import { ScoringEngine } from '../engine/scoringEngine';
import { RuleRegistry } from '../rules/ruleRegistry';
import { PdfReportService } from './pdfReportService';

export interface DurableJob {
  operation_id: string;
  scan_id: string;
  organization_id: string;
  attempt_count: number;
  max_attempts: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  payload?: any;
  result?: any;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export class JobQueue {
  /**
   * Registers or retrieves an idempotent operation from PostgreSQL (Requirement 21, 22)
   */
  public static async registerOrGetJob(
    scanId: string,
    organizationId: string,
    operationId: string,
    payload?: any
  ): Promise<{ job: DurableJob; isExisting: boolean }> {
    const { job, isExisting } = await DatabaseService.createOrGetJob(
      operationId,
      scanId,
      organizationId,
      payload
    );

    return {
      job: {
        operation_id: job.operation_id,
        scan_id: job.scan_id,
        organization_id: job.organization_id,
        attempt_count: job.attempt_count || 1,
        max_attempts: job.max_attempts || 3,
        status: job.status,
        payload: typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload,
        result: typeof job.result === 'string' ? JSON.parse(job.result) : job.result,
        error_message: job.error_message,
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
      isExisting,
    };
  }

  public static async getJob(operationId: string, organizationId: string): Promise<DurableJob | null> {
    const job = await DatabaseService.getJob(operationId, organizationId);
    if (!job) return null;
    return {
      operation_id: job.operation_id,
      scan_id: job.scan_id,
      organization_id: job.organization_id,
      attempt_count: job.attempt_count || 1,
      max_attempts: job.max_attempts || 3,
      status: job.status,
      payload: typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload,
      result: typeof job.result === 'string' ? JSON.parse(job.result) : job.result,
      error_message: job.error_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }

  /**
   * Enqueues and dispatches an asynchronous worker task (Requirement 23, 24)
   */
  public static enqueueWorker(
    operationId: string,
    scanId: string,
    organizationId: string,
    userFullName: string = 'Authorized Auditor'
  ): void {
    // Process asynchronously in background
    setImmediate(async () => {
      try {
        await this.executeWorkerTask(operationId, scanId, organizationId, userFullName);
      } catch (err: any) {
        console.error(`Worker error for job ${operationId}:`, err);
        await DatabaseService.updateJobStatus(
          operationId,
          organizationId,
          'FAILED',
          null,
          err.message || 'Worker processing failed'
        );
      }
    });
  }

  /**
   * Worker task: Performs extraction, normalization, deterministic rules, scoring, and report generation (Requirement 24)
   */
  public static async executeWorkerTask(
    operationId: string,
    scanId: string,
    organizationId: string,
    userFullName: string
  ): Promise<any> {
    await DatabaseService.updateJobStatus(operationId, organizationId, 'PROCESSING');

    const scan = await DatabaseService.getScan(scanId, organizationId);
    if (!scan) throw new Error('Scan record not found');

    scan.status = 'EXTRACTING';
    await DatabaseService.updateScan(scan);

    // Read stored file buffer securely
    const fileBuffer = scan.storage_path ? await StorageService.readStoredFile(scan.storage_path) : null;
    const rawText = fileBuffer ? fileBuffer.toString('utf8') : '';

    // 1. Extraction (Requirements 35-44)
    const extraction = await GeminiExtractor.extractInvoice(
      scan.document_name || 'invoice.pdf',
      rawText,
      scan.document_mime_type || 'application/pdf',
      scan.scan_id
    );

    if (extraction.status === 'FAILED') {
      scan.status = 'FAILED';
      scan.error_message = extraction.error_message || 'Document extraction failed.';
      await DatabaseService.updateScan(scan);
      await DatabaseService.updateJobStatus(
        operationId,
        organizationId,
        'FAILED',
        null,
        scan.error_message
      );
      return { status: 'FAILED', error: scan.error_message };
    }

    scan.extraction_result = extraction;

    // 2. Applicability Determination executed BEFORE scoring (Requirement 45)
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

    // 4. Scoring using Versioned Rule Pack Configuration (Requirements 46-48)
    scan.status = 'SCORING';
    const packConfig = RuleRegistry.getPackConfig(scan.rule_pack_version);
    const scorecard = ScoringEngine.calculateScorecard(
      execution.validationResults,
      execution.findings,
      applicability.applicable_rules.length,
      packConfig
    );
    scan.scorecard = scorecard;

    // 5. Completion & Report Generation (Requirements 58-60)
    scan.status = scorecard.definitive_score_blocked ? 'REVIEW_REQUIRED' : 'COMPLETED';
    scan.completed_at = new Date().toISOString();

    // Generate persistent PDF report
    let reportUrl: string | undefined = undefined;
    try {
      const reportRes = await PdfReportService.generateAndSaveReport(scan, userFullName);
      reportUrl = reportRes.downloadUrl;
    } catch (repErr: any) {
      console.warn('PDF report generation warning:', repErr.message);
    }

    await DatabaseService.updateScan(scan);

    const processResult = {
      scan_id: scan.scan_id,
      operation_id: operationId,
      status: scan.status,
      overall_score: scorecard.overall_score,
      classification: scorecard.classification,
      definitive_score_blocked: scorecard.definitive_score_blocked,
      critical_gate_triggered: scorecard.critical_gate_triggered,
      findings_count: scan.findings.length,
      report_url: reportUrl,
      completed_at: scan.completed_at,
    };

    await DatabaseService.updateJobStatus(operationId, organizationId, 'COMPLETED', processResult);
    return processResult;
  }
}
