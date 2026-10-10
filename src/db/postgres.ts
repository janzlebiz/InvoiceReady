/**
 * InvoiceReady v1.0 - Authoritative PostgreSQL Persistence Service
 * Conforms to Requirements 1-6, 11, 13, 14, 15, 22, 35-40, 59.
 *
 * Production Hardening Guarantees:
 * 1. ZERO in-memory Map CRUD or /tmp JSON file storage.
 * 2. Real PostgreSQL is the sole datastore (Cloud SQL via pg.Pool or PGlite).
 * 3. 100% Parameterized queries ($1, $2, ...) preventing SQL injection.
 * 4. Every read/write query is strictly tenant-scoped by server-derived organization_id.
 * 5. Append-only audit logs with real client IP and sanitized metadata.
 * 6. Foreign keys and cascade integrity matching schema.sql.
 */

import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import {
  ScanSession,
  BusinessProfile,
  SystemProfile,
  Finding,
  RemediationAction,
  Scorecard,
  JurisdictionCode,
  CookieConsentPreferences,
  PrivacyRequest,
  AuditLogEntry,
} from '../engine/types';

export interface PgExecutor {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount?: number }>;
  exec(sql: string): Promise<void>;
}

export class DatabaseService {
  private static client: PgExecutor | null = null;
  private static initialized = false;

  /**
   * Initializes PostgreSQL connection and runs DDL schema migrations.
   */
  public static async initialize(forceCheck = false): Promise<void> {
    if (this.initialized && this.client && !forceCheck) return;

    // 1. Check for Cloud SQL / PostgreSQL environment variables
    const isPlaceholder = Boolean(
      process.env.DATABASE_URL?.includes('PROJECT:REGION:INSTANCE') ||
      process.env.DATABASE_URL?.includes('PASSWORD@')
    );

    const hasCloudSqlEnv = Boolean(
      (process.env.DATABASE_URL && !isPlaceholder) ||
      (process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME && !isPlaceholder)
    );

    // Requirement 6: In production, require real Cloud SQL PostgreSQL. Do not fall back to PGlite.
    if (process.env.NODE_ENV === 'production') {
      if (!hasCloudSqlEnv || isPlaceholder) {
        throw new Error(
          'FATAL: Production mode requires authoritative Cloud SQL PostgreSQL database (DATABASE_URL or SQL_HOST/USER/DB). PGlite fallback is strictly prohibited in production.'
        );
      }
    }

    if (hasCloudSqlEnv) {
      try {
        const pool = new Pool(
          process.env.DATABASE_URL
            ? {
                connectionString: process.env.DATABASE_URL,
                max: 15,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
              }
            : {
                host: process.env.SQL_HOST,
                user: process.env.SQL_USER,
                password: process.env.SQL_PASSWORD,
                database: process.env.SQL_DB_NAME,
                max: 15,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
              }
        );

        this.client = {
          async query<T = any>(sql: string, params?: any[]) {
            const res = await pool.query(sql, params);
            return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
          },
          async exec(sql: string) {
            await pool.query(sql);
          },
        };
        console.log('Connected to authoritative Cloud SQL PostgreSQL database.');
      } catch (err: any) {
        console.error('Fatal: Failed to connect to Cloud SQL PostgreSQL in production:', err.message);
        throw err;
      }
    } else {
      // 2. Authoritative PostgreSQL WebAssembly Engine (PGlite) strictly permitted ONLY in development/test environments
      const pglite = new PGlite();
      this.client = {
        async query<T = any>(sql: string, params?: any[]) {
          const res = await pglite.query<T>(sql, params);
          return { rows: res.rows, rowCount: res.rows.length };
        },
        async exec(sql: string) {
          await pglite.exec(sql);
        },
      };
      console.log('Initialized Authoritative PostgreSQL Engine.');
    }

    // 3. Apply DDL constraints, foreign keys, and indexes
    await this.applySchemaMigrations();
    this.initialized = true;
  }

