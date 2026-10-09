import { NextRequest, NextResponse } from 'next/server';
import { ScanService } from '@/src/services/scanService';
import { PdfReportService } from '@/src/services/pdfReportService';
import { uploadReportToSupabase } from '@/src/services/supabaseStorage';
import { isSupabaseConfigured } from '@/src/services/supabaseClient';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const scan = await ScanService.getScan(scanId);

    if (!scan) {
      return NextResponse.json({ error: 'Scan session not found' }, { status: 404 });
    }

    // Render PDF report buffer
    const pdfBuffer = await PdfReportService.renderPdfDocument(
      scan,
      'Certified Regulatory Auditor'
    );

    const fileName = `InvoiceReady_Report_${scan.scan_id}_${scan.jurisdiction}.pdf`;

    // If Supabase Storage is configured, upload to Supabase 'reports' bucket
    let downloadUrl: string | undefined;
    if (isSupabaseConfigured()) {
      const uploadRes = await uploadReportToSupabase(pdfBuffer, fileName);
      if (uploadRes.url) {
        downloadUrl = uploadRes.url;
      }
    }

    // Check if client wants JSON with URL or direct PDF download
    const format = req.nextUrl.searchParams.get('format');
    if (format === 'json' && downloadUrl) {
      return NextResponse.json({
        report_id: `rep_${scanId}`,
        download_url: downloadUrl,
        rule_pack_version: '2026.1-GA',
      });
    }

    // Default: return binary PDF using Uint8Array
    const uint8 = new Uint8Array(pdfBuffer);
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Report generation failed' }, { status: 500 });
  }
}
