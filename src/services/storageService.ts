/**
 * InvoiceReady v1.0 - Private Storage Service
 * Conforms to Requirements 8, 10, 13-18, Sections 34, 35, 44.
 * Delegates to CloudStorageService for private GCS bucket operations.
 */

import { CloudStorageService } from './cloudStorageService';

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

  /**
   * Saves uploaded bytes into quarantine bucket (Requirement 14)
   */
  public static async saveToQuarantine(
    buffer: Buffer,
    originalFileName: string,
    organizationId: string,
    scanId: string
  ): Promise<{ quarantinePath: string; sha256Hash: string }> {
    return CloudStorageService.saveToQuarantine(buffer, originalFileName, organizationId, scanId);
  }

  /**
   * Promotes file from quarantine to private secured bucket (Requirement 14)
   */
  public static async promoteToPrivateStorage(
    quarantinePath: string,
    organizationId: string,
    scanId: string,
    fileName: string
  ): Promise<string> {
    return CloudStorageService.promoteToPrivateStorage(quarantinePath, organizationId, scanId, fileName);
  }

  /**
   * Reads private stored file buffer securely on server (Requirement 16)
   */
  public static async readStoredFile(storagePath: string): Promise<Buffer | null> {
    return CloudStorageService.readStoredFile(storagePath);
  }

  /**
   * Permanently deletes physical file object (Requirements 17 & 27)
   */
  public static async deletePhysicalFile(storagePath: string): Promise<boolean> {
    return CloudStorageService.deletePhysicalFile(storagePath);
  }

  /**
   * Generates a signed URL for client download
   */
  public static async generateSignedUrl(storagePath: string, expiresInMinutes?: number): Promise<string> {
    return CloudStorageService.generateSignedUrl(storagePath, expiresInMinutes);
  }
}
