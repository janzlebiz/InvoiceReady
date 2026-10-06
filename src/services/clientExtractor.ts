/**
 * InvoiceReady v1.0 - Client Extraction Gateway
 * Performs extraction by delegating to server-side proxy POST /api/extract.
 * Free of Node.js dependencies and server-only SDKs (@google/genai) in the browser bundle.
 */

import { ExtractionResult, CanonicalInvoice, ExtractedFieldEvidence } from '../engine/types';

export class ClientExtractor {
  public static async extractInvoice(
    documentName: string,
    rawText: string,
    mimeType: string,
    scanId: string
  ): Promise<ExtractionResult> {
    try {
      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: documentName,
          rawText,
          mimeType,
          scanId,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        return data as ExtractionResult;
      }

      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Server extraction returned HTTP ${resp.status}`);
    } catch (err: any) {
      console.error('Server extraction failure:', err);
      // Requirement 1: Zero fabricated heuristic fallback. Extraction failure must return FAILED or REVIEW_REQUIRED.
      return {
        scan_id: scanId,
        document_id: `doc-${scanId}`,
        raw_text: rawText,
        canonical_invoice: this.createEmptyCanonical(scanId),
        evidence_map: {},
        uncertain_fields: ['seller.tax_id', 'identifiers.invoice_number', 'totals.grand_total'],
        extraction_duration_ms: 0,
        prompt_injection_flagged: false,
        status: 'FAILED',
        error_message: err.message || 'Server extraction service failed. Zero synthetic fallback permitted.',
      };
    }
  }

  private static createEmptyCanonical(scanId: string): CanonicalInvoice {
    return {
      invoice_id: `INV-${scanId}`,
      source_document_id: `doc-${scanId}`,
      metadata: {
        document_type: 'TAX_INVOICE',
        format: 'PDF_NATIVE',
        structured_export_available: false,
        page_count: 1,
        is_converted_official_receipt: false,
        conversion_stamp_text: null,
      },
      identifiers: { invoice_number: null, serial_number: null, cas_accreditation_number: null },
      invoice_dates: { issue_date: null, supply_date: null, due_date: null },
      currency: { invoice_currency: 'AED', tax_currency: 'AED', exchange_rate: 1.0 },
      seller: { legal_name: null, tax_id: null, branch_code: null, address: { street: null, city: null, country: 'AE' } },
      buyer: { legal_name: null, tax_id: null, branch_code: null, address: { street: null, city: null, country: 'AE' } },
      lines: [],
      taxes: { tax_total: null, subtotals: [] },
      totals: {
        subtotal: null,
        discount_total: 0,
        charge_total: 0,
        tax_total: null,
        grand_total: null,
        amount_due: null,
        vatable_sales: null,
        vat_exempt_sales: null,
        zero_rated_sales: null,
      },
    };
  }
}
