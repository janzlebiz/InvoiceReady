import React from 'react';
import { ScanSession, Scorecard } from '../engine/types';
import {
  Printer,
  Trash2,
  RotateCcw,
  Scale,
  Calendar,
  ShieldCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface ReportScreenProps {
  scan: ScanSession;
  scorecard: Scorecard;
  onDeleteScan: () => void;
  onStartNewScan: () => void;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  scan,
  scorecard,
  onDeleteScan,
  onStartNewScan,
}) => {
  const isUAE = scan.jurisdiction === 'AE';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Action Toolbar (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 print:hidden">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Official Assessment Output
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Readiness Report &amp; Audit Certificate
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onDeleteScan}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
            title="Permanently delete scan files and data immediately"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Scan</span>
          </button>

          <button
            onClick={onStartNewScan}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Start Another Scan</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* The Printable Report Document Container */}
      <div className="bg-white border border-slate-300 rounded-2xl p-8 sm:p-12 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Report Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base mb-3">
              IR
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              E-Invoicing Regulatory Readiness Assessment
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Authorized Automated Audit Report · InvoiceReady Baseline v1.0
            </p>
          </div>

          <div className="text-left sm:text-right font-mono text-xs text-slate-600 space-y-1">
            <div>
              <span className="text-slate-400">Scan ID: </span>
              <strong className="text-slate-900">{scan.scan_id}</strong>
            </div>
            <div>
              <span className="text-slate-400">Rule Pack: </span>
              <strong className="text-slate-900">{scan.rule_pack_version}</strong>
            </div>
            <div>
              <span className="text-slate-400">Timestamp: </span>
              <span>{new Date(scan.completed_at || scan.uploaded_at).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 1. Executive Summary & Scorecard */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Assessed Business
            </span>
            <span className="text-base font-bold text-slate-900 block mt-1">
              {scan.business_profile.business_name}
            </span>
            <span className="text-xs font-mono text-slate-500 block mt-0.5">
              Tax ID: {scan.business_profile.tax_identifier}
            </span>
            <span className="text-xs text-slate-500 block">
              Jurisdiction: {isUAE ? 'United Arab Emirates' : 'Philippines'}
            </span>
          </div>

          <div className="border-y sm:border-y-0 sm:border-x border-slate-200 py-4 sm:py-0 sm:px-6">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Readiness Score
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-4xl font-extrabold font-mono text-slate-900 tabular-nums">
                {scorecard.overall_score}
              </span>
              <span className="text-sm font-bold text-slate-400 font-mono">/ 100</span>
            </div>
            <span className="inline-block text-xs font-bold text-slate-800 mt-1">
              Classification: {scorecard.classification.replace(/_/g, ' ')}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Requirements Breakdown
            </span>
            <div className="text-xs text-slate-700 space-y-1 mt-1">
              <div>Applicable Rules: <strong>{scorecard.rules_summary.applicable}</strong></div>
              <div>Passed: <strong className="text-emerald-700">{scorecard.rules_summary.passed}</strong></div>
              <div>Failed / Partial: <strong className="text-rose-700">{scorecard.rules_summary.failed + scorecard.rules_summary.partial}</strong></div>
              <div>Critical Gates Triggered: <strong>{scorecard.critical_gate_triggered ? 'YES' : 'NONE'}</strong></div>
            </div>
          </div>
        </div>

        {/* 2. Applicability Determination & Regulatory Timeline */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            1. Applicability Determination &amp; Regulatory Mandate Timeline
          </h3>
          <p className="text-xs text-slate-700 leading-relaxed">
            {isUAE
              ? `Based on annual taxable turnover classification (${scan.business_profile.revenue_band}), this entity falls under the UAE Ministry of Finance ${
                  scan.business_profile.revenue_band === 'ABOVE_50M_AED'
                    ? 'Phase 1 mandate effective July 1, 2026. Live transmission of Peppol PINT AE electronic invoices via an Accredited Service Provider (ASP) is legally required.'
                    : 'Phase 2 transition scheduled for 2027. Early adoption and structured XML export preparation recommended.'
                }`
              : `Under Philippine BIR regulations (TRAIN Act Sec. 237-A, RR 8-2022, and EOPT Act RA 11976), this business entity is evaluated against mandatory EIS JSON transmission rules and the statutory shift from Official Receipts to Invoices.`}
          </p>
        </div>

        {/* 3. Dimensional Scoring Matrix */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            2. Dimensional Compliance Matrix
          </h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Dimension</th>
                  <th className="p-3 text-right">Weight</th>
                  <th className="p-3 text-right">Points Earned</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scorecard.dimensions.map((dim) => (
                  <tr key={dim.dimension}>
                    <td className="p-3 font-medium text-slate-800">{dim.label}</td>
                    <td className="p-3 text-right font-mono tabular-nums text-slate-500">{dim.weight} pts</td>
                    <td className="p-3 text-right font-mono font-bold tabular-nums text-slate-900">
                      {dim.points_earned.toFixed(1)} pts
                    </td>
                    <td className="p-3 text-right font-semibold">
                      <span
                        className={
                          dim.percentage >= 80
                            ? 'text-emerald-700'
                            : dim.percentage >= 50
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }
                      >
                        {dim.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Critical Findings & Remediation Plan */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            3. Regulatory Gaps &amp; Remediation Plan
          </h3>

          {scan.remediation_plan.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>No critical gaps detected. Document and system profiles satisfy all evaluated rules.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {scan.remediation_plan.map((item, idx) => (
                <div key={item.action_id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {idx + 1}. {item.title}
                    </span>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                      Priority {item.priority} · {item.owner_role.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.problem}</p>
                  <p className="text-xs font-semibold text-slate-800">
                    Remediation: {item.what_to_change}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Authoritative Legal Disclaimer (MANDATORY Section 24) */}
        <div className="border-t-2 border-slate-900 pt-6 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Statutory Disclaimer
          </span>
          <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-4 rounded-xl border border-slate-200">
            "This report is an automated e-invoicing readiness assessment based on the regulatory sources and rule-pack version identified in this report. It is not tax, accounting or legal advice and is not a government compliance certificate. Regulatory requirements may change. Users should verify applicable obligations with the relevant authority or qualified professional."
          </p>
        </div>
      </div>
    </div>
  );
};
