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
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions for processing assessment' }, { status: 403 });
    }

    const { scanId } = await params;
    const scan = await ScanService.getScan(scanId, auth.organizationId);

    if (!scan) {
      return NextResponse.json({ error: 'Scan session not found or does not belong to authorized organization' }, { status: 404 });
    }

    if (scan.organization_id !== auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden: Cross-tenant resource access denied' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const businessProfile = {
      ...(body.business_profile || scan.business_profile || {}),
      organization_id: auth.organizationId,
    };
    const systemProfile = {
      ...(body.system_profile || scan.system_profile || {}),
      organization_id: auth.organizationId,
    };

    const updatedScan = await ScanService.processScan(scanId, auth.organizationId, businessProfile, systemProfile);

    return NextResponse.json(updatedScan);
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 401 : err.message?.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Processing failed' }, { status });
  }
}
