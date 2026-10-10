/**
 * InvoiceReady v1.0 - Private Storage Service
 * Approved Architecture: Next.js + Supabase + Vercel
 * Delegates to Supabase Storage private buckets when configured, with robust in-memory fallback for local tests.
 */

import {
  saveToQuarantine as sbSaveToQuarantine,
  promoteToPrivateStorage as sbPromoteToPrivateStorage,
  getSupabaseSignedUrl,
  downloadStorageBytes as sbDownloadStorageBytes,
  deletePhysicalFile as sbDeletePhysicalFile,
} from './supabaseStorage';
import { isSupabaseConfigured } from './supabaseClient';
import crypto from 'crypto';

const memoryStorageMap = new Map<string, Buffer>();

export interface StoredDocumentMetadata {
  documentId: string;
  organizationId: string;
  scanId: string;
  fileName: string;
  storagePath: string;
  quarantinePath?: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256Hash: string;
  isQuarantined: boolean;
  retentionExpiresAt: string;
  createdAt: string;
}

export class StorageService {
  public static initializeStorageDirs(): void {
    // Cloud storage does not require local directory creation
  }

  public static async saveToQuarantine(
    buffer: Buffer,
    originalFileName: string,
    organizationId: string,
    scanId: string
  ): Promise<{ quarantinePath: string; sha256Hash: string }> {
    const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const sanitizedName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const quarantinePath = `${organizationId}/${scanId}/quarantine_${Date.now()}_${sanitizedName}`;

    if (isSupabaseConfigured()) {
      return sbSaveToQuarantine(buffer, originalFileName, organizationId, scanId);
    } else {
      memoryStorageMap.set(quarantinePath, buffer);
      return { quarantinePath, sha256Hash };
    }
  }

  public static async promoteToPrivateStorage(
    quarantinePath: string,
    organizationId: string,
    scanId: string,
    fileName: string
  ): Promise<string> {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destinationPath = `${organizationId}/${scanId}/${sanitizedName}`;

    if (isSupabaseConfigured()) {
      return sbPromoteToPrivateStorage(quarantinePath, organizationId, scanId, fileName);
    } else {
      const buf = memoryStorageMap.get(quarantinePath);
      if (buf) {
        memoryStorageMap.set(destinationPath, buf);
        memoryStorageMap.delete(quarantinePath);
      }
      return destinationPath;
    }
  }

  public static async generateSignedUrl(
    storagePath: string,
    expirationMinutes: number = 30
  ): Promise<string> {
    const orgId = storagePath.split('/')[0];
    const bucket = storagePath.includes('Readiness_Report') ? 'reports' : 'invoices';
    if (isSupabaseConfigured()) {
      return getSupabaseSignedUrl(bucket, storagePath, orgId);
    }
    return `https://supabase-storage-mock.internal/${bucket}/${storagePath}?token=mock_signed_url`;
  }

  public static async getStoredDocumentBuffer(
    storagePath: string,
    organizationId: string
  ): Promise<Buffer | null> {
    const bucket = storagePath.includes('Readiness_Report') ? 'reports' : 'invoices';
    if (isSupabaseConfigured()) {
      try {
        return await sbDownloadStorageBytes(bucket, storagePath, organizationId);
      } catch (_) {
        return null;
      }
    } else {
      return memoryStorageMap.get(storagePath) || null;
    }
  }

  public static async readStoredFile(storagePath: string): Promise<Buffer | null> {
    const orgId = storagePath.split('/')[0];
    return this.getStoredDocumentBuffer(storagePath, orgId);
  }

  public static async deletePhysicalFile(storagePath: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      return sbDeletePhysicalFile(storagePath);
    } else {
      const existed = memoryStorageMap.has(storagePath);
      memoryStorageMap.delete(storagePath);
      return existed;
    }
  }
}
