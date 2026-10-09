import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let clientInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project') &&
    supabaseUrl.startsWith('https://')
  );
}

export function getSupabase(): SupabaseClient {
  if (clientInstance) return clientInstance;

  if (!isSupabaseConfigured()) {
    // Provide a placeholder client for demo/offline preview mode so calls don't crash
    const placeholderUrl = 'https://placeholder-project.supabase.co';
    const placeholderKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';
    clientInstance = createClient(placeholderUrl, placeholderKey, {
      auth: { persistSession: true },
    });
    return clientInstance;
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

export const supabase = getSupabase();

export async function getAuthHeaders(): Promise<Record<string, string>> {
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
