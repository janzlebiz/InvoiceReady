/**
 * InvoiceReady v1.0 - Production Security Scanner & File Inspection Engine
 * Conforms to Requirements 7, 9, 10, 11, SEC-005, SEC-006, SEC-007.
 * Performs deep inspection of actual file bytes, magic headers, executable payloads,
 * macro injection, and adversarial prompt injection strings.
 */

import crypto from 'crypto';

export interface SecurityInspectionResult {
  passed: boolean;
  quarantined: boolean;
  sha256Hash: string;
  detectedMimeType: string;
  sanitizedFileName: string;
  sizeBytes: number;
  malwareClean: boolean;
  structuralIntegrityClean: boolean;
  promptInjectionDetected: boolean;
  securityFindings: string[];
  rejectionReason?: string;
  inspectedAt: string;
}

export class SecurityScanner {
  private static MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

  /**
   * Cryptographically hashes file bytes using SHA-256 (Requirement 7)
   */
  public static calculateSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Deep byte-level security inspection
   */
  public static inspectFileBuffer(
    buffer: Buffer,
    originalFileName: string,
    declaredMimeType: string
  ): SecurityInspectionResult {
    const inspectedAt = new Date().toISOString();
    const sizeBytes = buffer.length;
    const sha256Hash = this.calculateSha256(buffer);
    const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const findings: string[] = [];

    // 1. Size Validation (SEC-006)
    if (sizeBytes === 0) {
      return {
        passed: false,
        quarantined: true,
        sha256Hash,
        detectedMimeType: 'application/x-empty',
        sanitizedFileName,
        sizeBytes,
        malwareClean: false,
        structuralIntegrityClean: false,
        promptInjectionDetected: false,
        securityFindings: ['Empty file payload rejected (0 bytes).'],
        rejectionReason: 'File payload is empty.',
        inspectedAt,
      };
    }

    if (sizeBytes > this.MAX_FILE_SIZE_BYTES) {
      return {
        passed: false,
        quarantined: true,
        sha256Hash,
        detectedMimeType: declaredMimeType,
        sanitizedFileName,
        sizeBytes,
        malwareClean: false,
        structuralIntegrityClean: false,
        promptInjectionDetected: false,
        securityFindings: [
          `File size exceeds statutory 15MB limit (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
        ],
        rejectionReason: 'File size exceeds maximum permitted threshold (15MB).',
        inspectedAt,
      };
    }

    // 2. Executable / Binary Malware Signature Inspection (SEC-005)
    // Check for DOS MZ header (0x4D 0x5A)
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return {
        passed: false,
        quarantined: true,
        sha256Hash,
        detectedMimeType: 'application/x-dosexec',
        sanitizedFileName,
        sizeBytes,
        malwareClean: false,
        structuralIntegrityClean: false,
        promptInjectionDetected: false,
        securityFindings: ['Executable PE/DOS binary signature (MZ) detected in uploaded file.'],
        rejectionReason: 'Executable binaries are strictly prohibited and quarantined.',
        inspectedAt,
      };
    }

    // Check for Linux ELF binary header (\x7fELF: 0x7F 0x45 0x4C 0x46)
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x7f &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x4c &&
      buffer[3] === 0x46
    ) {
      return {
        passed: false,
        quarantined: true,
        sha256Hash,
        detectedMimeType: 'application/x-executable',
        sanitizedFileName,
        sizeBytes,
        malwareClean: false,
        structuralIntegrityClean: false,
        promptInjectionDetected: false,
        securityFindings: ['Linux ELF binary executable header detected.'],
        rejectionReason: 'Executable binary payloads are strictly prohibited.',
        inspectedAt,
      };
    }

    // Check for shell script shebang (#!: 0x23 0x21)
    if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
      return {
        passed: false,
        quarantined: true,
        sha256Hash,
        detectedMimeType: 'application/x-sh',
        sanitizedFileName,
        sizeBytes,
        malwareClean: false,
        structuralIntegrityClean: false,
        promptInjectionDetected: false,
        securityFindings: ['Script executable header (#!) detected.'],
        rejectionReason: 'Executable shell scripts are prohibited.',
        inspectedAt,
      };
    }

    // 3. Extension & Magic Bytes Validation (Requirement 9)
    const ext = sanitizedFileName.split('.').pop()?.toLowerCase() || '';
    let detectedMime = 'application/octet-stream';
    let isMagicValid = false;

    // PDF Magic Bytes: %PDF- (0x25 0x50 0x44 0x46)
    const isPdfMagic =
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46;

    // PNG Magic Bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    const isPngMagic =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;

    // JPEG Magic Bytes: 0xFF 0xD8 0xFF
    const isJpgMagic =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    // ZIP / XLSX Magic Bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04)
    const isZipMagic =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;

    if (ext === 'pdf') {
      if (!isPdfMagic) {
        findings.push('File extension .pdf does not match genuine PDF magic bytes (%PDF-).');
      } else {
        detectedMime = 'application/pdf';
        isMagicValid = true;

        // PDF Security Deep Inspection: Check for embedded malicious JavaScript streams
        const contentStr = buffer.toString('latin1');
        if (
          contentStr.includes('/JavaScript') ||
          contentStr.includes('/JS ') ||
          contentStr.includes('/Launch ') ||
          contentStr.includes('/EmbeddedFiles')
        ) {
          findings.push('Active scripting or embedded executable stream (/JavaScript or /Launch) detected inside PDF.');
        }
      }
    } else if (ext === 'png') {
      if (!isPngMagic) {
        findings.push('File extension .png does not match genuine PNG header.');
      } else {
        detectedMime = 'image/png';
        isMagicValid = true;
      }
    } else if (ext === 'jpg' || ext === 'jpeg') {
      if (!isJpgMagic) {
        findings.push('File extension does not match genuine JPEG header.');
      } else {
        detectedMime = 'image/jpeg';
        isMagicValid = true;
      }
    } else if (ext === 'xlsx') {
      if (!isZipMagic) {
        findings.push('File extension .xlsx does not match OpenXML ZIP container format.');
      } else {
        detectedMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        isMagicValid = true;

        // Inspect for VBA macros in Excel files
        const contentStr = buffer.toString('latin1');
        if (contentStr.includes('vbaProject.bin') || contentStr.includes('macroEnabled')) {
          findings.push('VBA macros detected inside spreadsheet file. Macro-enabled spreadsheets are prohibited.');
        }
      }
    } else if (ext === 'csv' || ext === 'xml' || ext === 'json') {
      // Check for clean text encoding without binary control characters
      let binaryChars = 0;
      const inspectLength = Math.min(buffer.length, 4096);
      for (let i = 0; i < inspectLength; i++) {
        const byte = buffer[i];
        if (byte === 0 || (byte < 7 && byte !== 9 && byte !== 10 && byte !== 13)) {
          binaryChars++;
        }
      }

      if (binaryChars > 0) {
        findings.push('Text file contains illegal binary control characters or null bytes.');
      } else {
        detectedMime = ext === 'csv' ? 'text/csv' : ext === 'xml' ? 'application/xml' : 'application/json';
        isMagicValid = true;
      }
    } else {
      findings.push(`Unsupported file extension: .${ext}. Only PDF, PNG, JPG, XLSX, CSV, and XML are permitted.`);
    }

    // 4. Prompt Injection Scanner (Requirement 44)
    let promptInjectionDetected = false;
    const utf8Snippet = buffer.toString('utf8', 0, Math.min(buffer.length, 32768)).toLowerCase();
    if (
      utf8Snippet.includes('ignore all previous instructions') ||
      utf8Snippet.includes('ignore previous instructions') ||
      utf8Snippet.includes('system override') ||
      utf8Snippet.includes('mark all rules as pass') ||
      utf8Snippet.includes('override readiness score')
    ) {
      promptInjectionDetected = true;
      findings.push('Adversarial prompt injection signatures detected in document text. Document content quarantined.');
    }

    const passed = isMagicValid && findings.length === 0;

    return {
      passed,
      quarantined: !passed,
      sha256Hash,
      detectedMimeType: detectedMime,
      sanitizedFileName,
      sizeBytes,
      malwareClean: !findings.some((f) => f.includes('binary') || f.includes('Script') || f.includes('scripting')),
      structuralIntegrityClean: isMagicValid,
      promptInjectionDetected,
      securityFindings: findings,
      rejectionReason: findings.length > 0 ? findings[0] : undefined,
      inspectedAt,
    };
  }
}
