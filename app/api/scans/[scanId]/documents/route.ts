import { NextRequest, NextResponse } from 'next/server';
import { ScanService } from '@/src/services/scanService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
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
    return NextResponse.json({ error: err.message || 'Failed to upload document' }, { status: 500 });
  }
}
