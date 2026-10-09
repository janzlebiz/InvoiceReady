import { NextRequest, NextResponse } from 'next/server';
import { GeminiExtractor } from '@/src/services/geminiExtractor';
import { verifyServerAuth } from '@/src/auth/serverAuth';
import { ScanService } from '@/src/services/scanService';
import { DocumentParser } from '@/src/services/documentParser';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyServerAuth(req);
    if (!['ANALYST', 'ADMIN', 'OWNER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions for extraction' }, { status: 403 });
    }

    const body = await req.json();
    const { scanId, documentId } = body;

    if (!scanId || !documentId) {
      return NextResponse.json(
        { error: 'Missing required parameters: scanId and documentId are mandatory for secure extraction.' },
        { status: 400 }
      );
    }

    const scan = await ScanService.getScan(scanId);
    if (!scan) {
      return NextResponse.json({ error: 'Scan session not found' }, { status: 404 });
    }

    if (scan.organization_id && scan.organization_id !== auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden: Cross-tenant resource access denied' }, { status: 403 });
    }

    if (scan.status !== 'SECURITY_PASSED' && scan.status !== 'COMPLETED' && scan.status !== 'REVIEW_REQUIRED') {
      return NextResponse.json({ error: 'Forbidden: Document has not passed security and malware inspection.' }, { status: 400 });
    }

    // Retrieve authorized stored bytes server-side
    const fileBytes = await ScanService.getStoredFileBuffer(scanId);
    if (!fileBytes || fileBytes.length === 0) {
      return NextResponse.json({ error: 'Authorized stored document bytes not found in server quarantine/storage.' }, { status: 404 });
    }

    const rawText = await DocumentParser.extractDocumentText(
      fileBytes,
      scan.document_name || 'invoice.pdf',
      scan.document_mime_type || 'application/pdf'
    );

    const result = await GeminiExtractor.extractInvoice(
      scan.document_name || 'invoice.pdf',
      rawText,
      scan.document_mime_type || 'application/pdf',
      scanId
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
