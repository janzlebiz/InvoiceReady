import { NextRequest, NextResponse } from 'next/server';
import { ScanService } from '@/src/services/scanService';
import { verifyServerAuth } from '@/src/auth/serverAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const auth = await verifyServerAuth(req);
    if (!['ANALYST', 'ADMIN', 'OWNER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions for document upload' }, { status: 403 });
    }

    const { scanId } = await params;
    const scan = await ScanService.getScan(scanId);

    if (!scan) {
      return NextResponse.json({ error: 'Scan session not found' }, { status: 404 });
    }

    if (scan.organization_id && scan.organization_id !== auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden: Cross-tenant resource access denied' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await ScanService.attachDocument(
      scanId,
      buffer,
      file.name,
      file.type || 'application/pdf'
    );

    if (!result.passed) {
      return NextResponse.json(
        { error: result.error || 'Security inspection failed', sha256: result.sha256 },
        { status: 400 }
      );
    }

    return NextResponse.json({
      scan_id: scanId,
      file_name: file.name,
      sha256_hash: result.sha256,
      status: 'UPLOADED',
    });
  } catch (err: any) {
    const status = err.message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ error: err.message || 'Failed to upload document' }, { status });
  }
}
