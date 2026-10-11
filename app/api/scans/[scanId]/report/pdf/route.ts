import { NextRequest, NextResponse } from 'next/server';
import { ScanService } from '@/src/services/scanService';
import { PdfReportService } from '@/src/services/pdfReportService';
import { uploadReportToSupabase } from '@/src/services/supabaseStorage';
import { isSupabaseConfigured, getSupabase } from '@/src/services/supabaseClient';
import { verifyServerAuth, AuthError } from '@/src/auth/serverAuth';
import crypto from 'crypto';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const auth = await verifyServerAuth(req);
    const { scanId } = await params;
    const scan = await ScanService.getScan(scanId, auth.organizationId);
    if (!scan) {
      return NextResponse.json({ error: 'Scan session not found or does not belong to authorized organization' }, { status: 404 });
    }
    if (scan.organization_id !== auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden: Cross-tenant resource access denied' }, { status: 403 });
    }
    const pdfBuffer = await PdfReportService.renderPdfDocument(
      scan,
      'Compliance Readiness Evaluator'
    );
    const fileName = `InvoiceReady_Report_${scan.scan_id}_${scan.jurisdiction}.pdf`;

    if (!isSupabaseConfigured()) {
      throw new Error('Durable report generation failed: Supabase Storage service is not configured.');
    }
    const uploadRes = await uploadReportToSupabase(pdfBuffer, fileName, auth.organizationId, scanId);
    if (!uploadRes.url) {
      throw new Error('Durable report upload failed: Could not obtain verified signed download URL.');
    }

    const supabase = auth.supabaseClient || getSupabase();
    const reportId = `rep_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const retentionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: dbErr } = await supabase.from('scan_reports').upsert({
      report_id: reportId,
      session_id: scanId,
      organization_id: auth.organizationId,
      rule_pack_version: scan.rule_pack_version,
      storage_path: uploadRes.path,
      retention_expires_at: retentionExpiresAt,
      created_at: new Date().toISOString(),
    });
    if (dbErr) {
      throw new Error(`Durable report persistence failed: ${dbErr.message}`);
    }

    const format = req.nextUrl.searchParams.get('format');
    if (format === 'json') {
      return NextResponse.json({
        report_id: reportId,
        scan_id: scanId,
        organization_id: auth.organizationId,
        download_url: uploadRes.url,
        file_name: fileName,
        created_at: new Date().toISOString(),
      });
    }

    const uint8 = new Uint8Array(pdfBuffer);
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.statusCode : (err.message?.includes('Unauthorized') ? 401 : err.message?.includes('Forbidden') ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Report generation failed' }, { status });
  }
}
