'use client';

import React from 'react';
import { SystemProfile, AccountingSystemChoice } from '../engine/types';
import { ArrowRight, ArrowLeft, ShieldCheck, Info } from 'lucide-react';

interface SystemAssessmentFormProps {
  system: SystemProfile;
  jurisdiction: 'AE' | 'PH';
  onChange: (updated: SystemProfile) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const SystemAssessmentForm: React.FC<SystemAssessmentFormProps> = ({
  system,
  jurisdiction,
  onChange,
  onContinue,
  onBack,
}) => {
  const isUAE = jurisdiction === 'AE';

  const handleChange = (field: keyof SystemProfile, value: any) => {
    onChange({
      ...system,
      [field]: value,
    });
  };

  const systemsList: { id: AccountingSystemChoice; label: string }[] = [
    { id: 'QUICKBOOKS', label: 'QuickBooks (Online / Desktop)' },
    { id: 'XERO', label: 'Xero' },
    { id: 'ODOO', label: 'Odoo ERP' },
    { id: 'EXCEL', label: 'Microsoft Excel / Spreadsheets' },
    { id: 'GOOGLE_SHEETS', label: 'Google Sheets' },
    { id: 'POS', label: 'Point of Sale (POS) Hardware' },
    { id: 'CUSTOM_ERP', label: 'Custom In-House ERP / SAP / Oracle' },
    { id: 'CUSTOM_INVOICING', label: 'Proprietary Billing Software' },
    { id: 'OTHER', label: 'Other Legacy System' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center space-y-3 mb-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Step 3 of 4 · Current System Assessment
        </span>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          How do you currently issue invoices?
        </h2>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          We evaluate the technical gap between your current software stack and mandatory electronic data transmission requirements.
        </p>
      </div>

      {/* Mandatory Trust & Privacy Notice (Screen 04, Section 56) */}
      <div className="mb-6 bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <span className="text-xs text-slate-700">
          <strong>Zero System Access Required:</strong> We do not require credentials, API keys, or direct access to your accounting or ERP software for this readiness assessment.
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Accounting System Choice */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Primary Accounting Software *
          </label>
          <select
            value={system.accounting_system}
            onChange={(e) => handleChange('accounting_system', e.target.value as AccountingSystemChoice)}
            className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {systemsList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Current Document Format Output */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            What format do you currently deliver to customers? *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { id: 'PDF', label: 'PDF via Email' },
              { id: 'PRINTED_PAPER', label: 'Printed Paper Bill' },
              { id: 'EXCEL', label: 'Excel / CSV File' },
              { id: 'XML_UBL', label: 'UBL / XML (Peppol)' },
              { id: 'JSON', label: 'JSON API Payload' },
              { id: 'HYBRID', label: 'Hybrid PDF + Paper' },
            ].map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => handleChange('current_invoice_format', f.id)}
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                  system.current_invoice_format === f.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Technical Capabilities Check */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                Structured Electronic Export Capability
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                Can your system automatically export invoices in standardized XML or JSON without manual data entry?
              </span>
            </div>
            <input
              type="checkbox"
              checked={system.structured_export_capability}
              onChange={(e) => handleChange('structured_export_capability', e.target.checked)}
              className="mt-1 w-5 h-5 rounded text-slate-900 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-100">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                {isUAE
                  ? 'Accredited Service Provider (ASP) Connectivity'
                  : 'Automated BIR EIS API Transmission Middleware'}
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                {isUAE
                  ? 'Have you contracted or configured connection to an official UAE Ministry of Finance ASP partner?'
                  : 'Does your billing system have an active API endpoint connector configured to report transactions to BIR EIS within 3 days?'}
              </span>
            </div>
            <input
              type="checkbox"
              checked={
                isUAE
                  ? system.asp_partner_selected || system.electronic_transmission_capability
                  : system.electronic_transmission_capability
              }
              onChange={(e) => {
                handleChange('electronic_transmission_capability', e.target.checked);
                if (isUAE) handleChange('asp_partner_selected', e.target.checked);
              }}
              className="mt-1 w-5 h-5 rounded text-slate-900 focus:ring-slate-900"
            />
          </div>

          {!isUAE && (
            <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-100">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  BIR Computerized Accounting System (CAS) Permit / Acknowledgement
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Does your company possess an active BIR CAS Acknowledgement Certificate (AC) or Permit to Use (PTU)?
                </span>
              </div>
              <input
                type="checkbox"
                checked={system.cas_permit_active}
                onChange={(e) => handleChange('cas_permit_active', e.target.checked)}
                className="mt-1 w-5 h-5 rounded text-slate-900 focus:ring-slate-900"
              />
            </div>
          )}
        </div>
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
          onClick={onContinue}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm"
        >
          <span>Continue to Document Upload</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
