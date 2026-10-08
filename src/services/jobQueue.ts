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
import { DocumentParser } from './documentParser';
import { CloudTasksClient } from '@google-cloud/tasks';

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

  private static supervisorTimer: NodeJS.Timeout | null = null;
  private static isProcessingLoopActive = false;

  /**
   * Starts the durable Queue Worker Supervisor.
   * Periodically scans PostgreSQL for pending QUEUED or stalled jobs across container restarts.
   */
  public static startWorkerSupervisor(): void {
    if (this.supervisorTimer) return;
    // Immediate recovery sweep on container boot
    this.recoverAndProcessPendingJobs().catch((err) =>
      console.warn('Initial job recovery sweep warning:', err.message)
    );

    // Periodic supervisor sweep every 10 seconds
    this.supervisorTimer = setInterval(() => {
      this.recoverAndProcessPendingJobs().catch((err) =>
        console.warn('Supervisor queue sweep warning:', err.message)
      );
    }, 10000);
  }

  public static stopWorkerSupervisor(): void {
    if (this.supervisorTimer) {
      clearInterval(this.supervisorTimer);
      this.supervisorTimer = null;
    }
  }

  /**
   * Recovers orphaned or pending jobs from PostgreSQL across container restarts (Requirement 5, 20)
   */
  public static async recoverAndProcessPendingJobs(): Promise<void> {
    if (this.isProcessingLoopActive) return;
    this.isProcessingLoopActive = true;

    try {
      const pendingJobs = await DatabaseService.getPendingQueueJobs();
      for (const job of pendingJobs) {
        const maxAttempts = job.max_attempts || 3;
        if (job.status === 'QUEUED' || (job.status === 'PROCESSING' && job.attempt_count < maxAttempts)) {
          await this.executeWorkerTask(
            job.operation_id,
            job.scan_id,
            job.organization_id,
            'Queue Supervisor'
          );
        }
      }
    } catch (err: any) {
      // Avoid crashing server during transient DB polling
    } finally {
      this.isProcessingLoopActive = false;
    }
  }

  private static tasksClient: CloudTasksClient | null = null;

  /**
   * Real Google Cloud Tasks createTask() dispatch (Requirement 4)
   */
  public static async dispatchCloudTask(
    operationId: string,
    scanId: string,
    organizationId: string,
    userFullName: string
  ): Promise<{ taskName: string; queue: string }> {
    const queue = process.env.CLOUD_TASKS_QUEUE;
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const appUrl = process.env.APP_URL;
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, require CLOUD_TASKS_LOCATION with zero fallback/default
    const location = isProduction
      ? process.env.CLOUD_TASKS_LOCATION
      : (process.env.CLOUD_TASKS_LOCATION || 'asia-east1');

    if (!queue || !project || !appUrl) {
      throw new Error('Cloud Tasks configuration missing (CLOUD_TASKS_QUEUE, GOOGLE_CLOUD_PROJECT, or APP_URL).');
    }

    if (isProduction && (!location || location.trim() === '')) {
      throw new Error('FATAL: CLOUD_TASKS_LOCATION must be explicitly configured in production (no defaults allowed).');
    }

    if (!this.tasksClient) {
      this.tasksClient = new CloudTasksClient();
    }

    const parent = this.tasksClient.queuePath(project, location!, queue);
    const workerUrl = `${appUrl}/api/internal/queue/worker`;
    const taskSecret = process.env.INTERNAL_TASK_SECRET;

    if (!taskSecret) {
      if (isProduction) {
        throw new Error('FATAL: INTERNAL_TASK_SECRET must be configured in production for Cloud Tasks dispatch.');
      }
    }

    // In production, require CLOUD_TASKS_SERVICE_ACCOUNT and CLOUD_TASKS_AUDIENCE with zero fallbacks
    const serviceAccountEmail = isProduction
      ? process.env.CLOUD_TASKS_SERVICE_ACCOUNT
      : (process.env.CLOUD_TASKS_SERVICE_ACCOUNT || process.env.SCHEDULER_SERVICE_ACCOUNT);

    const audience = isProduction
      ? process.env.CLOUD_TASKS_AUDIENCE
      : (process.env.CLOUD_TASKS_AUDIENCE || process.env.SCHEDULER_AUDIENCE || workerUrl);

    if (isProduction) {
      if (!serviceAccountEmail || serviceAccountEmail.trim() === '') {
        throw new Error('FATAL: CLOUD_TASKS_SERVICE_ACCOUNT must be explicitly configured in production (no fallbacks allowed).');
      }
      if (!audience || audience.trim() === '') {
        throw new Error('FATAL: CLOUD_TASKS_AUDIENCE must be explicitly configured in production (no fallbacks allowed).');
      }
    }

    const payload = {
      operation_id: operationId,
      scan_id: scanId,
      organization_id: organizationId,
      user_full_name: userFullName,
      dispatched_at: new Date().toISOString(),
    };

    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: workerUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Task-Secret': taskSecret || '',
        },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        ...(serviceAccountEmail && audience ? {
          oidcToken: {
            serviceAccountEmail,
            audience,
          },
        } : {}),
      },
    };

    const [response] = await this.tasksClient.createTask({ parent, task });
    if (!response.name) {
      throw new Error(`Google Cloud Tasks creation failed: response.name is missing for operation ${operationId}`);
    }
    return { taskName: response.name, queue };
  }

  /**
   * Managed Asynchronous Queue Dispatcher (Requirements 4, 5, 19, 20, 23, 24)
   * Dispatches task via Cloud Tasks HTTP queue or persistent Queue Supervisor
   */
  public static async enqueueWorker(
    operationId: string,
    scanId: string,
    organizationId: string,
    userFullName: string = 'Authorized Auditor'
  ): Promise<void> {
    const isCloudTasksConfigured = Boolean(
      process.env.CLOUD_TASKS_QUEUE &&
      process.env.GOOGLE_CLOUD_PROJECT &&
      process.env.APP_URL
    );

    // 1. If Google Cloud Tasks is configured in GCP, attempt real createTask() dispatch
    if (isCloudTasksConfigured) {
      try {
        const { taskName, queue } = await this.dispatchCloudTask(operationId, scanId, organizationId, userFullName);
        console.log(`[CloudTasks] Successfully dispatched task ${taskName} to queue ${queue}`);
        return;
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`FATAL: Production Cloud Tasks dispatch failed: ${err.message}`);
        }
        console.warn(`[CloudTasks] Real dispatch unavailable (${err.message}). Using durable supervisor for worker execution.`);
      }
    }

    // 2. Managed Durable Worker Execution via asynchronous microtask scheduling with supervisor retry tracking
    queueMicrotask(async () => {
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
   * Enforces atomic lease claiming to prevent concurrent duplicate execution between Cloud Tasks and recovery supervisor.
   */
  public static async executeWorkerTask(
    operationId: string,
    scanId: string,
    organizationId: string,
    userFullName: string,
    workerAuthMetadata?: {
      authenticated_via: string;
      service_account: string;
      audience: string;
      verified_at: string;
    }
  ): Promise<any> {
    const workerId = `worker_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;
    const claimed = await DatabaseService.claimJobLease(operationId, organizationId, workerId, 180);

    if (!claimed) {
      console.log(`[JobQueue] Job ${operationId} is already actively claimed or completed. Skipping concurrent execution.`);
      const existingJob = await DatabaseService.getJob(operationId, organizationId);
      return existingJob?.result || { status: existingJob?.status || 'PROCESSING' };
    }

    const scan = await DatabaseService.getScan(scanId, organizationId);
    if (!scan) throw new Error('Scan record not found');

    scan.status = 'EXTRACTING';
    await DatabaseService.updateScan(scan);

    // Read stored file buffer securely and extract text via DocumentParser (RC2.1 Item 4)
    const fileBuffer = scan.storage_path ? await StorageService.readStoredFile(scan.storage_path) : null;
    const rawText = fileBuffer
      ? await DocumentParser.extractDocumentText(
          fileBuffer,
          scan.document_name || 'invoice.pdf',
          scan.document_mime_type || 'application/pdf'
        )
      : '';

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
      worker_oidc_authenticated: workerAuthMetadata ? workerAuthMetadata.authenticated_via === 'GOOGLE_OIDC' : false,
      worker_service_account: workerAuthMetadata?.service_account || '',
      worker_audience: workerAuthMetadata?.audience || '',
    };

    await DatabaseService.updateJobStatus(operationId, organizationId, 'COMPLETED', processResult);
    return processResult;
  }
}
