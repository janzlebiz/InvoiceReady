'use client';

import React, { useState } from 'react';
import { ExtractionResult, CanonicalInvoice, ExtractedFieldEvidence } from '../engine/types';
import { CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Edit3, ShieldAlert } from 'lucide-react';

interface ExtractionReviewProps {
  extraction: ExtractionResult;
  onConfirmExtraction: (updatedInvoice: CanonicalInvoice, updatedEvidence: Record<string, ExtractedFieldEvidence>) => void;
  onBack: () => void;
}

export const ExtractionReview: React.FC<ExtractionReviewProps> = ({
  extraction,
  onConfirmExtraction,
  onBack,
}) => {
  const [invoice, setInvoice] = useState<CanonicalInvoice>(extraction.canonical_invoice);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, ExtractedFieldEvidence>>(extraction.evidence_map);

  const handleFieldChange = (fieldPath: string, newValue: any) => {
    // 1. Update invoice
    const copy = JSON.parse(JSON.stringify(invoice));
    if (fieldPath === 'seller.tax_id') copy.seller.tax_id = newValue;
    if (fieldPath === 'buyer.tax_id') copy.buyer.tax_id = newValue;
    if (fieldPath === 'seller.legal_name') copy.seller.legal_name = newValue;
    if (fieldPath === 'buyer.legal_name') copy.buyer.legal_name = newValue;
    if (fieldPath === 'identifiers.invoice_number') copy.identifiers.invoice_number = newValue;
    if (fieldPath === 'totals.tax_total') copy.totals.tax_total = parseFloat(newValue) || null;
    if (fieldPath === 'totals.grand_total') copy.totals.grand_total = parseFloat(newValue) || null;
    setInvoice(copy);

    // 2. Record as user-confirmed evidence (PRD-003)
    const updatedMap = { ...evidenceMap };
    updatedMap[fieldPath] = {
      field: fieldPath,
      original_value: evidenceMap[fieldPath]?.original_value ?? newValue,
      normalized_value: newValue,
      confidence: 1.0,
      confidence_level: 'HIGH',
      source_document: extraction.document_id,
      page: 1,
      extraction_method: 'USER_CONFIRMED',
      user_modified: true,
    };
    setEvidenceMap(updatedMap);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center space-y-3 mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Screen 07 · Review Extracted Invoice Data
        </span>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Review &amp; Verify Extracted Evidence
        </h2>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Verify optical extraction results before final deterministic rule scoring. Any corrections you make are recorded as user-confirmed evidence with full audit traceability.
        </p>
      </div>

      {extraction.prompt_injection_flagged && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 space-y-1">
            <strong>Adversarial Prompt Injection Neutralized:</strong> Document contained instructions attempting to bypass compliance checks. These instructions were quarantined and ignored by the rules engine.
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Key Statutory Fields &amp; Confidence Level
          </h3>
          <span className="text-xs text-slate-500">
            Extraction Time: {extraction.extraction_duration_ms}ms · Model: Gemini 3.8 Flash
          </span>
        </div>

        {/* Form Fields for Review */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Invoice Number */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Invoice Number / Identifier</label>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                High Confidence (99%)
              </span>
            </div>
            <input
              type="text"
              value={invoice.identifiers.invoice_number || ''}
              onChange={(e) => handleFieldChange('identifiers.invoice_number', e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Document Type */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Document Type Heading</label>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Verified
              </span>
            </div>
            <input
              type="text"
              disabled
              value={invoice.metadata.document_type}
              className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-600"
            />
          </div>

          {/* Seller Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Seller Legal Name</label>
            </div>
            <input
              type="text"
              value={invoice.seller.legal_name || ''}
              onChange={(e) => handleFieldChange('seller.legal_name', e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Seller Tax ID (TRN / TIN) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Seller Tax ID (TRN / TIN) *
              </label>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  invoice.seller.tax_id
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-rose-700 bg-rose-50'
                }`}
              >
                {invoice.seller.tax_id ? 'Detected' : 'Missing (Null)'}
              </span>
            </div>
            <input
              type="text"
              placeholder="e.g. 100456789012345 or 004-987-654-00000"
              value={invoice.seller.tax_id || ''}
              onChange={(e) => handleFieldChange('seller.tax_id', e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Buyer Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Buyer Legal Name</label>
            </div>
            <input
              type="text"
              value={invoice.buyer.legal_name || ''}
              onChange={(e) => handleFieldChange('buyer.legal_name', e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Buyer Tax ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Buyer Tax ID (TRN / TIN)</label>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  invoice.buyer.tax_id
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-amber-700 bg-amber-50'
                }`}
              >
                {invoice.buyer.tax_id ? 'Detected' : 'Not Detected'}
              </span>
            </div>
            <input
              type="text"
              placeholder="e.g. 100987654321098 or 231-555-888-00000"
              value={invoice.buyer.tax_id || ''}
              onChange={(e) => handleFieldChange('buyer.tax_id', e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* VAT Total */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">VAT / Tax Total Amount</label>
            </div>
            <input
              type="number"
              step="0.01"
              value={invoice.totals.tax_total ?? ''}
              onChange={(e) => handleFieldChange('totals.tax_total', e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Grand Total */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Grand Total Payable</label>
            </div>
            <input
              type="number"
              step="0.01"
              value={invoice.totals.grand_total ?? ''}
              onChange={(e) => handleFieldChange('totals.grand_total', e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="pt-4 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-3">
            Itemized Lines ({invoice.lines.length} items detected)
          </span>
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Tax Rate</th>
                  <th className="p-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lines.map((line) => (
                  <tr key={line.line_number} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono text-slate-400">{line.line_number}</td>
                    <td className="p-3 font-medium text-slate-800">{line.description}</td>
                    <td className="p-3 text-right font-mono tabular-nums">{line.quantity ?? '-'}</td>
                    <td className="p-3 text-right font-mono tabular-nums">
                      {line.unit_price ? line.unit_price.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">
                      {line.tax_rate !== null ? `${(line.tax_rate * 100).toFixed(0)}%` : 'N/A'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold tabular-nums">
                      {line.line_total ? line.line_total.toFixed(2) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Upload Another File</span>
        </button>

        <button
          type="button"
          onClick={() => onConfirmExtraction(invoice, evidenceMap)}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm"
        >
          <span>Calculate Readiness Scorecard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