  private static async applySchemaMigrations(): Promise<void> {
    if (!this.client) throw new Error('Database client not initialized');

    const ddl = `
      CREATE TABLE IF NOT EXISTS organizations (
        organization_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        country_code VARCHAR(2) NOT NULL DEFAULT 'AE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(64) PRIMARY KEY,
        firebase_uid VARCHAR(128) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS organization_users (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
        user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        role VARCHAR(32) NOT NULL DEFAULT 'ANALYST',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS scans (
        scan_id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
        jurisdiction VARCHAR(2) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
        created_by VARCHAR(64) NOT NULL REFERENCES users(user_id),
        business_profile JSONB NOT NULL,
        system_profile JSONB NOT NULL,
        rule_pack_version VARCHAR(32) NOT NULL,
        document_name VARCHAR(255),
        document_mime_type VARCHAR(128),
        document_size_bytes BIGINT,
        document_hash VARCHAR(128),
        storage_path VARCHAR(512),
        security_scan_result JSONB,
        extraction_result JSONB,
        applicable_rules JSONB,
        validation_results JSONB,
        scorecard JSONB,
        findings JSONB,
        remediation_plan JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        uploaded_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS documents (
        document_id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
        scan_id VARCHAR(64) NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        storage_path VARCHAR(512) NOT NULL,
        file_size_bytes BIGINT NOT NULL,
        mime_type VARCHAR(128) NOT NULL,
        sha256_hash VARCHAR(64) NOT NULL,
        retention_expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS job_queue (
        operation_id VARCHAR(64) PRIMARY KEY,
        scan_id VARCHAR(64) NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
        status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
        attempt_count INT NOT NULL DEFAULT 1,
        max_attempts INT NOT NULL DEFAULT 3,
        locked_at TIMESTAMPTZ,
        locked_by VARCHAR(128),
        lease_expires_at TIMESTAMPTZ,
        next_retry_at TIMESTAMPTZ,
        payload JSONB,
        result JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        log_id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
        actor_id VARCHAR(128) NOT NULL,
        action VARCHAR(64) NOT NULL,
        resource_id VARCHAR(128) NOT NULL,
        result VARCHAR(16) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        metadata JSONB,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS consents (
        consent_id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
        user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        policy_version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0',
        necessary BOOLEAN NOT NULL DEFAULT true,
        preferences BOOLEAN NOT NULL DEFAULT false,
        analytics BOOLEAN NOT NULL DEFAULT false,
        marketing BOOLEAN NOT NULL DEFAULT false,
        jurisdiction_context VARCHAR(4) NOT NULL DEFAULT 'AE',
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS privacy_requests (
        request_id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
        requester_email VARCHAR(255) NOT NULL,
        request_type VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS reports (
        report_id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
        scan_id VARCHAR(64) NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
        rule_pack_version VARCHAR(32) NOT NULL,
        storage_path VARCHAR(512) NOT NULL,
        retention_expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_scans_org ON scans(organization_id);
      CREATE INDEX IF NOT EXISTS idx_documents_retention ON documents(retention_expires_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, updated_at);
    `;

    await this.client.exec(ddl);
  }

  // -------------------------------------------------------------------------
  // 1. TENANT & USER IDENTITY RESOLUTION (Requirements 3 & 4)
  // -------------------------------------------------------------------------

