import { NextRequest, NextResponse } from 'next/server';
import { GeminiExtractor } from '@/src/services/geminiExtractor';
import { verifyServerAuth } from '@/src/auth/serverAuth';
import { ScanService } from '@/src/services/scanService';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyServerAuth(req);
    if (!['ANALYST', 'ADMIN', 'OWNER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions for extraction' }, { status: 403 });
    }

    const body = await req.json();
    const { fileName, rawText, mimeType, scanId } = body;

    if (!fileName || !rawText) {
      return NextResponse.json(
        { error: 'Missing required extraction parameters: fileName and rawText.' },
        { status: 400 }
      );
    }

    if (scanId) {
      const scan = await ScanService.getScan(scanId);
      if (scan && scan.organization_id && scan.organization_id !== auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden: Cross-tenant resource access denied' }, { status: 403 });
      }
    }

    const result = await GeminiExtractor.extractInvoice(
      fileName,
      rawText,
      mimeType || 'application/pdf',
      scanId || `scan_${Date.now().toString(36)}`
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /extract error:', err);
    const status = err.message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json(
      { error: err.message || 'Internal error in extraction route' },
      { status }
    );
  }
}
