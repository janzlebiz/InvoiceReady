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
   * Saves a full scan session with findings and remediations to Supabase PostgreSQL
   */
  public static async saveScanSession(
    session: ScanSession,
    businessProfile?: BusinessProfile,
    systemProfile?: SystemProfile
  ): Promise<{ success: boolean; sessionId: string; error?: string }> {
    const scanId = session.scan_id;

    if (!isSupabaseConfigured()) {
      // In demo/offline mode, store in localStorage for persistence across reloads
      try {
        if (typeof window !== 'undefined') {
          const key = `invoiceready_scans`;
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.unshift(session);
          localStorage.setItem(key, JSON.stringify(existing.slice(0, 30)));
        }
      } catch (_) {}
      return { success: true, sessionId: scanId };
    }

    const supabase = getSupabase();

    try {
      // 1. Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();

      // 2. Insert scan session
      const { error: sessionErr } = await supabase
        .from('scan_sessions')
        .upsert({
          session_id: scanId,
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
        });

      if (sessionErr) {
        console.warn('Failed to insert scan session into Supabase:', sessionErr.message);
        return { success: false, sessionId: scanId, error: sessionErr.message };
      }

      // 3. Batch insert findings
      if (session.findings && session.findings.length > 0) {
        const findingRows = session.findings.map((f: Finding) => ({
          finding_id: f.finding_id,
          session_id: scanId,
          rule_id: f.rule_id,
          severity: f.severity,
          title: f.title,
          description: f.description,
          legal_reference: f.regulatory_source?.locator || null,
          field_name: f.evidence?.fields?.join(', ') || null,
          expected_value: null,
          actual_value: null,
        }));

        await supabase.from('findings').upsert(findingRows);
      }

      // 4. Batch insert remediations
      if (session.remediation_plan && session.remediation_plan.length > 0) {
        const remRows = session.remediation_plan.map((r: RemediationAction) => ({
          remediation_id: r.action_id,
          session_id: scanId,
          title: r.title,
          description: r.problem || r.what_to_change,
          priority: r.priority,
          category: r.category,
          estimated_effort: r.effort,
          technical_steps: r.suggested_implementation || [],
        }));

        await supabase.from('remediations').upsert(remRows);
      }

      // 5. Save business & system profiles
      if (businessProfile) {
        await supabase.from('business_profiles').upsert({
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
        });
      }

      if (systemProfile) {
        await supabase.from('system_profiles').upsert({
          user_id: user?.id || null,
          accounting_system: systemProfile.accounting_system,
          invoicing_system: systemProfile.invoicing_system,
          pos_erp_name: systemProfile.pos_erp_name || null,
          current_invoice_format: systemProfile.current_invoice_format,
          structured_export_capability: systemProfile.structured_export_capability,
        });
      }

      return { success: true, sessionId: scanId };
    } catch (err: any) {
      return { success: false, sessionId: scanId, error: err.message };
    }
  }

  /**
   * Loads recent scan sessions from Supabase
   */
  public static async getRecentScans(limit = 10): Promise<any[]> {
    if (!isSupabaseConfigured()) {
      try {
        if (typeof window !== 'undefined') {
          return JSON.parse(localStorage.getItem('invoiceready_scans') || '[]');
        }
      } catch (_) {}
      return [];
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('scan_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('Failed to fetch scans from Supabase:', error.message);
      return [];
    }

    return data || [];
  }

  public static async deleteScanSession(scanId: string, organizationId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();
    await supabase.from('scan_sessions').delete().eq('session_id', scanId);
  }
}
