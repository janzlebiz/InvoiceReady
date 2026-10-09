import { NextRequest, NextResponse } from 'next/server';
import { ScanService } from '@/src/services/scanService';

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

    return NextResponse.json(scan);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch scan' }, { status: 500 });
  }
}
