'use client';

import React from 'react';
import { Scorecard, ScanSession } from '../engine/types';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  FileText,
  ListFilter,
  CheckCircle2,
  Calendar,
  Building,
  Lock,
} from 'lucide-react';

interface DashboardScreenProps {
  scan: ScanSession;
  scorecard: Scorecard;
  onViewFindings: () => void;
  onViewRemediation: () => void;
  onViewReport: () => void;
  onStartNewScan: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  scan,
  scorecard,
  onViewFindings,
  onViewRemediation,
  onViewReport,
  onStartNewScan,
}) => {
  const isUAE = scan.jurisdiction === 'AE';

  const getScoreColor = (classification: string) => {
    switch (classification) {
      case 'READY':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'MOSTLY_READY':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'NEEDS_ATTENTION':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'SIGNIFICANT_GAPS':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      default:
        return 'text-rose-700 bg-rose-50 border-rose-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>Jurisdiction: {isUAE ? '🇦🇪 UAE (AE-2026.1)' : '🇵🇭 Philippines (PH-2026.1)'}</span>
            <span>·</span>
            <span>Entity: {scan.business_profile.business_name}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            E-Invoicing Readiness Scorecard
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onStartNewScan}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            New Scan
          </button>
          <button
            onClick={onViewReport}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate PDF Report</span>
          </button>
        </div>
      </div>

      {/* Critical Gate Alert Banner (Section 19) */}
      {scorecard.critical_gate_triggered && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 space-y-1">
            <span className="font-bold text-sm block">Critical Regulatory Gate Triggered</span>
            <p className="leading-relaxed">
              {scorecard.critical_gate_reason ||
                `Overall score is strictly capped at ${scorecard.critical_gate_cap}/100 due to non-negotiable statutory failures (e.g. Missing Structured Data capability or Statutory VAT breakdown).`}
            </p>
          </div>
        </div>
      )}

      {/* Main Score & Severity Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Score Box (Screen 08: 67 / 100 NEEDS ATTENTION) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Overall Readiness Score
          </span>

          <div className="my-6">
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-extrabold font-mono tracking-tight text-slate-900 tabular-nums">
                {scorecard.overall_score}
              </span>
              <span className="text-2xl font-bold text-slate-400 font-mono">/ 100</span>
            </div>

            <div className="mt-3">
              <span
                className={`inline-block text-xs font-bold px-3 py-1 rounded-full border ${getScoreColor(
                  scorecard.classification
                )}`}
              >
                {scorecard.classification.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed pt-4 border-t border-slate-100">
            Calculated across {scorecard.rules_summary.applicable} statutory requirements evaluated specifically for your business profile.
          </p>
        </div>

        {/* Severity Count Grid (Screen 08: Critical: 2, High: 4, etc.) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">
            Findings by Severity
          </span>

          <div className="grid grid-cols-2 gap-4 my-auto">
            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
              <span className="text-xs font-bold text-rose-700 block">Critical</span>
              <span className="text-2xl font-extrabold text-rose-900 font-mono tabular-nums">
                {scorecard.findings_by_severity.critical}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
              <span className="text-xs font-bold text-amber-700 block">High</span>
              <span className="text-2xl font-extrabold text-amber-900 font-mono tabular-nums">
                {scorecard.findings_by_severity.high}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
              <span className="text-xs font-bold text-blue-700 block">Medium</span>
              <span className="text-2xl font-extrabold text-blue-900 font-mono tabular-nums">
                {scorecard.findings_by_severity.medium}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-xs font-bold text-emerald-700 block">Passed Rules</span>
              <span className="text-2xl font-extrabold text-emerald-900 font-mono tabular-nums">
                {scorecard.rules_summary.passed}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={onViewFindings}
              className="text-xs font-bold text-slate-900 hover:text-slate-700 flex items-center gap-1"
            >
              <span>View all findings ({scan.findings?.length || 0})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Phase & Timeline Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Applicable Regulatory Timeline
          </span>

          <div className="space-y-3 my-auto">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>
                {isUAE
                  ? 'UAE Phase 1 Mandate: July 2026'
                  : 'BIR EIS & EOPT Act Mandate: Active'}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isUAE
                ? scan.business_profile.revenue_band === 'ABOVE_50M_AED'
                  ? 'Your business exceeds AED 50M turnover and falls under the Phase 1 DCTCE mandate. Live transmission required via an ASP partner.'
                  : 'Your business turnover falls under Phase 2 (scheduled for 2027 rollout). Voluntary preparation is recommended.'
                : 'Under RA 11976 (EOPT Act) and RR 8-2022, VAT taxpayers must shift from Official Receipts to Invoices and prepare for EIS transmission.'}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={onViewRemediation}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <span>View Remediation Roadmap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dimensional Breakdown (Section 17: 8 Dimensions) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-6">
          Score Breakdown by Regulatory Dimension (100-Point Weighted Scale)
        </h3>

        <div className="space-y-5">
          {scorecard.dimensions.map((dim) => (
            <div key={dim.dimension} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">{dim.label}</span>
                <span className="font-mono text-slate-600 tabular-nums">
                  {dim.points_earned.toFixed(1)} / {dim.weight} pts ({dim.percentage}%)
                </span>
              </div>

              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    dim.percentage >= 80
                      ? 'bg-emerald-500'
                      : dim.percentage >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${dim.percentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Weight: {dim.weight} points</span>
                <span>
                  {dim.passed_rules_count} Passed · {dim.failed_rules_count} Failed / Incomplete
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
