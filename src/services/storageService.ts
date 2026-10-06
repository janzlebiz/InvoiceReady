/**
 * InvoiceReady v1.0 - Document Storage, Retention & Security Inspection Service
 * Conforms to TSD-001, Sections 34, 35, 43, 44.
 */

export interface DocumentValidationResult {
  valid: boolean;
  sanitizedFileName: string;
  detectedMime: string;
  sizeBytes: number;
  sha256Hash: string;
  error?: string;
}

export class StorageService {
  private static MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit

  private static ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
    'text/csv',
    'application/xml',
    'text/xml',
  ];

  public static validateFile(
    fileName: string,
    mimeType: string,
    sizeBytes: number,
    bufferSnippet?: Uint8Array
  ): DocumentValidationResult {
    // 1. Sanitize file name
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    // 2. Size limit
    if (sizeBytes > this.MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        sanitizedFileName,
        detectedMime: mimeType,
        sizeBytes,
        sha256Hash: '',
        error: `File size exceeds the 15MB maximum allowed limit (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB).`,
      };
    }

    // 3. Extension inspection
    const ext = sanitizedFileName.split('.').pop()?.toLowerCase();
    const allowedExts = ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'csv', 'xml'];
    if (!ext || !allowedExts.includes(ext)) {
      return {
        valid: false,
        sanitizedFileName,
        detectedMime: mimeType,
        sizeBytes,
        sha256Hash: '',
        error: `Unsupported file extension (.${ext}). Supported formats: PDF, PNG, JPG, XLSX, CSV.`,
      };
    }

    // 4. Magic bytes inspection
    let detectedMime = mimeType;
    if (bufferSnippet && bufferSnippet.length >= 4) {
      const isPdf =
        bufferSnippet[0] === 0x25 &&
        bufferSnippet[1] === 0x50 &&
        bufferSnippet[2] === 0x44 &&
        bufferSnippet[3] === 0x46; // %PDF
      const isPng =
        bufferSnippet[0] === 0x89 &&
        bufferSnippet[1] === 0x50 &&
        bufferSnippet[2] === 0x4e &&
        bufferSnippet[3] === 0x47; // .PNG
      const isJpg = bufferSnippet[0] === 0xff && bufferSnippet[1] === 0xd8;

      if (ext === 'pdf' && !isPdf) {
        return {
          valid: false,
          sanitizedFileName,
          detectedMime: 'corrupted/unknown',
          sizeBytes,
          sha256Hash: '',
          error: 'File header does not match genuine PDF magic bytes (%PDF). File rejected.',
        };
      }
      if (isPdf) detectedMime = 'application/pdf';
      if (isPng) detectedMime = 'image/png';
      if (isJpg) detectedMime = 'image/jpeg';
    }

    // Compute mock sha256 hash for audit tracking
    const pseudoHash = `sha256:${Math.random().toString(36).substring(2, 15)}${Date.now().toString(36)}`;

    return {
      valid: true,
      sanitizedFileName,
      detectedMime,
      sizeBytes,
      sha256Hash: pseudoHash,
    };
  }

  public static getRetentionPolicy(): {
    originalDocumentsHours: number;
    extractedDataDays: number;
    reportsDays: number;
    auditLogsDays: number;
  } {
    return {
      originalDocumentsHours: 24, // Section 35
      extractedDataDays: 30,
      reportsDays: 30,
      auditLogsDays: 365,
    };
  }
}
