/**
 * InvoiceReady v1.0 - Supabase Storage Service (Strict Tenant Path Scoping)
 * Enforces SEC-005: private buckets, tenant paths (<org_id>/<scan_id>/<object_id>),
 * no local-path fallback disguised as durable success, and strict error propagation.
 */

import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export interface StorageUploadResult {
  path: string;
  url?: string;
  error?: string;
}

/**
 * Uploads an invoice document to Supabase Storage private bucket 'invoices'
 * Path structure: <organization_uuid>/<scan_uuid>/<object_uuid>
 */
export async function uploadInvoiceToSupabase(
  file: File | Blob | Buffer,
  fileName: string,
  organizationId: string,
  scanId: string
): Promise<StorageUploadResult> {
  if (!organizationId || !scanId) {
    throw new Error('Storage upload failed: organizationId and scanId are mandatory for tenant path scoping.');
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Storage upload failed: Supabase Storage is not configured for production use.');
  }

  const supabase = getSupabase();
  const objectUuid = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const path = `${organizationId}/${scanId}/${objectUuid}`;

  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false, // Disallow overwrite by default (SEC-005)
      contentType: (file as any).type || 'application/pdf',
    });

  if (uploadError) {
    throw new Error(`Supabase storage upload error: ${uploadError.message}`);
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from('invoices')
    .createSignedUrl(path, 7200);

  if (signError || !signedData) {
    throw new Error(`Supabase storage sign URL error: ${signError?.message || 'Failed to create signed URL'}`);
  }

  return { path, url: signedData.signedUrl };
}

/**
 * Uploads a generated compliance report PDF to Supabase Storage private bucket 'reports'
 * Path structure: <organization_uuid>/<scan_uuid>/<object_uuid>
 */
export async function uploadReportToSupabase(
  pdfBlobOrBuffer: Blob | Uint8Array | Buffer,
  fileName: string,
  organizationId: string,
  scanId: string
): Promise<StorageUploadResult> {
  if (!organizationId || !scanId) {
    throw new Error('Report upload failed: organizationId and scanId are mandatory for tenant path scoping.');
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Report upload failed: Supabase Storage is not configured for production use.');
  }

  const supabase = getSupabase();
  const objectUuid = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const path = `${organizationId}/${scanId}/${objectUuid}`;

  const { error: uploadError } = await supabase.storage
    .from('reports')
    .upload(path, pdfBlobOrBuffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'application/pdf',
    });

  if (uploadError) {
    throw new Error(`Supabase report upload error: ${uploadError.message}`);
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from('reports')
    .createSignedUrl(path, 86400); // 24h

  if (signError || !signedData) {
    throw new Error(`Supabase report sign URL error: ${signError?.message || 'Failed to create signed URL'}`);
  }

  return { path, url: signedData.signedUrl };
}

/**
 * Retrieves an authorized download/view signed URL for a file in Supabase Storage.
 * Validates ownership before generating signed URLs (Requirement 3).
 */
export async function getSupabaseSignedUrl(
  bucket: 'invoices' | 'reports' | 'quarantine',
  path: string,
  organizationId: string
): Promise<string> {
  if (!organizationId) {
    throw new Error('Ownership verification failed: organizationId is required to generate signed URL.');
  }
  if (!path.startsWith(`${organizationId}/`)) {
    throw new Error('Forbidden: Storage object does not belong to authorized organization.');
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Storage service is not configured.');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message || 'Unknown error'}`);
  }
  return data.signedUrl;
}
