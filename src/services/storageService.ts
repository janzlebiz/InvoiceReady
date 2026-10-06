/**
 * InvoiceReady v1.0 - Private Storage Service
 * Conforms to Requirements 8, 10, 13, Sections 34, 35, 44.
 * Manages private quarantined files, promotion to secure staging upon inspection pass,
 * and physical deletion of expired documents.
 */

import fs from 'fs';
import path from 'path';
import { SecurityScanner, SecurityInspectionResult } from './securityScanner';

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
  private static BASE_STORAGE_DIR = process.env.STORAGE_DIR || '/tmp/invoiceready_storage';
  private static QUARANTINE_DIR = path.join(process.env.STORAGE_DIR || '/tmp/invoiceready_storage', 'quarantine');

  public static initializeStorageDirs(): void {
    if (!fs.existsSync(this.BASE_STORAGE_DIR)) {
      fs.mkdirSync(this.BASE_STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(this.QUARANTINE_DIR)) {
      fs.mkdirSync(this.QUARANTINE_DIR, { recursive: true });
    }
  }

  /**
   * Saves uploaded bytes into quarantine first (Requirement 10)
   */
  public static saveToQuarantine(
    buffer: Buffer,
    originalFileName: string,
    organizationId: string,
    scanId: string
  ): { quarantinePath: string; sha256Hash: string } {
    this.initializeStorageDirs();
    const sha256Hash = SecurityScanner.calculateSha256(buffer);
    const quarantineSubdir = path.join(this.QUARANTINE_DIR, organizationId, scanId);
    if (!fs.existsSync(quarantineSubdir)) {
      fs.mkdirSync(quarantineSubdir, { recursive: true });
    }

    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const quarantinePath = path.join(quarantineSubdir, `${Date.now()}_${safeName}`);
    fs.writeFileSync(quarantinePath, buffer);

    return { quarantinePath, sha256Hash };
  }

  /**
   * Promotes file from quarantine to private secured storage upon security validation pass
   */
  public static promoteToPrivateStorage(
    quarantinePath: string,
    organizationId: string,
    scanId: string,
    fileName: string
  ): string {
    const targetDir = path.join(this.BASE_STORAGE_DIR, organizationId, scanId, 'original');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = path.join(targetDir, safeName);

    fs.copyFileSync(quarantinePath, storagePath);
    // Remove from quarantine once promoted
    try {
      fs.unlinkSync(quarantinePath);
    } catch (_) {}

    return storagePath;
  }

  /**
   * Reads private stored file buffer securely (server-side only)
   */
  public static readStoredFile(storagePath: string): Buffer | null {
    try {
      if (fs.existsSync(storagePath)) {
        return fs.readFileSync(storagePath);
      }
    } catch (err) {
      console.error(`Failed to read stored file at ${storagePath}:`, err);
    }
    return null;
  }

  /**
   * Permanently unlinks stored file (Requirement 13 & Section 35)
   */
  public static deletePhysicalFile(storagePath: string): boolean {
    try {
      if (fs.existsSync(storagePath)) {
        fs.unlinkSync(storagePath);
        return true;
      }
    } catch (err) {
      console.error(`Error deleting file at ${storagePath}:`, err);
    }
    return false;
  }
}