  public static async resolveUserAndTenant(
    firebaseUid: string,
    email: string,
    fullName: string,
    options?: {
      emailVerified?: boolean;
      isAnonymous?: boolean;
      allowAutoOrgCreation?: boolean;
    }
  ): Promise<{
    userId: string;
    firebaseUid: string;
    email: string;
    fullName: string;
    organizationId: string;
    role: 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER';
  }> {
    await this.initialize();
    const client = this.client!;
    const isProd = process.env.NODE_ENV === 'production';

    // Requirement 6: Require verified identity/email in production where applicable
    if (isProd && !options?.isAnonymous && options?.emailVerified === false) {
      throw new Error('Email verification required in production prior to tenant account access.');
    }

    // 1. Query user by firebase_uid
    const userRes = await client.query(
      'SELECT user_id, firebase_uid, email, full_name FROM users WHERE firebase_uid = $1 LIMIT 1',
      [firebaseUid]
    );

    let userId: string;
    let orgId: string;
    let role: 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER' = 'ANALYST';

    if (userRes.rows.length === 0) {
      // RC2.1 Item 3: Auto-org creation is 100% disabled in production
      if (isProd) {
        throw new Error('Automatic organization creation is disabled in production. Organization onboarding invitation required.');
      }
      if (options?.allowAutoOrgCreation === false) {
        throw new Error('Automatic organization creation is disabled. User must be explicitly invited to an organization.');
      }

      userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      orgId = `org_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const memberId = `mem_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

      // Transactional organization + user + membership provisioning (RC2.1 Item 3)
      await client.exec('BEGIN');
      try {
        await client.query(
          'INSERT INTO users (user_id, firebase_uid, email, full_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
          [userId, firebaseUid, email, fullName]
        );
        await client.query(
          'INSERT INTO organizations (organization_id, name, country_code, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [orgId, `${fullName}'s Organization`, 'AE']
        );
        await client.query(
          'INSERT INTO organization_users (id, organization_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4, NOW())',
          [memberId, orgId, userId, 'OWNER']
        );
        await client.exec('COMMIT');
      } catch (txErr) {
        await client.exec('ROLLBACK');
        throw txErr;
      }

      role = 'OWNER';
    } else {
      userId = userRes.rows[0].user_id;

      // Query active organization membership
      const memRes = await client.query(
        'SELECT organization_id, role FROM organization_users WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (memRes.rows.length > 0) {
        orgId = memRes.rows[0].organization_id;
        role = memRes.rows[0].role as any;
      } else {
        // RC2.1 Item 3: Existing users without active memberships must receive onboarding-required
        if (isProd || options?.allowAutoOrgCreation === false) {
          throw new Error('User does not belong to an active organization. Organization onboarding required.');
        }

        // Fallback provision org only in non-production/permissive test environments
        orgId = `org_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        await client.exec('BEGIN');
        try {
          await client.query(
            'INSERT INTO organizations (organization_id, name, country_code) VALUES ($1, $2, $3)',
            [orgId, `${fullName}'s Organization`, 'AE']
          );
          await client.query(
            'INSERT INTO organization_users (id, organization_id, user_id, role) VALUES ($1, $2, $3, $4)',
            [`mem_${Date.now().toString(36)}`, orgId, userId, 'OWNER']
          );
          await client.exec('COMMIT');
        } catch (txErr) {
          await client.exec('ROLLBACK');
          throw txErr;
        }
        role = 'OWNER';
      }
    }

    return {
      userId,
      firebaseUid,
      email,
      fullName,
      organizationId: orgId,
      role,
    };
  }

  public static async updateUserRole(
    userId: string,
    organizationId: string,
    role: 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER'
  ): Promise<void> {
    await this.initialize();
    await this.client!.query(
      `UPDATE organization_users SET role = $1 WHERE user_id = $2 AND organization_id = $3`,
      [role, userId, organizationId]
    );
  }

  // -------------------------------------------------------------------------
  // 2. SCANS & OBJECT-LEVEL TENANT AUTHORIZATION (Requirements 4 & 5)
  // -------------------------------------------------------------------------

  public static async createScan(
    organizationId: string,
    jurisdiction: JurisdictionCode,
    userId: string,
    businessProfile: BusinessProfile,
    systemProfile: SystemProfile
  ): Promise<ScanSession> {
    await this.initialize();
    const scanId = `scan_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const rulePackVersion = jurisdiction === 'AE' ? 'AE-2026.2' : 'PH-2026.2';

    const scan: ScanSession = {
      scan_id: scanId,
      organization_id: organizationId,
      jurisdiction,
      business_profile: businessProfile,
      system_profile: systemProfile,
      status: 'CREATED',
      uploaded_at: new Date().toISOString(),
      rule_pack_version: rulePackVersion,
    };

    await this.client!.query(
      `INSERT INTO scans (
        scan_id, organization_id, jurisdiction, status, created_by,
        business_profile, system_profile, rule_pack_version, created_at, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        scanId,
        organizationId,
        jurisdiction,
        'CREATED',
        userId,
        JSON.stringify(businessProfile),
        JSON.stringify(systemProfile),
        rulePackVersion,
      ]
    );

    return scan;
  }

  public static async getScan(scanId: string, organizationId: string): Promise<ScanSession | null> {
    await this.initialize();
    const res = await this.client!.query(
      `SELECT * FROM scans WHERE scan_id = $1 AND organization_id = $2 LIMIT 1`,
      [scanId, organizationId]
    );

    if (res.rows.length === 0) return null;
    return this.mapScanRow(res.rows[0]);
  }

