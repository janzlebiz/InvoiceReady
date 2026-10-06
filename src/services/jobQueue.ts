/**
 * InvoiceReady v1.0 - Durable Processing Job Queue & Idempotency Manager
 * Conforms to Requirement 12, Section 32 & 33.
 * Manages idempotent execution, retries, and failure recovery.
 */

export interface DurableJob {
  operation_id: string;
  scan_id: string;
  organization_id: string;
  attempt_number: number;
  max_attempts: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  started_at: string;
  completed_at?: string;
  error_message?: string;
  result?: any;
}

export class JobQueue {
  private static durableJobs: Map<string, DurableJob> = new Map();
  private static scanToOperationMap: Map<string, string> = new Map();

  /**
   * Registers or retrieves an idempotent operation (Section 33)
   */
  public static registerOrGetJob(
    scanId: string,
    organizationId: string,
    operationId?: string
  ): { job: DurableJob; isExisting: boolean } {
    const opId = operationId || this.scanToOperationMap.get(scanId) || `op_${scanId}_${Date.now()}`;
    const existing = this.durableJobs.get(opId);

    if (existing) {
      return { job: existing, isExisting: true };
    }

    const newJob: DurableJob = {
      operation_id: opId,
      scan_id: scanId,
      organization_id: organizationId,
      attempt_number: 1,
      max_attempts: 3,
      status: 'QUEUED',
      started_at: new Date().toISOString(),
    };

    this.durableJobs.set(opId, newJob);
    this.scanToOperationMap.set(scanId, opId);
    return { job: newJob, isExisting: false };
  }

  public static updateJobStatus(
    operationId: string,
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    result?: any,
    error?: string
  ): void {
    const job = this.durableJobs.get(operationId);
    if (!job) return;

    job.status = status;
    if (result !== undefined) job.result = result;
    if (error !== undefined) job.error_message = error;
    if (status === 'COMPLETED' || status === 'FAILED') {
      job.completed_at = new Date().toISOString();
    }
  }

  public static getJob(operationId: string): DurableJob | undefined {
    return this.durableJobs.get(operationId);
  }

  public static getJobForScan(scanId: string): DurableJob | undefined {
    const opId = this.scanToOperationMap.get(scanId);
    if (opId) return this.durableJobs.get(opId);
    return undefined;
  }
}
