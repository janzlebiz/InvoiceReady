/**
 * InvoiceReady v1.0 - Supabase Storage Service (Strict Tenant Path Scoping)
 * Approved Architecture: Next.js + Supabase + Vercel
 * Enforces SEC-005: private buckets ('invoices', 'reports', 'quarantine'),
 * tenant-scoped paths (<org_id>/<scan_id>/<object_id>),
 * no local-path fallback disguised as durable success, and strict error propagation.
 */

import { getSupabase, getSupabaseAdmin, isSupabaseConfigured } from './supabaseClient';
import crypto from 'crypto';

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

  const supabase = getSupabaseAdmin() || getSupabase();
  const objectUuid = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const path = `${organizationId}/${scanId}/${objectUuid}`;

  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(path, file, {
      cacheControl: '0',
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
 * Uploads a file to the private 'quarantine' bucket prior to security scanning
 */
export async function saveToQuarantine(
  buffer: Buffer,
  originalFileName: string,
  organizationId: string,
  scanId: string
): Promise<{ quarantinePath: string; sha256Hash: string }> {
  if (!organizationId || !scanId) {
    throw new Error('Quarantine upload failed: organizationId and scanId are mandatory.');
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Storage service is not configured.');
  }

  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const sanitizedName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const quarantinePath = `${organizationId}/${scanId}/quarantine_${Date.now()}_${sanitizedName}`;

  const supabase = getSupabaseAdmin() || getSupabase();
  const { error: uploadErr } = await supabase.storage
    .from('quarantine')
    .upload(quarantinePath, buffer, {
      contentType: 'application/octet-stream',
      upsert: true,
      cacheControl: '0',
    });

  if (uploadErr) {
    throw new Error(`Failed to save document to quarantine bucket: ${uploadErr.message}`);
  }

  return { quarantinePath, sha256Hash };
}

/**
 * Promotes a verified document from 'quarantine' to the private 'invoices' bucket
 */
export async function promoteToPrivateStorage(
  quarantinePath: string,
  organizationId: string,
  scanId: string,
  fileName: string
): Promise<string> {
  if (!organizationId || !scanId) {
    throw new Error('Storage promotion failed: organizationId and scanId are mandatory.');
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Storage service is not configured.');
  }

  const supabase = getSupabaseAdmin() || getSupabase();

  // Download from quarantine
  const { data: qBlob, error: qErr } = await supabase.storage
    .from('quarantine')
    .download(quarantinePath);

  if (qErr || !qBlob) {
    throw new Error(`Failed to retrieve quarantined file for promotion: ${qErr?.message || 'Object missing'}`);
  }

  const arrayBuf = await qBlob.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuf);
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const destinationPath = `${organizationId}/${scanId}/${sanitizedName}`;

  // Upload to invoices
  const { error: upErr } = await supabase.storage
    .from('invoices')
    .upload(destinationPath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '0',
    });

  if (upErr) {
    throw new Error(`Failed to promote file to private storage: ${upErr.message}`);
  }

  // Cleanup quarantine copy
  try {
    await supabase.storage.from('quarantine').remove([quarantinePath]);
  } catch (_) {}

  return destinationPath;
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

  const supabase = getSupabaseAdmin() || getSupabase();
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
 * Validates ownership before generating signed URLs.
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
  const supabase = getSupabaseAdmin() || getSupabase();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message || 'Unknown error'}`);
  }
  return data.signedUrl;
}

/**
 * Downloads stored file bytes directly from Supabase Storage with tenant path check
 */
export async function downloadStorageBytes(
  bucket: 'invoices' | 'reports' | 'quarantine',
  path: string,
  organizationId: string
): Promise<Buffer> {
  if (!organizationId) {
    throw new Error('Organization ID is mandatory for storage retrieval.');
  }
  if (!path.startsWith(`${organizationId}/`)) {
    throw new Error('Forbidden: Storage object does not belong to authorized organization.');
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Storage service is not configured.');
  }

  const supabase = getSupabaseAdmin() || getSupabase();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`Failed to download storage object: ${error?.message || 'Object not found'}`);
  }

  const arrayBuf = await data.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Permanently deletes a physical file from Supabase Storage
 */
export async function deletePhysicalFile(path: string): Promise<{ success: boolean; errors?: string[] }> {
  const supabase = getSupabaseAdmin() || getSupabase();
  if (!supabase) {
    throw new Error('Supabase client not initialized for physical deletion.');
  }
  
  // SEC-005: Authoritative physical deletion.
  const buckets: Array<'invoices' | 'reports' | 'quarantine'> = ['invoices', 'reports', 'quarantine'];
  
  const results = await Promise.all(
    buckets.map(async (bucket) => {
      const { data, error } = await supabase.storage.from(bucket).remove([path]);
      return { bucket, data, error };
    })
  );
  
  const errors = results.filter(r => r.error).map(r => `${r.bucket}: ${r.error!.message}`);
  
  // SEC-005: Rigorous authoritative verification.
  // We attempt to download the file from each bucket to confirm it's actually gone.
  const verifyResults = await Promise.all(
    buckets.map(async (bucket) => {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      // If we get data, it means deletion failed or is not yet propagated.
      // Note: "Object not found" error is what we WANT here.
      if (data) return { bucket, exists: true };
      return { bucket, exists: false };
    })
  );

  const stillExists = verifyResults.filter(v => v.exists).map(v => v.bucket);
  if (stillExists.length > 0) {
    errors.push(`Verification failed: Object still readable in buckets: ${stillExists.join(', ')}`);
  }

  return { 
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