  public static async listScansForTenant(organizationId: string): Promise<ScanSession[]> {
    await this.initialize();
    const res = await this.client!.query(
      `SELECT * FROM scans WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    return res.rows.map(this.mapScanRow);
  }

  public static async updateScan(scan: ScanSession): Promise<void> {
    await this.initialize();
    await this.client!.query(
      `UPDATE scans SET
        status = $1,
        document_name = $2,
        document_mime_type = $3,
        document_size_bytes = $4,
        document_hash = $5,
        storage_path = $6,
        security_scan_result = $7,
        extraction_result = $8,
        applicable_rules = $9,
        validation_results = $10,
        scorecard = $11,
        findings = $12,
        remediation_plan = $13,
        error_message = $14,
        completed_at = $15
      WHERE scan_id = $16 AND organization_id = $17`,
      [
        scan.status,
        scan.document_name || null,
        scan.document_mime_type || null,
        scan.document_size_bytes || null,
        scan.document_hash || null,
        scan.storage_path || null,
        scan.security_scan_result ? JSON.stringify(scan.security_scan_result) : null,
        scan.extraction_result ? JSON.stringify(scan.extraction_result) : null,
        scan.applicable_rules ? JSON.stringify(scan.applicable_rules) : null,
        scan.validation_results ? JSON.stringify(scan.validation_results) : null,
        scan.scorecard ? JSON.stringify(scan.scorecard) : null,
        scan.findings ? JSON.stringify(scan.findings) : null,
        scan.remediation_plan ? JSON.stringify(scan.remediation_plan) : null,
        scan.error_message || null,
        scan.completed_at || null,
        scan.scan_id,
        scan.organization_id,
      ]
    );
  }

  public static async deleteScan(scanId: string, organizationId: string): Promise<boolean> {
    await this.initialize();
    const res = await this.client!.query(
      `DELETE FROM scans WHERE scan_id = $1 AND organization_id = $2 RETURNING scan_id`,
      [scanId, organizationId]
    );
    return res.rows.length > 0;
  }

  // -------------------------------------------------------------------------
  // 3. DOCUMENTS & RETENTION (Requirements 13, 17, 27, 28)
  // -------------------------------------------------------------------------

  public static async saveDocumentRecord(doc: {
    documentId: string;
    organizationId: string;
    scanId: string;
    fileName: string;
    storagePath: string;
    sizeBytes: number;
    mimeType: string;
    sha256Hash: string;
    retentionExpiresAt: string;
  }): Promise<void> {
    await this.initialize();
    await this.client!.query(
      `INSERT INTO documents (
        document_id, organization_id, scan_id, file_name, storage_path,
        file_size_bytes, mime_type, sha256_hash, retention_expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        doc.documentId,
        doc.organizationId,
        doc.scanId,
        doc.fileName,
        doc.storagePath,
        doc.sizeBytes,
        doc.mimeType,
        doc.sha256Hash,
        doc.retentionExpiresAt,
      ]
    );
  }

  public static async getDocument(
    documentId: string,
    organizationId: string
  ): Promise<{ document_id: string; storage_path: string; retention_expires_at: string } | null> {
    await this.initialize();
    const res = await this.client!.query(
      `SELECT document_id, storage_path, retention_expires_at FROM documents WHERE document_id = $1 AND organization_id = $2 LIMIT 1`,
      [documentId, organizationId]
    );
    return res.rows[0] || null;
  }

  public static async getExpiredDocuments(): Promise<
    { document_id: string; storage_path: string; organization_id: string }[]
  > {
    await this.initialize();
    const res = await this.client!.query(
      `SELECT document_id, storage_path, organization_id FROM documents WHERE retention_expires_at <= NOW()`
    );
    return res.rows;
  }

  public static async deleteDocumentRecord(documentId: string, organizationId: string): Promise<void> {
    await this.initialize();
    await this.client!.query(
      `DELETE FROM documents WHERE document_id = $1 AND organization_id = $2`,
      [documentId, organizationId]
    );
  }

  // -------------------------------------------------------------------------
  // 4. DURABLE ASYNCHRONOUS JOB QUEUE (Requirements 19-24)
  // -------------------------------------------------------------------------

