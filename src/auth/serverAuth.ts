/**
 * InvoiceReady v1.0 - Server-Side Authentication & Tenant RBAC (Fail-Closed Rework)
 * Conforms to SEC-001, SEC-002, SEC-003 requirements.
 * Zero fail-open fallback, zero synthetic preview users.
 */

import { NextRequest } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '../services/supabaseClient';

export interface ServerAuthContext {
  userId: string;
  email: string;
  organizationId: string;
  role: 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER';
}

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Verifies the incoming request's Authorization Bearer token against Supabase Auth.
 * Fails closed on missing tokens, invalid tokens, database errors, or missing membership.
 */
export async function verifyServerAuth(req: NextRequest): Promise<ServerAuthContext> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Unauthorized: Missing or malformed Authorization Bearer token.', 401);
  }

  const token = authHeader.substring(7);

  if (!isSupabaseConfigured()) {
    throw new AuthError('Unauthorized: Supabase authentication service is not configured.', 401);
  }

  const supabase = getSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new AuthError(`Unauthorized: Invalid or expired token (${userError?.message || 'verification failed'})`, 401);
  }

  // Resolve authoritative organization membership and role strictly from PostgreSQL
  const { data: memberships, error: memberError } = await supabase
    .from('organization_users')
    .select('organization_id, role')
    .eq('user_id', user.id);

  if (memberError || !memberships || memberships.length === 0) {
    throw new AuthError('Forbidden: Authenticated user has no valid organization membership.', 403);
  }

  // If user belongs to multiple organizations, check for explicit header selector
  let selectedOrgId = memberships[0].organization_id;
  const rawRole = memberships[0].role;
  if (!rawRole || !['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'].includes(rawRole)) {
    throw new AuthError('Forbidden: Organization membership role missing or unverified.', 403);
  }
  let selectedRole = rawRole as 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER';

  const requestedOrgId = req.headers.get('x-organization-id');
  if (requestedOrgId) {
    const matched = memberships.find((m) => m.organization_id === requestedOrgId);
    if (!matched) {
      throw new AuthError('Forbidden: Requested organization ID is not associated with this user.', 403);
    }
    const matchedRole = matched.role;
    if (!matchedRole || !['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'].includes(matchedRole)) {
      throw new AuthError('Forbidden: Requested organization membership role missing or unverified.', 403);
    }
    selectedOrgId = matched.organization_id;
    selectedRole = matchedRole as 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER';
  } else if (memberships.length > 1) {
    // If multiple memberships exist and no header is provided, fail closed or require header
    throw new AuthError('Forbidden: Multiple organization memberships detected. Provide x-organization-id header.', 403);
  }

  if (!['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'].includes(selectedRole)) {
    throw new AuthError('Forbidden: Invalid organization membership role assigned.', 403);
  }

  return {
    userId: user.id,
    email: user.email || `${user.id}@invoiceready.internal`,
    organizationId: selectedOrgId,
    role: selectedRole,
  };
}
