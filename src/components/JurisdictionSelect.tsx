'use client';

import React from 'react';
import { JurisdictionCode } from '../engine/types';
import { ArrowRight, Check, Building2, MapPin } from 'lucide-react';

interface JurisdictionSelectProps {
  selectedJurisdiction: JurisdictionCode;
  onSelect: (jur: JurisdictionCode) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const JurisdictionSelect: React.FC<JurisdictionSelectProps> = ({
  selectedJurisdiction,
  onSelect,
  onContinue,
  onBack,
}) => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center space-y-3 mb-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Step 1 of 4 · Jurisdiction Selection
        </span>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Where is your business registered?
        </h2>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          E-invoicing regulatory rule packs, statutory tax identification formats, and transmission gates depend strictly on your country of registration.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* UAE Option */}
        <button
          type="button"
          onClick={() => onSelect('AE')}
          className={`relative p-6 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
            selectedJurisdiction === 'AE'
              ? 'border-slate-900 bg-white shadow-md ring-2 ring-slate-900/10'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          {selectedJurisdiction === 'AE' && (
            <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
          )}

          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-900">
              🇦🇪
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">United Arab Emirates</h3>
              <p className="text-xs text-slate-500 mt-1">
                UAE Ministry of Finance &amp; Federal Tax Authority (FTA)
              </p>
            </div>

            <div className="space-y-2 pt-2 text-xs text-slate-600 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Governing Decree:</span>
                <span className="font-semibold text-slate-900">Cabinet Decision No. 91/2023</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Data Standard:</span>
                <span className="font-semibold text-slate-900">Peppol PINT AE XML / UBL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tax Identifier:</span>
                <span className="font-semibold text-slate-900">15-Digit TRN (100...)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Phase 1 Rollout:</span>
                <span className="font-semibold text-emerald-600">July 2026 (&gt; AED 50M)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <span>Select UAE Rule Pack AE-2026.1</span>
          </div>
        </button>

        {/* Philippines Option */}
        <button
          type="button"
          onClick={() => onSelect('PH')}
          className={`relative p-6 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
            selectedJurisdiction === 'PH'
              ? 'border-slate-900 bg-white shadow-md ring-2 ring-slate-900/10'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          {selectedJurisdiction === 'PH' && (
            <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
          )}

          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-900">
              🇵🇭
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Philippines</h3>
              <p className="text-xs text-slate-500 mt-1">
                Bureau of Internal Revenue (BIR)
              </p>
            </div>

            <div className="space-y-2 pt-2 text-xs text-slate-600 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Governing Regulation:</span>
                <span className="font-semibold text-slate-900">BIR RR 8-2022 &amp; TRAIN 237</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">New Mandate:</span>
                <span className="font-semibold text-slate-900">EOPT Act (RA 11976 / RR 7-2024)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tax Identifier:</span>
                <span className="font-semibold text-slate-900">9/12 Digit TIN + Branch</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Transmission Window:</span>
                <span className="font-semibold text-indigo-600">3 Days to BIR EIS</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <span>Select Philippines Pack PH-2026.1</span>
          </div>
        </button>
      </div>

      <div className="mt-10 flex items-center justify-between pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm"
        >
          <span>Continue to Business Profile</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
