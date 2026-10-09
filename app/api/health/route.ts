import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/src/services/supabaseClient';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    platform: 'Next.js + Supabase + Vercel',
    version: '1.0.0-supabase',
    supabaseConnected: isSupabaseConfigured(),
  });
}
