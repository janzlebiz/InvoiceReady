import { NextRequest, NextResponse } from 'next/server';
import { TestRunner } from '@/src/engine/testRunner';
import { verifyServerAuth, AuthError } from '@/src/auth/serverAuth';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyServerAuth(req);
    if (!['ADMIN', 'OWNER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions for test execution' }, { status: 403 });
    }
    const outcome = await TestRunner.runBehavioralTestSuite();
    return NextResponse.json(outcome);
  } catch (err: any) {
    const status = err instanceof AuthError ? err.statusCode : (err.message?.includes('Unauthorized') ? 401 : err.message?.includes('Forbidden') ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to run test suite' }, { status });
  }
}
