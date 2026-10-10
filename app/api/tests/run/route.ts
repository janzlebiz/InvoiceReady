import { NextRequest, NextResponse } from 'next/server';
import { TestRunner } from '@/src/engine/testRunner';
import { verifyServerAuth } from '@/src/auth/serverAuth';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyServerAuth(req);
    if (!['ADMIN', 'OWNER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions for test execution' }, { status: 403 });
    }

    const outcome = await TestRunner.runBehavioralTestSuite();
    return NextResponse.json(outcome);
  } catch (err: any) {
    console.error('API /tests/run error:', err);
    return NextResponse.json({ error: err.message || 'Failed to run test suite' }, { status: 500 });
  }
}
