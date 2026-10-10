import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let clientInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  // Behavioral integration tests MUST be deterministic.
  // Real Supabase storage has eventual consistency/caching that breaks immediate "deleted-then-read" assertions.
  if (process.env.NODE_ENV === 'test' && !process.env.FORCE_SUPABASE_TESTS) {
    return false;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return Boolean(
    url &&
    anonKey &&
    !url.includes('your-project') &&
    !url.includes('placeholder') &&
    !anonKey.includes('placeholder') &&
    url.startsWith('https://')
  );
}

export function getSupabase(): SupabaseClient {
  if (clientInstance) return clientInstance;

  if (!isSupabaseConfigured()) {
    return null;
  }

  clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return clientInstance;
}

let adminInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminInstance) return adminInstance;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  adminInstance = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminInstance;
}

export const supabase = getSupabase();

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) {
    return {};
  }
  try {
    const client = getSupabase();
    const { data: { session } } = await client.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch (_) {}
  return {};
}

export const getClientAuthHeader = getAuthHeaders;
