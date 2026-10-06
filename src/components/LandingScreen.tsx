import React from 'react';
import {
  Shield,
  FileCheck2,
  Cpu,
  Layers,
  ArrowRight,
  Scale,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface LandingScreenProps {
  onStartAssessment: () => void;
  onExploreJurisdiction: (jur: 'AE' | 'PH') => void;
  onOpenHowItWorks: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onStartAssessment,
  onExploreJurisdiction,
  onOpenHowItWorks,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Hero Section */}
      <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Status Kicker */}
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Versioned Regulatory Rule Packs: UAE 2026.1 & Philippines 2026.1 Active</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 text-balance leading-tight">
            E-Invoicing Readiness for SMEs in UAE & Philippines
          </h1>

          <p className="text-lg text-slate-600 leading-relaxed text-balance">
            Upload your invoice and assess whether your current documents, data, software, and workflows meet statutory structured electronic invoicing mandates.
          </p>

          {/* Primary & Secondary Actions */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onStartAssessment}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <span>Check My Readiness</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenHowItWorks}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-xl transition-all border border-slate-200 shadow-xs"
            >
              <span>How It Works</span>
            </button>
          </div>

          {/* Mandatory Trust Statement (Section 56, Screen 01) */}
          <div className="pt-6 border-t border-slate-200/60 max-w-xl mx-auto">
            <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
              <Scale className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Automated readiness assessment based on identified regulatory sources. Not tax or legal advice.
              </span>
            </p>
          </div>
        </div>

        {/* Core Architectural Principle Banner */}
        <div className="mt-16 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs max-w-4xl mx-auto">
          <div className="text-center pb-6 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Architectural Standard (PRD-002 & PRD-003)
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              "AI interprets. Rules decide. Evidence proves. Reports explain."
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 pt-6 text-left">
            <div>
              <div className="text-xs font-bold text-indigo-600 mb-1">01. AI INTERPRETS</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Gemini extracts raw text without ever making legal decisions or hallucinating missing tax IDs.
              </p>
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-600 mb-1">02. RULES DECIDE</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Deterministic versioned rule packs evaluate statutory compliance against official decrees.
              </p>
            </div>
            <div>
              <div className="text-xs font-bold text-amber-600 mb-1">03. EVIDENCE PROVES</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every passed or failed finding links back to verifiable invoice coordinates and source fields.
              </p>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 mb-1">04. REPORTS EXPLAIN</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Actionable remediation plans with clear owner roles and technical implementation steps.
              </p>
            </div>
          </div>
        </div>

        {/* Supported Jurisdictions Card Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* UAE Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Jurisdiction</span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                  Phase 1 Rollout 2026
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">United Arab Emirates (UAE)</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Evaluating compliance against Cabinet Decision No. 91/2023, Federal Decree-Law No. 8/2017 (VAT), 15-digit TRN standards, and Peppol PINT AE XML transmission models.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Phase 1 threshold assessment (&gt; AED 50M)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Peppol PINT structured electronic data gate</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Accredited Service Provider (ASP) connectivity</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <button
                onClick={() => onExploreJurisdiction('AE')}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Assess UAE Readiness</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Philippines Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Jurisdiction</span>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  TRAIN Law &amp; EOPT Act
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Philippines (BIR)</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Evaluating readiness for the BIR Electronic Invoicing and Receipting System (EIS) under RR 8-2022, TRAIN Section 237-A, and the mandatory transition to Invoices under RA 11976.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Mandatory shift from Official Receipt to Invoice</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Statutory 4-way VAT breakdown gate</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>9/12 digit TIN with branch code validation</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <button
                onClick={() => onExploreJurisdiction('PH')}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Assess Philippines Readiness</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Disclaimer */}
      <footer className="bg-white border-t border-slate-200 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center space-y-3">
          <p className="text-xs text-slate-500 max-w-3xl mx-auto leading-relaxed">
            InvoiceReady is an automated e-invoicing readiness assessment platform. It is not a government tax authority, accredited service provider, legal advisory firm, or compliance certificate guarantee. Regulatory requirements may change. Users should verify applicable obligations with the relevant authority or qualified professional.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
            <span>UAE Ministry of Finance &amp; FTA Hierarchy</span>
            <span>·</span>
            <span>BIR RR 8-2022 &amp; RA 11976 EOPT Guidelines</span>
            <span>·</span>
            <span>Strict Privacy by Design (24h File Retention)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
