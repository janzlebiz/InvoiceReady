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

// In-memory cache for fast lookup and serverless execution
const activeScans = new Map<string, ScanSession>();
const scanFiles = new Map<string, { buffer: Buffer; filename: string; mimeType: string }>();

function createDefaultBusinessProfile(jurisdiction: JurisdictionCode): BusinessProfile {
  return {
    id: `bp_${Date.now().toString(36)}`,
    organization_id: 'org_main',
    country: jurisdiction,
    business_name: 'Assessed Organization LLC',
    tax_identifier: jurisdiction === 'AE' ? '100456789012345' : '123-456-789-00000',
    vat_registered: true,
    revenue_band: jurisdiction === 'AE' ? 'BELOW_50M_AED' : 'ABOVE_100M_PHP',
    transaction_types: ['B2B'],
    branch_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function createDefaultSystemProfile(): SystemProfile {
  return {
    id: `sys_${Date.now().toString(36)}`,
    organization_id: 'org_main',
    accounting_system: 'CUSTOM_ERP',
    invoicing_system: 'CUSTOM_ERP',
    current_invoice_format: 'PDF',
    structured_export_capability: false,
    electronic_transmission_capability: false,
    number_of_invoice_templates: 1,
  };
}

export class ScanService {
  public static async createScan(
    jurisdiction: JurisdictionCode,
    businessProfile?: BusinessProfile,
    systemProfile?: SystemProfile,
    userId?: string
  ): Promise<ScanSession> {
    const scanId = `scan_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const session: ScanSession = {
      scan_id: scanId,
      organization_id: 'org_main',
      jurisdiction,
      rule_pack_version: '2026.1-GA',
      business_profile: businessProfile || createDefaultBusinessProfile(jurisdiction),
      system_profile: systemProfile || createDefaultSystemProfile(),
      status: 'CREATED',
    };

    activeScans.set(scanId, session);

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabase();
        await supabase.from('scan_sessions').insert({
          session_id: scanId,
          jurisdiction,
          status: 'CREATED',
          user_id: userId || null,
          file_name: 'pending_upload',
        });
      } catch (err) {
        console.warn('Supabase scan insert notice:', err);
      }
    }

    return session;
  }

  public static async getScan(scanId: string): Promise<ScanSession | null> {
    const cached = activeScans.get(scanId);
    if (cached) return cached;

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('scan_sessions')
          .select('*')
          .eq('session_id', scanId)
          .single();

        if (data && !error) {
          const session: ScanSession = {
            scan_id: data.session_id,
            organization_id: data.organization_id || 'org_main',
            jurisdiction: data.jurisdiction,
            rule_pack_version: '2026.1-GA',
            business_profile: createDefaultBusinessProfile(data.jurisdiction),
            system_profile: createDefaultSystemProfile(),
            status: data.status,
            document_name: data.file_name,
            document_size_bytes: Number(data.file_size_bytes || 0),
            document_hash: data.file_sha256,
            storage_path: data.storage_path,
            extraction_result: data.extraction_json,
            scorecard: data.scorecard_json,
          };
          activeScans.set(scanId, session);
          return session;
        }
      } catch (_) {}
    }

    return null;
  }

  public static async attachDocument(
    scanId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    userId?: string
  ): Promise<{ passed: boolean; sha256: string; error?: string }> {
    const scan = await this.getScan(scanId);
    if (!scan) throw new Error('Scan session not found');

    // 1. Byte-level security inspection
    const inspection = await SecurityScanner.inspectFileBuffer(fileBuffer, fileName, mimeType);
    if (!inspection.passed) {
      scan.status = 'SECURITY_REJECTED';
      activeScans.set(scanId, scan);
      return { passed: false, sha256: inspection.sha256Hash, error: 'File failed security inspection' };
    }

    // 2. Upload to Supabase Storage if configured
    let storagePath = `invoices/${scanId}/${fileName}`;
    if (isSupabaseConfigured()) {
      const uint8 = new Uint8Array(fileBuffer);
      const uploadRes = await uploadInvoiceToSupabase(new Blob([uint8]), fileName, userId);
      if (uploadRes.path) {
        storagePath = uploadRes.path;
      }
    }

    scan.document_name = fileName;
    scan.document_size_bytes = fileBuffer.length;
    scan.document_hash = inspection.sha256Hash;
    scan.document_mime_type = mimeType;
    scan.storage_path = storagePath;
    scan.status = 'SECURITY_PASSED';
    activeScans.set(scanId, scan);
    scanFiles.set(scanId, { buffer: fileBuffer, filename: fileName, mimeType });

    return { passed: true, sha256: inspection.sha256Hash };
  }

  public static async processScan(
    scanId: string,
    businessProfile: BusinessProfile,
    systemProfile: SystemProfile
  ): Promise<ScanSession> {
    const scan = await this.getScan(scanId);
    if (!scan) throw new Error('Scan session not found');

    scan.status = 'EXTRACTING';
    scan.business_profile = businessProfile;
    scan.system_profile = systemProfile;
    activeScans.set(scanId, scan);

    // 1. Extract text and canonical schema
    const storedFile = scanFiles.get(scanId);
    let rawText = '';
    if (storedFile) {
      rawText = await DocumentParser.extractDocumentText(storedFile.buffer, storedFile.filename, storedFile.mimeType);
    }

    const extraction = await GeminiExtractor.extractInvoice(
      scan.document_name || 'invoice.pdf',
      rawText || 'Standard B2B tax invoice',
      scan.document_mime_type || 'application/pdf',
      scanId
    );

    // 2. Determine applicability
    const applicability = ApplicabilityEngine.determineApplicability(
      businessProfile,
      systemProfile
    );

    // 3. Execute deterministic rules
    const { validationResults, findings, remediationActions } = RuleEngine.executeRules(
      applicability.applicable_rules,
      extraction.canonical_invoice,
      businessProfile,
      systemProfile,
      extraction.evidence_map
    );

    // 4. Calculate scorecard
    const scorecard = ScoringEngine.calculateScorecard(
      validationResults,
      findings,
      applicability.applicable_rules.length
    );

    scan.extraction_result = extraction;
    scan.validation_results = validationResults;
    scan.findings = findings;
    scan.remediation_plan = remediationActions;
    scan.scorecard = scorecard;
    scan.status = 'COMPLETED';

    activeScans.set(scanId, scan);

    // 5. Persist to Supabase PostgreSQL database
    await SupabaseDbService.saveScanSession(scan, businessProfile, systemProfile);

    return scan;
  }

  public static async deleteScan(scanId: string, organizationId: string): Promise<void> {
    activeScans.delete(scanId);
    scanFiles.delete(scanId);
    try {
      await SupabaseDbService.deleteScanSession(scanId, organizationId);
    } catch (_) {}
  }
}
