'use client';

import React, { useState, useRef } from 'react';
import { SAMPLE_INVOICES, SampleInvoicePackage } from '../engine/sampleInvoices';
import {
  UploadCloud,
  FileText,
  Lock,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface InvoiceUploadProps {
  jurisdiction: 'AE' | 'PH';
  onFileSelected: (fileData: {
    file?: File;
    fileName: string;
    fileSize: number;
    mimeType: string;
    rawText?: string;
  }) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const InvoiceUpload: React.FC<InvoiceUploadProps> = ({
  jurisdiction,
  onFileSelected,
  onContinue,
  onBack,
}) => {
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSize, setSelectedFileSize] = useState<number>(0);
  const [previewSnippet, setPreviewSnippet] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter sample templates for current jurisdiction (Optional benchmark library)
  const relevantSamples = SAMPLE_INVOICES.filter(
    (s) => s.jurisdiction === jurisdiction || s.id === 'SEC-PROMPT-INJECTION-INVOICE'
  );

  const handleSelectSample = (sample: SampleInvoicePackage) => {
    const fileName = `${sample.id}.pdf`;
    const blob = new Blob([sample.rawDocumentText], { type: 'application/pdf' });
    const syntheticFile = new File([blob], fileName, { type: 'application/pdf' });

    setSelectedFileName(fileName);
    setSelectedFileSize(blob.size);
    setPreviewSnippet(`Sample Benchmark Selected: ${sample.name}\n(Will be processed via authoritative server pipeline)`);
    onFileSelected({
      file: syntheticFile,
      fileName,
      fileSize: blob.size,
      mimeType: 'application/pdf',
      rawText: sample.rawDocumentText,
    });
  };

  const handleCustomFileUpload = (file: File) => {
    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);
    // Requirement 10: Require actual binary document processing server-side;
    // Do not use browser readAsText() as the production invoice-processing path.
    setPreviewSnippet(
      `Binary document loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB).\nPrepared for secure multipart upload to server quarantine & security inspection.`
    );
    onFileSelected({
      file,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/pdf',
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCustomFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center space-y-3 mb-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Step 4 of 4 · Invoice Document
        </span>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Upload an invoice to assess
        </h2>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          Upload a recent invoice template, or select an authentic regulatory test benchmark from the library below.
        </p>
      </div>

      {/* 1-Click Regulatory Test Benchmarks */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select Authentic {jurisdiction === 'AE' ? 'UAE' : 'Philippines'} Benchmark
          </span>
          <span className="text-xs text-slate-500">1-click test datasets</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {relevantSamples.map((sample) => (
            <button
              type="button"
              key={sample.id}
              onClick={() => handleSelectSample(sample)}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedFileName.includes(sample.id)
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold truncate">{sample.name}</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      selectedFileName.includes(sample.id)
                        ? 'bg-slate-800 text-slate-200'
                        : sample.expectedCompliance === 'READY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {sample.expectedCompliance}
                  </span>
                </div>
                <p
                  className={`text-[11px] line-clamp-2 leading-relaxed ${
                    selectedFileName.includes(sample.id) ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {sample.description}
                </p>
              </div>

              <div
                className={`mt-2 pt-2 border-t text-[10px] flex items-center justify-between ${
                  selectedFileName.includes(sample.id) ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-400'
                }`}
              >
                <span>Format: PDF / JSON</span>
                <span>Click to Load</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-slate-900 bg-slate-100/60'
            : selectedFileName
            ? 'border-emerald-500 bg-emerald-50/20'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.xml"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleCustomFileUpload(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div>
            <span className="text-sm font-bold text-slate-900 block">
              {selectedFileName ? 'Change uploaded invoice' : 'Drag & drop your invoice here, or browse'}
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              Accepted formats: PDF, PNG, JPG, XLSX, CSV · Maximum file size: 15MB
            </span>
          </div>

          {selectedFileName && (
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-100/80 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Selected: {selectedFileName} ({Math.round(selectedFileSize / 1024)} KB)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Document Text Snippet Preview */}
      {previewSnippet && (
        <div className="mt-4 p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider mb-1">
            Document Content Preview:
          </span>
          <pre className="whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed max-h-32">
            {previewSnippet}
          </pre>
        </div>
      )}

      {/* Privacy & Retention Notice (Section 35 & Screen 05) */}
      <div className="mt-6 bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Lock className="w-4 h-4 text-slate-600" />
          <span>Strict Privacy &amp; Data Retention Policy (Section 35)</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Original uploaded files are permanently deleted <strong>24 hours</strong> after processing. Extracted normalized metadata is retained for 30 days for readiness reporting. Document text is processed through Paid Enterprise Gemini APIs and is never used to train public models.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          disabled={!selectedFileName}
          onClick={onContinue}
          className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl transition-all shadow-sm ${
            selectedFileName
              ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>Run Readiness Assessment</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
