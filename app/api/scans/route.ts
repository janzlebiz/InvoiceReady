import { NextRequest, NextResponse } from 'next/server';
import { ScanService } from '@/src/services/scanService';
import { verifyServerAuth } from '@/src/auth/serverAuth';
import { SupabaseDbService } from '@/src/services/supabaseDatabase';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyServerAuth(req);
    if (!['ANALYST', 'ADMIN', 'OWNER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions for assessment creation' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { jurisdiction, business_profile, system_profile } = body;

    const scan = await ScanService.createScan(
      jurisdiction || 'AE',
      { ...(business_profile || {}), organization_id: auth.organizationId },
      { ...(system_profile || {}), organization_id: auth.organizationId },
      auth.userId,
      auth.organizationId
    );

    return NextResponse.json({
      scan_id: scan.scan_id,
      jurisdiction: scan.jurisdiction,
      status: scan.status,
      organization_id: auth.organizationId,
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 401 : err.message?.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Failed to create scan' }, { status });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyServerAuth(req);
    const limit = Number(req.nextUrl.searchParams.get('limit') || 20);
    const scans = await SupabaseDbService.getRecentScans(auth.organizationId, limit);
    return NextResponse.json(scans);
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 401 : err.message?.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Failed to list scans' }, { status });
  }
}
