import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import {
  ScanSession,
  BusinessProfile,
  SystemProfile,
  Finding,
  RemediationAction,
} from '../engine/types';

export class SupabaseDbService {
  /**
   * Saves a full scan session with findings and remediations to Supabase PostgreSQL.
   * Conforms to Phase 1 durability: zero silent fallbacks, zero swallowed errors,
   * strictly tenant-owned.
   */
  public static async saveScanSession(
    session: ScanSession,
    businessProfile?: BusinessProfile,
    systemProfile?: SystemProfile
  ): Promise<{ success: boolean; sessionId: string; error?: string }> {
    const scanId = session.scan_id;

    if (!session.organization_id) {
      throw new Error('Durable persistence rejected: Scan session is missing organization_id.');
    }

    if (!isSupabaseConfigured()) {
      throw new Error('Durable persistence unavailable: Supabase database is not configured.');
    }

    const supabase = getSupabase();

    // 1. Get current authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Insert/upsert scan session with mandatory organization_id
    const { error: sessionErr } = await supabase
      .from('scan_sessions')
      .upsert({
        session_id: scanId,
        organization_id: session.organization_id,
        user_id: user?.id || null,
        jurisdiction: session.jurisdiction,
        status: session.status || 'COMPLETED',
        storage_path: session.storage_path || null,
        file_name: session.document_name || 'uploaded_invoice.pdf',
        file_size_bytes: session.document_size_bytes || 0,
        file_sha256: session.document_hash || null,
        overall_score: session.scorecard?.overall_score || 0,
        readiness_status: session.scorecard?.classification || 'ASSESSED',
        extraction_json: session.extraction_result || null,
        scorecard_json: session.scorecard || null,
        updated_at: new Date().toISOString(),
      });

    if (sessionErr) {
      throw new Error(`Failed to persist scan session in database: ${sessionErr.message}`);
    }

    // 3. Batch insert findings
    if (session.findings && session.findings.length > 0) {
      const findingRows = session.findings.map((f: Finding) => ({
        finding_id: f.finding_id,
        session_id: scanId,
        organization_id: session.organization_id,
        rule_id: f.rule_id,
        severity: f.severity,
        title: f.title,
        description: f.description,
        legal_reference: f.regulatory_source?.locator || null,
        field_name: f.evidence?.fields?.join(', ') || null,
        expected_value: null,
        actual_value: null,
      }));

      const { error: findingsErr } = await supabase.from('findings').upsert(findingRows);
      if (findingsErr) {
        throw new Error(`Failed to persist findings in database: ${findingsErr.message}`);
      }
    }

    // 4. Batch insert remediations
    if (session.remediation_plan && session.remediation_plan.length > 0) {
      const remRows = session.remediation_plan.map((r: RemediationAction) => ({
        remediation_id: r.action_id,
        session_id: scanId,
        organization_id: session.organization_id,
        title: r.title,
        description: r.problem || r.what_to_change,
        priority: r.priority,
        category: r.category,
        estimated_effort: r.effort,
        technical_steps: r.suggested_implementation || [],
      }));

      const { error: remErr } = await supabase.from('remediations').upsert(remRows);
      if (remErr) {
        throw new Error(`Failed to persist remediations in database: ${remErr.message}`);
      }
    }

    // 5. Save business & system profiles
    if (businessProfile) {
      const { error: bpErr } = await supabase.from('business_profiles').upsert({
        organization_id: session.organization_id,
        user_id: user?.id || null,
        country: businessProfile.country,
        business_name: businessProfile.business_name,
        trade_name: businessProfile.trade_name || null,
        tax_identifier: businessProfile.tax_identifier,
        vat_registered: businessProfile.vat_registered,
        revenue_band: businessProfile.revenue_band,
        transaction_types: businessProfile.transaction_types,
        taxpayer_category: businessProfile.taxpayer_category || null,
        branch_count: businessProfile.branch_count || 1,
        updated_at: new Date().toISOString(),
      });
      if (bpErr) {
        throw new Error(`Failed to persist business profile: ${bpErr.message}`);
      }
    }

    if (systemProfile) {
      const { error: spErr } = await supabase.from('system_profiles').upsert({
        organization_id: session.organization_id,
        user_id: user?.id || null,
        accounting_system: systemProfile.accounting_system,
        invoicing_system: systemProfile.invoicing_system,
        pos_erp_name: systemProfile.pos_erp_name || null,
        current_invoice_format: systemProfile.current_invoice_format,
        structured_export_capability: systemProfile.structured_export_capability,
        updated_at: new Date().toISOString(),
      });
      if (spErr) {
        throw new Error(`Failed to persist system profile: ${spErr.message}`);
      }
    }

    return { success: true, sessionId: scanId };
  }

  /**
   * Loads recent scan sessions from Supabase strictly scoped to tenant
   */
  public static async getRecentScans(organizationId: string, limit = 10): Promise<any[]> {
    if (!organizationId) {
      throw new Error('Organization ID is required to fetch scans.');
    }
    if (!isSupabaseConfigured()) {
      throw new Error('Database service is not configured.');
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('scan_sessions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch scans from Supabase: ${error.message}`);
    }

    return data || [];
  }

  public static async deleteScanSession(scanId: string, organizationId: string): Promise<void> {
    if (!scanId || !organizationId) {
      throw new Error('scanId and organizationId are required to delete a scan session.');
    }
    if (!isSupabaseConfigured()) {
      throw new Error('Database service is not configured.');
    }
    const supabase = getSupabase();
    const { error } = await supabase
      .from('scan_sessions')
      .delete()
      .eq('session_id', scanId)
      .eq('organization_id', organizationId);

    if (error) {
      throw new Error(`Failed to delete scan session from database: ${error.message}`);
    }
  }
}