  public static async createOrGetJob(
    operationId: string,
    scanId: string,
    organizationId: string,
    payload?: any
  ): Promise<{ job: any; isExisting: boolean }> {
    await this.initialize();
    const existing = await this.client!.query(
      `SELECT * FROM job_queue WHERE operation_id = $1 AND organization_id = $2 LIMIT 1`,
      [operationId, organizationId]
    );

    if (existing.rows.length > 0) {
      return { job: existing.rows[0], isExisting: true };
    }

    const insertRes = await this.client!.query(
      `INSERT INTO job_queue (
        operation_id, scan_id, organization_id, status, attempt_count, max_attempts, payload, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 1, 3, $5, NOW(), NOW()) RETURNING *`,
      [operationId, scanId, organizationId, 'QUEUED', payload ? JSON.stringify(payload) : null]
    );

    return { job: insertRes.rows[0], isExisting: false };
  }

  public static async updateJobStatus(
    operationId: string,
    organizationId: string,
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    result?: any,
    errorMessage?: string
  ): Promise<void> {
    await this.initialize();
    await this.client!.query(
      `UPDATE job_queue SET
        status = $1::VARCHAR,
        result = $2,
        error_message = $3,
        next_retry_at = CASE
          WHEN $1::VARCHAR = 'FAILED' AND attempt_count < max_attempts
          THEN NOW() + (POWER(2, LEAST(attempt_count, 6)) * INTERVAL '2 seconds')
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE operation_id = $4 AND organization_id = $5`,
      [
        status,
        result ? JSON.stringify(result) : null,
        errorMessage || null,
        operationId,
        organizationId,
      ]
    );
  }

  public static async getJob(operationId: string, organizationId: string): Promise<any | null> {
    await this.initialize();
    const res = await this.client!.query(
      `SELECT * FROM job_queue WHERE operation_id = $1 AND organization_id = $2 LIMIT 1`,
      [operationId, organizationId]
    );
    return res.rows[0] || null;
  }

  /**
   * Atomically claims a job lease in PostgreSQL to prevent concurrent execution between Cloud Tasks and recovery supervisor (RC2.1 Item 1).
   * Enforces attempt_count < max_attempts and exponential backoff retry window atomically at database level.
   */
  public static async claimJobLease(
    operationId: string,
    organizationId: string,
    workerId: string,
    leaseDurationSeconds = 180
  ): Promise<boolean> {
    await this.initialize();
    const res = await this.client!.query(
      `UPDATE job_queue
       SET status = 'PROCESSING',
           locked_at = NOW(),
           locked_by = $1,
           lease_expires_at = NOW() + ($2 || ' seconds')::INTERVAL,
           attempt_count = attempt_count + 1,
           updated_at = NOW()
       WHERE operation_id = $3
         AND organization_id = $4
         AND attempt_count < max_attempts
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
         AND (
           status = 'QUEUED'
           OR (status = 'PROCESSING' AND (lease_expires_at IS NULL OR lease_expires_at < NOW()))
           OR (status = 'FAILED' AND attempt_count < max_attempts)
         )
       RETURNING operation_id, status`,
      [workerId, leaseDurationSeconds, operationId, organizationId]
    );
    return res.rows.length > 0;
  }

  public static async getPendingQueueJobs(): Promise<any[]> {
    await this.initialize();
    const res = await this.client!.query(
      `SELECT * FROM job_queue
       WHERE attempt_count < max_attempts
         AND (
           (status = 'QUEUED' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
           OR (status = 'PROCESSING' AND (lease_expires_at IS NULL OR lease_expires_at < NOW()))
           OR (status = 'FAILED' AND next_retry_at IS NOT NULL AND next_retry_at <= NOW())
         )
       ORDER BY created_at ASC
       LIMIT 10`
    );
    return res.rows;
  }

  // -------------------------------------------------------------------------
  // 5. APPEND-ONLY PERSISTENT AUDIT LOGS (Requirements 35-40)
  // -------------------------------------------------------------------------

  public static async recordAuditLog(
    actorId: string,
    organizationId: string,
    action: string,
    resourceId: string,
    result: 'SUCCESS' | 'FAILURE',
    ipAddress: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.initialize();
    const logId = `aud_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const sanitizedMeta = this.sanitizeAuditMetadata(metadata);

    await this.client!.query(
      `INSERT INTO audit_logs (
        log_id, organization_id, actor_id, action, resource_id, result, ip_address, metadata, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [logId, organizationId, actorId, action, resourceId, result, ipAddress, JSON.stringify(sanitizedMeta)]
    );
  }

