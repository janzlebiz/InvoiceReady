import { NextRequest, NextResponse } from 'next/server';
import { ScanService } from '@/src/services/scanService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const body = await req.json().catch(() => ({}));
    const businessProfile = body.business_profile || {
      id: 'bp_default',
      organization_id: 'org_supabase_main',
      country: 'AE',
      business_name: 'Assessed Organization LLC',
      tax_identifier: '100456789012345',
      vat_registered: true,
      revenue_band: 'BELOW_50M_AED',
      transaction_types: ['B2B'],
      branch_count: 1,
    };
    const systemProfile = body.system_profile || {
      id: 'sp_default',
      organization_id: 'org_supabase_main',
      accounting_system: 'SAP',
      invoicing_system: 'CUSTOM_ERP',
      current_invoice_format: 'PDF',
      structured_export_capability: false,
      erp_customizable: true,
      daily_invoice_volume: 50,
      has_existing_integration: false,
    };

    const updatedScan = await ScanService.processScan(scanId, businessProfile, systemProfile);

    return NextResponse.json(updatedScan);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Processing failed' }, { status: 500 });
  }
}
