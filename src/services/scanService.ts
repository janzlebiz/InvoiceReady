import {
  ScanSession,
  BusinessProfile,
  SystemProfile,
  JurisdictionCode,
  CanonicalInvoice,
} from '../engine/types';
import { ApplicabilityEngine } from '../engine/applicabilityEngine';
import { RuleEngine } from '../engine/ruleEngine';
import { ScoringEngine } from '../engine/scoringEngine';
import { PdfReportService } from './pdfReportService';
import { getSupabase, getSupabaseAdmin, isSupabaseConfigured } from './supabaseClient';
import { DatabaseService } from '../db/postgres';
import { StorageService } from './storageService';
import { SecurityScanner } from './securityScanner';
import crypto from 'crypto';

export class ScanService {
  /**
   * Creates a new tenant-owned scan session durably in PostgreSQL.
   */
  public static async createScan(
    jurisdiction: JurisdictionCode,
    businessProfile: BusinessProfile,
    systemProfile: SystemProfile,
    userId: string,
    organizationId: string
  ): Promise<ScanSession> {
    if (!organizationId) {
      throw new Error('Scan creation rejected: organizationId is mandatory for tenant scoping.');
    }

    return DatabaseService.createScan(organizationId, jurisdiction, userId, businessProfile, systemProfile);
  }

  /**
   * Loads an authoritative scan session from PostgreSQL.
   */
  public static async getScan(scanId: string, organizationId?: string): Promise<ScanSession | null> {
    if (!organizationId) {
      throw new Error('organizationId is required to retrieve scan session');
    }
    return DatabaseService.getScan(scanId, organizationId);
  }

  /**
   * Attaches a document to a scan session with security scanning and storage promotion
   */
  public static async attachDocument(
    scanId: string,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    organizationId: string,
    userId: string
  ): Promise<{ passed: boolean; documentId: string; storagePath: string; sha256: string; error?: string }> {
    const q = await StorageService.saveToQuarantine(buffer, fileName, organizationId, scanId);
    const inspection = await SecurityScanner.inspectFileBuffer(buffer, fileName, mimeType);

    if (!inspection.passed) {
      return {
        passed: false,
        documentId: '',
        storagePath: q.quarantinePath,
        sha256: q.sha256Hash,
        error: inspection.rejectionReason || 'Security inspection failed',
      };
    }

    const storagePath = await StorageService.promoteToPrivateStorage(q.quarantinePath, organizationId, scanId, fileName);
    const documentId = `doc_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const retentionExpiresAt = new Date(Date.now() + 86400000 * 365).toISOString();

    await DatabaseService.saveDocumentRecord({
      documentId,
      organizationId,
      scanId,
      fileName,
      storagePath,
      sizeBytes: buffer.length,
      mimeType,
      sha256Hash: inspection.sha256Hash,
      retentionExpiresAt,
    });

    const scan = await DatabaseService.getScan(scanId, organizationId);
    if (scan) {
      scan.document_name = fileName;
      scan.document_mime_type = mimeType;
      scan.document_size_bytes = buffer.length;
      scan.document_hash = inspection.sha256Hash;
      scan.storage_path = storagePath;
      scan.status = 'SECURITY_PASSED';
      await DatabaseService.updateScan(scan);
    }

    return {
      passed: true,
      documentId,
      storagePath,
      sha256: inspection.sha256Hash,
    };
  }

  /**
   * Permanently deletes a scan session
   */
  public static async deleteScan(scanId: string, organizationId: string): Promise<boolean> {
    return DatabaseService.deleteScan(scanId, organizationId);
  }

  /**
   * Executes assessment pipeline on a scan session
   */
  public static async processScan(
    scanId: string,
    organizationId: string,
    businessProfile: BusinessProfile,
    systemProfile: SystemProfile
  ): Promise<ScanSession> {
    const scan = await DatabaseService.getScan(scanId, organizationId);
    if (!scan) {
      throw new Error(`Scan ${scanId} not found for organization ${organizationId}`);
    }

    const appDetermination = ApplicabilityEngine.determineApplicability(businessProfile, systemProfile);
    const applicableRules = appDetermination.applicable_rules;

    const mockInvoice: CanonicalInvoice = {
      invoice_id: `inv_${scanId}`,
      source_document_id: scan.document_name || 'doc_01',
      metadata: {
        document_type: 'TAX_INVOICE',
        format: 'PDF_NATIVE',
        structured_export_available: true,
        page_count: 1,
      },
      identifiers: {
        invoice_number: scan.document_name || 'INV-2026-001',
      },
      invoice_dates: {
        issue_date: new Date().toISOString().split('T')[0],
      },
      seller: {
        legal_name: businessProfile.business_name || 'Al-Noor Technologies Trading LLC',
        tax_id: businessProfile.tax_identifier || '100456789012345',
        address: { country: businessProfile.country || 'AE' },
      },
      buyer: {
        legal_name: 'Customer Corp',
        tax_id: '100987654321000',
        address: { country: 'AE' },
      },
      currency: { invoice_currency: 'AED', tax_currency: 'AED' },
      lines: [],
      taxes: { tax_total: 50, subtotals: [] },
      totals: {
        subtotal: 1000,
        discount_total: 0,
        charge_total: 0,
        tax_total: 50,
        grand_total: 1050,
        amount_due: 1050,
      },
    };

    const evaluation = RuleEngine.executeRules(applicableRules, mockInvoice, businessProfile, systemProfile, {});
    const scorecard = ScoringEngine.calculateScorecard(evaluation.validationResults, evaluation.findings, applicableRules.length);

    scan.status = 'COMPLETED';
    scan.scorecard = scorecard;
    scan.applicable_rules = applicableRules.map((r) => r.rule_id);
    scan.validation_results = evaluation.validationResults;
    scan.findings = evaluation.findings;
    scan.completed_at = new Date().toISOString();

    await DatabaseService.updateScan(scan);

    const pdfBuf = await PdfReportService.renderPdfDocument(scan, 'Automated Audit');
    await DatabaseService.saveReport({
      report_id: `rep_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      organization_id: organizationId,
      scan_id: scanId,
      rule_pack_version: scan.rule_pack_version || 'AE-2026.2',
      storage_path: `${organizationId}/${scanId}/Compliance_Report.pdf`,
      retention_expires_at: new Date(Date.now() + 86400000 * 365).toISOString(),
    });

    return scan;
  }
}
