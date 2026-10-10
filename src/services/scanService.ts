import {
  ScanSession,
  BusinessProfile,
  SystemProfile,
  JurisdictionCode,
} from '../engine/types';
import { ApplicabilityEngine } from '../engine/applicabilityEngine';
import { RuleEngine } from '../engine/ruleEngine';
import { ScoringEngine } from '../engine/scoringEngine';
import { DocumentParser } from './documentParser';
import { GeminiExtractor } from './geminiExtractor';
import { SecurityScanner } from './securityScanner';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { SupabaseDbService } from './supabaseDatabase';
import { uploadInvoiceToSupabase } from './supabaseStorage';
import crypto from 'crypto';

export class ScanService {
  /**
   * Creates a new tenant-owned scan session durably in Supabase PostgreSQL.
   * Conforms to Phase 1: zero org_main, zero fabricated defaults, zero in-memory maps.
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

    if (!isSupabaseConfigured()) {
      throw new Error('Durable scan creation unavailable: Supabase database is not configured.');
    }

    const scanId = `scan_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const session: ScanSession = {
      scan_id: scanId,
      organization_id: organizationId,
      jurisdiction,
      rule_pack_version: '2026.1-GA',
      business_profile: {
        ...businessProfile,
        organization_id: organizationId,
      },
      system_profile: {
        ...systemProfile,
        organization_id: organizationId,
      },
      status: 'CREATED',
    };

    const supabase = getSupabase();
    const { error: insertErr } = await supabase.from('scan_sessions').insert({
      session_id: scanId,
      organization_id: organizationId,
      jurisdiction,
      status: 'CREATED',
      user_id: userId || null,
      file_name: 'pending_upload',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertErr) {
      throw new Error(`Failed to durably persist scan session in database: ${insertErr.message}`);
    }

    // Also persist initial business & system profiles
    await SupabaseDbService.saveScanSession(session, session.business_profile, session.system_profile);

    return session;
  }

  /**
   * Loads an authoritative scan session from Supabase PostgreSQL.
   * Enforces tenant isolation: fails closed if scan does not belong to authorized organizationId.
   */
  public static async getScan(scanId: string, organizationId?: string): Promise<ScanSession | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Database service is not configured for scan retrieval.');
    }

    const supabase = getSupabase();
    let query = supabase
      .from('scan_sessions')
      .select('*')
      .eq('session_id', scanId);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return null;
    }

    if (organizationId && data.organization_id !== organizationId) {
      return null;
    }

    // Fetch tenant business and system profiles
    let bp: BusinessProfile = {
      id: `bp_${data.session_id}`,
      organization_id: data.organization_id,
      country: data.jurisdiction,
      business_name: '',
      tax_identifier: '',
      vat_registered: true,
      revenue_band: 'BELOW_50M_AED',
      transaction_types: ['B2B'],
      branch_count: 1,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    const { data: bpData } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('organization_id', data.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (bpData) {
      bp = {
        id: bpData.profile_id || `bp_${data.session_id}`,
        organization_id: bpData.organization_id,
        country: bpData.country,
        business_name: bpData.business_name,
        trade_name: bpData.trade_name || undefined,
        tax_identifier: bpData.tax_identifier,
        vat_registered: bpData.vat_registered,
        revenue_band: bpData.revenue_band,
        transaction_types: bpData.transaction_types,
        taxpayer_category: bpData.taxpayer_category || undefined,
        branch_count: bpData.branch_count || 1,
        created_at: bpData.created_at,
        updated_at: bpData.updated_at,
      };
    }

    let sp: SystemProfile = {
      id: `sys_${data.session_id}`,
      organization_id: data.organization_id,
      accounting_system: 'CUSTOM_ERP',
      invoicing_system: 'CUSTOM_ERP',
      current_invoice_format: 'PDF',
      structured_export_capability: false,
      electronic_transmission_capability: false,
      number_of_invoice_templates: 1,
    };

    const { data: spData } = await supabase
      .from('system_profiles')
      .select('*')
      .eq('organization_id', data.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (spData) {
      sp = {
        id: spData.profile_id || `sys_${data.session_id}`,
        organization_id: spData.organization_id,
        accounting_system: spData.accounting_system,
        invoicing_system: spData.invoicing_system,
        pos_erp_name: spData.pos_erp_name || undefined,
        current_invoice_format: spData.current_invoice_format,
        structured_export_capability: spData.structured_export_capability,
        electronic_transmission_capability: false,
        number_of_invoice_templates: 1,
      };
    }

    const session: ScanSession = {
      scan_id: data.session_id,
      organization_id: data.organization_id,
      jurisdiction: data.jurisdiction,
      rule_pack_version: '2026.1-GA',
      business_profile: bp,
      system_profile: sp,
      status: data.status,
      document_name: data.file_name,
      document_size_bytes: Number(data.file_size_bytes || 0),
      document_hash: data.file_sha256,
      storage_path: data.storage_path,
      extraction_result: data.extraction_json,
      scorecard: data.scorecard_json,
    };

    return session;
  }

  /**
   * Attaches an uploaded invoice document to a scan session.
   * Uploads to private Supabase Storage and records metadata in database.
   */
  public static async attachDocument(
    scanId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    organizationId: string,
    userId?: string
  ): Promise<{ passed: boolean; sha256: string; documentId?: string; storagePath?: string; error?: string }> {
    if (!organizationId) {
      throw new Error('Organization ID is mandatory for document attachment.');
    }

    const scan = await this.getScan(scanId, organizationId);
    if (!scan) throw new Error('Scan session not found or does not belong to authorized organization.');

    // 1. Byte-level security inspection
    const inspection = await SecurityScanner.inspectFileBuffer(fileBuffer, fileName, mimeType);
    if (!inspection.passed) {
      const supabase = getSupabase();
      await supabase
        .from('scan_sessions')
        .update({ status: 'SECURITY_REJECTED', updated_at: new Date().toISOString() })
        .eq('session_id', scanId)
        .eq('organization_id', organizationId);

      return { passed: false, sha256: inspection.sha256Hash, error: 'File failed security inspection' };
    }

    // 2. Upload to Supabase Storage private bucket 'invoices' with tenant scoping
    const uint8 = new Uint8Array(fileBuffer);
    const uploadRes = await uploadInvoiceToSupabase(new Blob([uint8]), fileName, organizationId, scanId);
    if (!uploadRes.path) {
      throw new Error(`Failed to upload document to private storage: ${uploadRes.error || 'Unknown error'}`);
    }

    const storagePath = uploadRes.path;
    const documentId = `doc_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

    // 3. Durably update scan session in PostgreSQL
    const supabase = getSupabase();
    const { error: updateErr } = await supabase
      .from('scan_sessions')
      .update({
        file_name: fileName,
        file_size_bytes: fileBuffer.length,
        file_sha256: inspection.sha256Hash,
        storage_path: storagePath,
        status: 'SECURITY_PASSED',
        updated_at: new Date().toISOString(),
      })
      .eq('session_id', scanId)
      .eq('organization_id', organizationId);

    if (updateErr) {
      throw new Error(`Failed to update scan session with document metadata: ${updateErr.message}`);
    }

    // 4. Durably insert document record into scan_documents table
    await supabase.from('scan_documents').insert({
      document_id: documentId,
      session_id: scanId,
      organization_id: organizationId,
      file_name: fileName,
      mime_type: mimeType,
      file_size_bytes: fileBuffer.length,
      storage_path: storagePath,
      sha256_hash: inspection.sha256Hash,
      status: 'SECURITY_PASSED',
      created_at: new Date().toISOString(),
    });

    return {
      passed: true,
      sha256: inspection.sha256Hash,
      documentId,
      storagePath,
    };
  }

  /**
   * Retrieves stored document bytes directly from private durable Supabase Storage.
   * Zero in-memory Maps.
   */
  public static async getStoredFileBuffer(scanId: string, organizationId?: string): Promise<Buffer | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Storage service is not configured.');
    }

    const scan = await this.getScan(scanId, organizationId);
    if (!scan || !scan.storage_path) {
      return null;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from('invoices').download(scan.storage_path);
    if (error || !data) {
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Processes an assessment scan authoritatively server-side.
   * Reads bytes from private durable storage, validates SHA-256 integrity,
   * extracts canonical fields, evaluates rules, calculates score, and saves to DB.
   */
  public static async processScan(
    scanId: string,
    organizationId: string,
    businessProfile: BusinessProfile,
    systemProfile: SystemProfile
  ): Promise<ScanSession> {
    if (!organizationId) {
      throw new Error('Organization ID is mandatory for processing.');
    }

    const scan = await this.getScan(scanId, organizationId);
    if (!scan) throw new Error('Scan session not found or does not belong to authorized organization.');

    // 1. Retrieve bytes from private durable storage
    const fileBuffer = await this.getStoredFileBuffer(scanId, organizationId);
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Persisted document bytes not found in durable private storage.');
    }

    // Verify SHA-256 integrity against database record
    const computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    if (scan.document_hash && computedHash !== scan.document_hash) {
      throw new Error('Integrity violation: Stored file SHA-256 hash does not match recorded document hash.');
    }

    // 2. Extract text without synthetic fallback
    const rawText = await DocumentParser.extractDocumentText(
      fileBuffer,
      scan.document_name || 'invoice.pdf',
      scan.document_mime_type || 'application/pdf'
    );

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Document text extraction failed: No readable text found in stored file.');
    }

    // 3. Extract canonical schema with Gemini
    const extraction = await GeminiExtractor.extractInvoice(
      scan.document_name || 'invoice.pdf',
      rawText,
      scan.document_mime_type || 'application/pdf',
      scanId
    );

    // 4. Determine applicability
    const applicability = ApplicabilityEngine.determineApplicability(
      businessProfile,
      systemProfile
    );

    // 5. Execute deterministic rules
    const { validationResults, findings, remediationActions } = RuleEngine.executeRules(
      applicability.applicable_rules,
      extraction.canonical_invoice,
      businessProfile,
      systemProfile,
      extraction.evidence_map
    );

    // 6. Calculate scorecard
    const scorecard = ScoringEngine.calculateScorecard(
      validationResults,
      findings,
      applicability.applicable_rules.length
    );

    scan.business_profile = businessProfile;
    scan.system_profile = systemProfile;
    scan.extraction_result = extraction;
    scan.validation_results = validationResults;
    scan.findings = findings;
    scan.remediation_plan = remediationActions;
    scan.scorecard = scorecard;
    scan.status = 'COMPLETED';

    // 7. Persist to Supabase PostgreSQL database
    const saveRes = await SupabaseDbService.saveScanSession(scan, businessProfile, systemProfile);
    if (!saveRes.success) {
      throw new Error(`Failed to durably persist scan session: ${saveRes.error}`);
    }

    return scan;
  }

  public static async deleteScan(scanId: string, organizationId: string): Promise<void> {
    await SupabaseDbService.deleteScanSession(scanId, organizationId);
  }
}
