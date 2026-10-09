/**
 * InvoiceReady v1.0 - Production Binary Document & PDF Parser
 * Conforms to RC2.1 Item 4: Real PDF extraction replacing Buffer.toString('utf8')
 *
 * Handles:
 * 1. Binary PDF text stream extraction via pdf-parse
 * 2. Structured XML / UBL / CII invoice text parsing
 * 3. CSV / Plaintext invoice normalization
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export class DocumentParser {
  /**
   * Extracts clean textual content from binary PDF or structured invoice buffers.
   */
  public static async extractDocumentText(
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    if (!buffer || buffer.length === 0) {
      return '';
    }

    const isPdf =
      mimeType === 'application/pdf' ||
      fileName.toLowerCase().endsWith('.pdf') ||
      buffer.subarray(0, 5).toString('ascii') === '%PDF-';

    if (isPdf) {
      try {
        const pdfParser = new PDFParse(new Uint8Array(buffer));
        const result = await pdfParser.getText();
        const text = typeof result === 'string' ? result : (result?.text || '').trim();
        if (text.length > 0) {
          return text;
        }
      } catch (err: any) {
        console.warn(`[DocumentParser] Binary PDF parse warning for ${fileName}:`, err.message);
      }
    }

    // Fallback for XML / CSV / Text formats or non-standard text streams
    return buffer.toString('utf8');
  }

  /**
   * Strict PDF text extraction for authoritative regulatory artifacts (Phase 21P).
   * - Strict binary PDF validation (%PDF- header)
   * - Strict PDFParse execution
   * - Zero fallback to Buffer.toString('utf8')
   * - Fails closed: throws if parsing fails or if text is empty
   */
  public static async parsePdfStrict(buffer: Buffer): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new Error('Strict PDF parsing failed: buffer is empty.');
    }

    if (!buffer.subarray(0, 5).toString('ascii').startsWith('%PDF-')) {
      throw new Error('Strict PDF parsing failed: missing %PDF- header.');
    }

    const pdfParser = new PDFParse(new Uint8Array(buffer));
    const result = await pdfParser.getText();
    const text = typeof result === 'string' ? result : (result?.text || '').trim();

    if (!text || text.length === 0) {
      throw new Error('Strict PDF parsing failed: extracted text stream is empty.');
    }

    return text;
  }
}
