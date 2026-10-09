import { NextRequest, NextResponse } from 'next/server';
import { ScanService } from '@/src/services/scanService';
import { verifyServerAuth } from '@/src/auth/serverAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const auth = await verifyServerAuth(req);
    const { scanId } = await params;
    const scan = await ScanService.getScan(scanId);

    if (!scan) {
      return NextResponse.json({ error: 'Scan session not found' }, { status: 404 });
    }

    if (scan.organization_id && scan.organization_id !== auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden: Cross-tenant resource access denied' }, { status: 403 });
    }

    return NextResponse.json(scan);
  } catch (err: any) {
    const status = err.message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ error: err.message || 'Failed to fetch scan' }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const auth = await verifyServerAuth(req);
    if (!['ADMIN', 'OWNER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges for scan deletion' }, { status: 403 });
    }

    const { scanId } = await params;
    const scan = await ScanService.getScan(scanId);

    if (!scan) {
      return NextResponse.json({ error: 'Scan session not found' }, { status: 404 });
    }

    if (scan.organization_id && scan.organization_id !== auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden: Cross-tenant resource access denied' }, { status: 403 });
    }

    // Perform durable deletion (LIFE-002)
    await ScanService.deleteScan(scanId, auth.organizationId);

    return NextResponse.json({ success: true, message: 'Scan session permanently deleted' });
  } catch (err: any) {
    const status = err.message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ error: err.message || 'Failed to delete scan' }, { status });
  }
}
