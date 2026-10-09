'use client';

import React from 'react';
import { BusinessProfile } from '../engine/types';
import { ArrowRight, ArrowLeft, Building2, HelpCircle } from 'lucide-react';

interface BusinessProfileFormProps {
  profile: BusinessProfile;
  onChange: (updated: BusinessProfile) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const BusinessProfileForm: React.FC<BusinessProfileFormProps> = ({
  profile,
  onChange,
  onContinue,
  onBack,
}) => {
  const isUAE = profile.country === 'AE';

  const handleTextChange = (field: keyof BusinessProfile, value: any) => {
    onChange({
      ...profile,
      [field]: value,
      updated_at: new Date().toISOString(),
    });
  };

  const handleTransactionTypeToggle = (type: 'B2B' | 'B2G' | 'B2C' | 'EXPORT') => {
    const current = [...profile.transaction_types];
    const index = current.indexOf(type);
    if (index >= 0) {
      if (current.length > 1) {
        current.splice(index, 1);
      }
    } else {
      current.push(type);
    }
    handleTextChange('transaction_types', current);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center space-y-3 mb-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Step 2 of 4 · Business Profile
        </span>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Tell us about your business entity
        </h2>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          We collect only the regulatory classification fields required to determine which e-invoicing rules and phase deadlines apply to you.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Business Legal Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Registered Legal Name *
          </label>
          <input
            type="text"
            value={profile.business_name}
            onChange={(e) => handleTextChange('business_name', e.target.value)}
            placeholder={isUAE ? 'e.g. Al-Noor Trading LLC' : 'e.g. Manila Systems Solutions Inc.'}
            className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            required
          />
        </div>

        {/* Tax Identifier (TRN / TIN) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              {isUAE ? '15-Digit Tax Registration Number (TRN) *' : 'BIR 9/12-Digit TIN with Branch Code *'}
            </label>
            <input
              type="text"
              value={profile.tax_identifier}
              onChange={(e) => handleTextChange('tax_identifier', e.target.value)}
              placeholder={isUAE ? '100456789012345' : '004-987-654-00000'}
              className="w-full px-4 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              required
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              {isUAE
                ? 'Standard 15 numeric digits starting with 100.'
                : 'Include 3 to 5 digit branch suffix (e.g. -000 for Head Office).'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              VAT Registration Status *
            </label>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="vat_registered"
                  checked={profile.vat_registered}
                  onChange={() => handleTextChange('vat_registered', true)}
                  className="w-4 h-4 text-slate-900 focus:ring-slate-900"
                />
                <span>VAT Registered</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="vat_registered"
                  checked={!profile.vat_registered}
                  onChange={() => handleTextChange('vat_registered', false)}
                  className="w-4 h-4 text-slate-900 focus:ring-slate-900"
                />
                <span>Non-VAT / Exempt</span>
              </label>
            </div>
          </div>
        </div>

        {/* Revenue Band / Turnover (Crucial for UAE Phase 1 vs 2 and PH Large Taxpayers) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Annual Taxable Turnover / Revenue Band *
          </label>
          <select
            value={profile.revenue_band}
            onChange={(e) => handleTextChange('revenue_band', e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {isUAE ? (
              <>
                <option value="ABOVE_50M_AED">Exceeds AED 50,000,000 (Mandatory Phase 1 - July 2026)</option>
                <option value="BELOW_50M_AED">Below AED 50,000,000 (Upcoming Phase 2 - 2027)</option>
              </>
            ) : (
              <>
                <option value="ABOVE_1B_PHP">Large Taxpayer (LTS) - Gross Sales &gt; PHP 1 Billion (Mandatory EIS)</option>
                <option value="ABOVE_100M_PHP">Medium Enterprise - PHP 100M to PHP 1B</option>
                <option value="ABOVE_3M_PHP">Standard VAT Taxpayer - Above PHP 3M threshold</option>
                <option value="MICRO_BELOW_3M_PHP">Micro / Non-VAT Taxpayer - Below PHP 3M</option>
              </>
            )}
          </select>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {isUAE
              ? 'Cabinet Decision No. 91/2023 mandates Phase 1 for businesses exceeding AED 50M.'
              : 'BIR RR 8-2022 mandates EIS for Large Taxpayers, Exporters, and E-Commerce.'}
          </span>
        </div>

        {/* Philippines Specific: Covered Taxpayer Category */}
        {!isUAE && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              BIR Taxpayer Classification Category
            </label>
            <select
              value={profile.taxpayer_category || 'SME_STANDARD'}
              onChange={(e) => handleTextChange('taxpayer_category', e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="SME_STANDARD">Standard SME Merchant</option>
              <option value="LTS">Large Taxpayers Service (LTS)</option>
              <option value="EXPORTER">Registered Exporter of Goods/Services</option>
              <option value="ECOMMERCE">E-Commerce Merchant / Online Marketplace Seller</option>
              <option value="CAS_USER">Registered Computerized Accounting System (CAS) User</option>
              <option value="MICRO_NON_VAT">Micro / Non-VAT</option>
            </select>
          </div>
        )}

        {/* Transaction Types */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Transaction Types Conducted *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {[
              { id: 'B2B', label: 'B2B (Business to Business)' },
              { id: 'B2G', label: 'B2G (Business to Government)' },
              { id: 'B2C', label: 'B2C (Retail / Consumers)' },
              { id: 'EXPORT', label: 'Cross-Border Exports' },
            ].map((t) => {
              const active = profile.transaction_types.includes(t.id as any);
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => handleTransactionTypeToggle(t.id as any)}
                  className={`p-3 rounded-xl border text-xs font-semibold transition-all text-left ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
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
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm"
        >
          <span>Continue to System Assessment</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
