import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let clientInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
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

export function createRequestScopedClient(jwtToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !anonKey || url.includes('placeholder') || anonKey.includes('placeholder') || !url.startsWith('https://')) {
    return null;
  }
  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabase(): SupabaseClient | null {
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
    if (!client) return {};
    const { data: { session } } = await client.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch (_) {}
  return {};
}

export const getClientAuthHeader = getAuthHeaders;