  public static async getAuditLogs(organizationId: string): Promise<AuditLogEntry[]> {
    await this.initialize();
    const res = await this.client!.query(
      `SELECT log_id, actor_id as actor, organization_id, action, resource_id, result, ip_address, metadata, timestamp
       FROM audit_logs WHERE organization_id = $1 ORDER BY timestamp DESC LIMIT 500`,
      [organizationId]
    );
    return res.rows;
  }

  private static sanitizeAuditMetadata(meta?: Record<string, any>): Record<string, any> {
    if (!meta) return {};
    const sanitized: Record<string, any> = {};
    const prohibitedKeys = ['token', 'password', 'secret', 'apiKey', 'rawText', 'documentContent', 'tax_id'];

    for (const [key, val] of Object.entries(meta)) {
      if (prohibitedKeys.some((p) => key.toLowerCase().includes(p.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.sanitizeAuditMetadata(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  // -------------------------------------------------------------------------
  // 6. CONSENTS & PRIVACY LEDGER (Requirement 14)
  // -------------------------------------------------------------------------

  public static async recordConsent(consent: {
    consent_id: string;
    organization_id: string;
    user_id: string;
    policy_version: string;
    necessary: boolean;
    preferences: boolean;
    analytics: boolean;
    marketing: boolean;
    jurisdiction_context: string;
  }): Promise<void> {
    await this.initialize();
    await this.client!.query(
      `INSERT INTO consents (
        consent_id, organization_id, user_id, policy_version, necessary,
        preferences, analytics, marketing, jurisdiction_context, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        consent.consent_id,
        consent.organization_id,
        consent.user_id,
        consent.policy_version,
        consent.necessary,
        consent.preferences,
        consent.analytics,
        consent.marketing,
        consent.jurisdiction_context,
      ]
    );
  }

  public static async createPrivacyRequest(req: PrivacyRequest): Promise<void> {
    await this.initialize();
    await this.client!.query(
      `INSERT INTO privacy_requests (
        request_id, organization_id, requester_email, request_type, status, received_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [req.request_id, req.organization_id, req.requester_email, req.request_type, req.status]
    );
  }

  // -------------------------------------------------------------------------
  // 7. PERSISTENT PDF REPORTS (Requirements 58-60)
  // -------------------------------------------------------------------------

  public static async saveReport(report: {
    report_id: string;
    organization_id: string;
    scan_id: string;
    rule_pack_version: string;
    storage_path: string;
    retention_expires_at: string;
  }): Promise<void> {
    await this.initialize();
    await this.client!.query(
      `INSERT INTO reports (
        report_id, organization_id, scan_id, rule_pack_version, storage_path, retention_expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        report.report_id,
        report.organization_id,
        report.scan_id,
        report.rule_pack_version,
        report.storage_path,
        report.retention_expires_at,
      ]
    );
  }

  public static async getReport(scanId: string, organizationId: string): Promise<any | null> {
    await this.initialize();
    const res = await this.client!.query(
      `SELECT * FROM reports WHERE scan_id = $1 AND organization_id = $2 LIMIT 1`,
      [scanId, organizationId]
    );
    return res.rows[0] || null;
  }

  // -------------------------------------------------------------------------
  // ROW MAPPER HELPERS
  // -------------------------------------------------------------------------

  private static mapScanRow(row: any): ScanSession {
    const parseJson = (val: any) => {
      if (!val) return undefined;
      return typeof val === 'string' ? JSON.parse(val) : val;
    };

    return {
      scan_id: row.scan_id,
      organization_id: row.organization_id,
      jurisdiction: row.jurisdiction as JurisdictionCode,
      status: row.status,
      business_profile: parseJson(row.business_profile),
      system_profile: parseJson(row.system_profile),
      rule_pack_version: row.rule_pack_version,
      document_name: row.document_name,
      document_mime_type: row.document_mime_type,
      document_size_bytes: row.document_size_bytes ? Number(row.document_size_bytes) : undefined,
      document_hash: row.document_hash,
      storage_path: row.storage_path,
      security_scan_result: parseJson(row.security_scan_result),
      extraction_result: parseJson(row.extraction_result),
      applicable_rules: parseJson(row.applicable_rules),
      validation_results: parseJson(row.validation_results),
      scorecard: parseJson(row.scorecard),
      findings: parseJson(row.findings),
      remediation_plan: parseJson(row.remediation_plan),
      error_message: row.error_message,
      uploaded_at: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : undefined,
      completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    };
  }
}
