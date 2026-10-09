import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export interface StorageUploadResult {
  path: string;
  url?: string;
  error?: string;
}

/**
 * Uploads an invoice document to Supabase Storage bucket 'invoices'
 */
export async function uploadInvoiceToSupabase(
  file: File | Blob,
  fileName: string,
  userId?: string
): Promise<StorageUploadResult> {
  if (!isSupabaseConfigured()) {
    // Offline / Demo mode fallback
    return {
      path: `local_demo/${Date.now()}_${fileName}`,
      url: URL.createObjectURL(file),
    };
  }

  const supabase = getSupabase();
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${userId || 'anonymous'}/${timestamp}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'application/pdf',
    });

  if (uploadError) {
    console.warn('Supabase storage upload error:', uploadError.message);
    return { path, error: uploadError.message };
  }

  // Generate a signed URL valid for 2 hours
  const { data: signedData, error: signError } = await supabase.storage
    .from('invoices')
    .createSignedUrl(path, 7200);

  if (signError) {
    return { path, error: signError.message };
  }

  return { path, url: signedData?.signedUrl };
}

/**
 * Uploads a generated compliance report PDF to Supabase Storage bucket 'reports'
 */
export async function uploadReportToSupabase(
  pdfBlobOrBuffer: Blob | Uint8Array,
  fileName: string,
  userId?: string
): Promise<StorageUploadResult> {
  if (!isSupabaseConfigured()) {
    return {
      path: `local_reports/${Date.now()}_${fileName}`,
      url: typeof window !== 'undefined' ? URL.createObjectURL(new Blob([pdfBlobOrBuffer as any])) : '',
    };
  }

  const supabase = getSupabase();
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${userId || 'system'}/${timestamp}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('reports')
    .upload(path, pdfBlobOrBuffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'application/pdf',
    });

  if (uploadError) {
    return { path, error: uploadError.message };
  }

  const { data: signedData } = await supabase.storage
    .from('reports')
    .createSignedUrl(path, 86400); // 24h

  return { path, url: signedData?.signedUrl };
}

/**
 * Retrieves a download/view signed URL for a file in Supabase Storage
 */
export async function getSupabaseSignedUrl(bucket: 'invoices' | 'reports', path: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}
