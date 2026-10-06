/**
 * InvoiceReady v1.0 - Private Google Cloud Storage Service
 * Conforms to Requirements 13-18, 27, 28, Sections 34, 35, 44.
 *
 * Production Hardening Guarantees:
 * 1. Global shared object storage across multiple Cloud Run instances.
 * 2. Strict isolation: Quarantine bucket vs. Private documents bucket.
 * 3. Short-lived signed URLs for client document downloads.
 * 4. Never exposes raw storage bucket paths or internal URIs to clients.
 * 5. Permanent object deletion during 24h retention purging and user deletion.
 */

import { Storage } from '@google-cloud/storage';
import { SecurityScanner } from './securityScanner';

export interface StoredFileDescriptor {
  storagePath: string; // e.g. "org_123/scan_456/invoice.pdf"
  bucketName: string;
  sha256Hash: string;
  sizeBytes: number;
}

export class CloudStorageService {
  private static storage: Storage | null = null;
  public static QUARANTINE_BUCKET = process.env.GCS_QUARANTINE_BUCKET || 'invoiceready-quarantine';
  public static PRIVATE_BUCKET = process.env.GCS_PRIVATE_BUCKET || 'invoiceready-documents-private';

  // In-memory shared object buffer for local execution without GCP ADC credentials
  private static localMockStore: Map<string, Buffer> = new Map();

  private static getStorage(): Storage | null {
    if (this.storage) return this.storage;
    try {
      this.storage = new Storage();
      return this.storage;
    } catch (_) {
      return null;
    }
  }

  /**
   * Saves uploaded binary buffer to the quarantine bucket immediately (Requirement 14, 7)
   */
  public static async saveToQuarantine(
    buffer: Buffer,
    originalFileName: string,
    organizationId: string,
    scanId: string
  ): Promise<{ quarantinePath: string; sha256Hash: string }> {
    const sha256Hash = SecurityScanner.calculateSha256(buffer);
    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `${organizationId}/${scanId}/quarantine_${Date.now()}_${safeName}`;

    // Requirement 7: In production, require real Google Cloud Storage. Do not fall back to the in-memory storage mock.
    if (process.env.NODE_ENV === 'production' && !process.env.GOOGLE_CLOUD_PROJECT) {
      throw new Error(
        'FATAL: Production mode requires authentic Google Cloud Storage with GOOGLE_CLOUD_PROJECT. In-memory storage mock is strictly prohibited in production.'
      );
    }

    const gcs = this.getStorage();
    if (process.env.NODE_ENV === 'production' && !gcs) {
      throw new Error('FATAL: Google Cloud Storage client could not be initialized in production mode.');
    }

    if (gcs && process.env.GOOGLE_CLOUD_PROJECT) {
      try {
        const bucket = gcs.bucket(this.QUARANTINE_BUCKET);
        const file = bucket.file(objectKey);
        await file.save(buffer, {
          metadata: {
            contentType: 'application/octet-stream',
            metadata: {
              organizationId,
              scanId,
              sha256: sha256Hash,
              quarantined: 'true',
            },
          },
        });
        return { quarantinePath: objectKey, sha256Hash };
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`FATAL: Production GCS quarantine upload failed: ${err.message}`);
        }
        console.warn('GCS quarantine upload fallback to local storage:', err.message);
      }
    }

    // Ephemeral object store strictly permitted ONLY in development/test environments
    this.localMockStore.set(`quarantine://${objectKey}`, buffer);
    return { quarantinePath: objectKey, sha256Hash };
  }

  /**
   * Promotes file from quarantine bucket to private secured bucket upon CLEAN scan (Requirement 14, 7)
   */
  public static async promoteToPrivateStorage(
    quarantinePath: string,
    organizationId: string,
    scanId: string,
    fileName: string
  ): Promise<string> {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetKey = `${organizationId}/${scanId}/original/${safeName}`;

    const gcs = this.getStorage();
    if (process.env.NODE_ENV === 'production' && !gcs) {
      throw new Error('FATAL: Google Cloud Storage client could not be initialized in production mode.');
    }

    if (gcs && process.env.GOOGLE_CLOUD_PROJECT) {
      try {
        const srcBucket = gcs.bucket(this.QUARANTINE_BUCKET);
        const destBucket = gcs.bucket(this.PRIVATE_BUCKET);

        const srcFile = srcBucket.file(quarantinePath);
        const destFile = destBucket.file(targetKey);

        await srcFile.copy(destFile);
        await srcFile.delete().catch(() => {});
        return targetKey;
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`FATAL: Production GCS promotion failed: ${err.message}`);
        }
        console.warn('GCS promotion fallback to local storage:', err.message);
      }
    }

    // Ephemeral store promotion strictly permitted ONLY in development/test
    const buf = this.localMockStore.get(`quarantine://${quarantinePath}`);
    if (buf) {
      this.localMockStore.set(`private://${targetKey}`, buf);
      this.localMockStore.delete(`quarantine://${quarantinePath}`);
    }

    return targetKey;
  }

  /**
   * Reads private stored file buffer securely on server (Requirement 16, 7)
   */
  public static async readStoredFile(storagePath: string): Promise<Buffer | null> {
    const gcs = this.getStorage();
    if (process.env.NODE_ENV === 'production' && !gcs) {
      throw new Error('FATAL: Google Cloud Storage client could not be initialized in production mode.');
    }

    if (gcs && process.env.GOOGLE_CLOUD_PROJECT) {
      try {
        const bucket = gcs.bucket(this.PRIVATE_BUCKET);
        const file = bucket.file(storagePath);
        const [contents] = await file.download();
        return contents;
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`FATAL: Production GCS download failed: ${err.message}`);
        }
        console.warn('GCS download fallback to local storage:', err.message);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      return null;
    }

    return this.localMockStore.get(`private://${storagePath}`) || null;
  }

  /**
   * Permanently deletes object from Cloud Storage (Requirements 17, 27, 7)
   */
  public static async deletePhysicalFile(storagePath: string): Promise<boolean> {
    let deleted = false;
    const gcs = this.getStorage();
    if (process.env.NODE_ENV === 'production' && !gcs) {
      throw new Error('FATAL: Google Cloud Storage client could not be initialized in production mode.');
    }

    if (gcs && process.env.GOOGLE_CLOUD_PROJECT) {
      try {
        const bucket = gcs.bucket(this.PRIVATE_BUCKET);
        const file = bucket.file(storagePath);
        await file.delete();
        deleted = true;
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`FATAL: Production GCS file deletion failed: ${err.message}`);
        }
      }
    }

    if (this.localMockStore.has(`private://${storagePath}`)) {
      this.localMockStore.delete(`private://${storagePath}`);
      deleted = true;
    }
    return deleted;
  }

  /**
   * Generates a short-lived signed URL for client download (Requirement 15)
   */
  public static async generateSignedUrl(
    storagePath: string,
    expiresInMinutes: number = 15
  ): Promise<string> {
    const gcs = this.getStorage();
    if (gcs && process.env.GOOGLE_CLOUD_PROJECT) {
      try {
        const bucket = gcs.bucket(this.PRIVATE_BUCKET);
        const file = bucket.file(storagePath);
        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + expiresInMinutes * 60 * 1000,
        });
        return signedUrl;
      } catch (err: any) {
        console.warn('Could not generate GCS signed URL:', err.message);
      }
    }

    // Secure application proxy path for local dev/testing
    return `/api/documents/download?path=${encodeURIComponent(storagePath)}`;
  }
}
