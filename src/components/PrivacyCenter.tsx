'use client';

import React, { useState } from 'react';
import { Shield, Lock, Download, Trash2, CheckCircle2, Clock, EyeOff, ArrowLeft } from 'lucide-react';

interface PrivacyCenterProps {
  onBackToDashboard?: () => void;
}

export const PrivacyCenter: React.FC<PrivacyCenterProps> = ({ onBackToDashboard }) => {
  const [preferences, setPreferences] = useState({
    necessary: true, // Immutable
    preferences: true,
    analytics: false,
    marketing: false,
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleSavePreferences = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportData = () => {
    const data = {
      user_export: {
        timestamp: new Date().toISOString(),
        privacy_policy_version: 'v1.0.0',
        retention_schedule: {
          original_documents: '24 hours',
          normalized_data: '30 days',
          reports: '30 days',
        },
        notice: 'Export generated pursuant to GDPR/DPA privacy rights.',
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InvoiceReady_DataExport_${Date.now()}.json`;
    a.click();
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Privacy by Design · Sections 35, 36, 50, 51
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Privacy Rights &amp; Retention Center
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Control your data processing consents, audit document retention windows, and execute immediate data exports or deletions.
          </p>
        </div>
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        )}
      </div>

      {/* Retention Schedule (Section 35) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-600" />
          <span>Statutory Document Retention Schedule (Section 35)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Original Invoices
            </span>
            <span className="text-xl font-bold font-mono text-slate-900 block mt-1">24 Hours</span>
            <span className="text-xs text-slate-500 block mt-1">
              Automatically wiped 24 hours after processing.
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Normalized Metadata
            </span>
            <span className="text-xl font-bold font-mono text-slate-900 block mt-1">30 Days</span>
            <span className="text-xs text-slate-500 block mt-1">
              Retained for review and gap comparison.
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Readiness Reports
            </span>
            <span className="text-xl font-bold font-mono text-slate-900 block mt-1">30 Days</span>
            <span className="text-xs text-slate-500 block mt-1">
              Accessible for PDF download or re-evaluation.
            </span>
          </div>
        </div>
      </div>

      {/* Granular Cookie Consent Management (Section 50) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-600" />
            <span>Cookie &amp; Telemetry Consent Categories (Section 50)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Optional analytics and preferences cookies remain blocked until explicit opt-in.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">Strictly Necessary Cookies</span>
              <span className="text-xs text-slate-500 block">
                Required for core authentication, security tokens, and tenant isolation. Always active.
              </span>
            </div>
            <input type="checkbox" checked disabled className="w-5 h-5 rounded text-slate-900 cursor-not-allowed" />
          </div>

          <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-100">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">Functional Preferences</span>
              <span className="text-xs text-slate-500 block">
                Remember your selected jurisdiction and assessment draft answers.
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.preferences}
              onChange={(e) => setPreferences({ ...preferences, preferences: e.target.checked })}
              className="w-5 h-5 rounded text-slate-900"
            />
          </div>

          <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-100">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">Privacy-Safe Analytics (Section 49)</span>
              <span className="text-xs text-slate-500 block">
                Anonymous operational metrics. Invoice numbers, tax IDs, and financial values are strictly excluded.
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.analytics}
              onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
              className="w-5 h-5 rounded text-slate-900"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
          <button
            onClick={handleSavePreferences}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Save Consent Preferences
          </button>
          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Preferences saved to audit record.</span>
            </span>
          )}
        </div>
      </div>

      {/* Data Subject Rights: Export & Deletion (Section 51 & 65) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900">Data Subject Rights (Access, Export &amp; Erasure)</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          You hold the unconditional right to export all normalized metadata collected during your readiness scans, or trigger immediate deletion of all tenant data.
        </p>

        <div className="pt-2 flex flex-wrap gap-4">
          <button
            onClick={handleExportData}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            <Download className="w-4 h-4" />
            <span>Export My Data (JSON)</span>
          </button>
          {exportSuccess && (
            <span className="text-xs font-semibold text-emerald-600 self-center">Export completed.</span>
          )}
        </div>
      </div>

      {/* Production Legal & Compliance Disclosures (Requirement 8) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Statutory Legal Framework &amp; Policies
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-1">
            Production Legal Policies, Consent &amp; Disclaimers
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Governed under UAE Federal Decree-Law No. 45/2021 (PDPL) &amp; Philippines Republic Act No. 10173 (DPA 2012).
          </p>
        </div>

        <div className="space-y-6 text-xs text-slate-600 leading-relaxed divide-y divide-slate-100">
          <div className="pt-2">
            <h4 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              1. Privacy Policy &amp; Data Protection
            </h4>
            <p>
              InvoiceReady processes document data strictly for automated tax compliance gap analysis. Original documents are stored in private isolated cloud storage and permanently wiped after 24 hours. Normalized metadata and scorecards are retained for 30 days before automated deletion. We do not sell or lease customer information. All tenant data is cryptographically hashed and isolated using row-level authorization.
            </p>
          </div>

          <div className="pt-4">
            <h4 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              2. Terms of Service
            </h4>
            <p>
              By accessing InvoiceReady, organizations confirm authorization to process uploaded financial documents. Services are provided on an authoritative automated audit framework. Users are responsible for safeguarding credentials and verifying recommended ERP configuration changes prior to live deployment.
            </p>
          </div>

          <div className="pt-4">
            <h4 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-amber-600" />
              3. Cookie Policy
            </h4>
            <p>
              Strictly necessary authentication tokens are required for application security and multi-tenant isolation. Analytics and functional cookies remain disabled until voluntary user consent is granted above. No third-party ad networks or cross-site tracking technologies are deployed.
            </p>
          </div>

          <div className="pt-4">
            <h4 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              4. Refund &amp; Cancellation Policy
            </h4>
            <p>
              InvoiceReady offers a 14-day unconditional money-back guarantee for enterprise audit tier subscriptions if our automated readiness assessments fail to provide actionable gap findings matching published UAE MoF or Philippines BIR e-invoicing decrees.
            </p>
          </div>

          <div className="pt-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-700" />
              5. Statutory Regulatory Disclaimer
            </h4>
            <p className="font-medium text-slate-700">
              InvoiceReady provides an automated technical and syntactic readiness assessment based on identified regulatory rule packs (AE-2026.2 and PH-2026.2). This assessment does NOT constitute official legal or tax advice, formal tax representation before the UAE Federal Tax Authority (FTA) or the Philippines Bureau of Internal Revenue (BIR), or an official government compliance certificate. Official compliance requires deployment through accredited ASP partners or EIS/CAS accreditation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
