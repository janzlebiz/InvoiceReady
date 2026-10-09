import { NextRequest, NextResponse } from 'next/server';
import { ScanService } from '@/src/services/scanService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jurisdiction, business_profile, system_profile } = body;

    const scan = await ScanService.createScan(
      jurisdiction || 'AE',
      business_profile,
      system_profile
    );

    return NextResponse.json({
      scan_id: scan.scan_id,
      jurisdiction: scan.jurisdiction,
      status: scan.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create scan' }, { status: 500 });
  }
}
