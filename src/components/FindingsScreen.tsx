import React, { useState } from 'react';
import { Finding, RuleValidationResult, RuleSeverity } from '../engine/types';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  ExternalLink,
  ChevronRight,
  X,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react';

interface FindingsScreenProps {
  findings: Finding[];
  validationResults: RuleValidationResult[];
  onBackToDashboard: () => void;
  onGoToRemediation: () => void;
}

export const FindingsScreen: React.FC<FindingsScreenProps> = ({
  findings,
  validationResults,
  onBackToDashboard,
  onGoToRemediation,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | RuleSeverity | 'PASSED'>('ALL');
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Group or filter
  const passedRules = validationResults.filter((r) => r.state === 'PASS');

  const filteredFindings = findings.filter((f) => {
    if (filterSeverity === 'ALL') return true;
    if (filterSeverity === 'PASSED') return false;
    return f.severity === filterSeverity;
  });

  const getSeverityBadge = (severity: RuleSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'HIGH':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'MEDIUM':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'LOW':
        return 'text-slate-700 bg-slate-50 border-slate-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <button
            onClick={onBackToDashboard}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-1 block"
          >
            ← Back to Dashboard
          </button>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Detailed Regulatory Findings &amp; Gaps
          </h2>
        </div>

        <button
          onClick={onGoToRemediation}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
        >
          <span>View Remediation Roadmap</span>
        </button>
      </div>

      {/* Filter Tabs (Interactive segmented control, not pills) */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
        {[
          { id: 'ALL', label: `All Gaps (${findings.length})` },
          { id: 'CRITICAL', label: `Critical (${findings.filter((f) => f.severity === 'CRITICAL').length})` },
          { id: 'HIGH', label: `High (${findings.filter((f) => f.severity === 'HIGH').length})` },
          { id: 'MEDIUM', label: `Medium (${findings.filter((f) => f.severity === 'MEDIUM').length})` },
          { id: 'PASSED', label: `Passed (${passedRules.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterSeverity(tab.id as any)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              filterSeverity === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filterSeverity === 'PASSED' ? (
          /* Passed Rules View */
          passedRules.map((rule) => (
            <div
              key={rule.rule_id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>PASSED</span>
                  </span>
                  <span className="text-xs font-mono text-slate-400">{rule.rule_id}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{rule.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{rule.message}</p>
                <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-2">
                  <span>Source: {rule.source_id}</span>
                  <span>·</span>
                  <span>{rule.source_locator}</span>
                </div>
              </div>

              <span className="font-mono text-xs font-bold text-emerald-600 whitespace-nowrap">
                +{rule.points_possible} pts
              </span>
            </div>
          ))
        ) : filteredFindings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No findings in this category</p>
            <p className="text-xs mt-1">All evaluated requirements under this filter are satisfied.</p>
          </div>
        ) : (
          /* Gaps List */
          filteredFindings.map((finding) => (
            <div
              key={finding.finding_id}
              onClick={() => setSelectedFinding(finding)}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-xs cursor-pointer transition-all flex items-start justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityBadge(
                      finding.severity
                    )}`}
                  >
                    {finding.severity}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{finding.rule_id}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500">{finding.category.replace(/_/g, ' ')}</span>
                </div>

                <h4 className="text-sm font-bold text-slate-900">{finding.title}</h4>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                  {finding.description}
                </p>

                <div className="pt-1 flex items-center gap-4 text-[11px] text-slate-500">
                  <span>
                    Authority: <strong className="text-slate-700">{finding.regulatory_source.authority}</strong>
                  </span>
                  <span>·</span>
                  <span>Citation: {finding.regulatory_source.locator}</span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 self-center" />
            </div>
          ))
        )}
      </div>

      {/* Screen 10: Finding Detail Drawer / Modal (Section 56, Screen 10) */}
      {selectedFinding && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityBadge(
                      selectedFinding.severity
                    )}`}
                  >
                    {selectedFinding.severity}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{selectedFinding.rule_id}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{selectedFinding.title}</h3>
              </div>
              <button
                onClick={() => setSelectedFinding(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Gap Description */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Identified Gap
              </span>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                {selectedFinding.description}
              </p>
            </div>

            {/* Evidence Traceability Snapshot (Section 11) */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Evidence Traceability Snapshot
              </span>
              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl text-xs font-mono overflow-x-auto">
                <pre>{JSON.stringify(selectedFinding.evidence.values, null, 2)}</pre>
              </div>
            </div>

            {/* Why It Matters */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Why It Matters (Regulatory Impact)
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {selectedFinding.why_it_matters}
              </p>
            </div>

            {/* Recommended Action & Implementation Steps */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Recommended Action &amp; Remediation
              </span>
              <p className="text-xs font-semibold text-slate-900 mb-2">
                {selectedFinding.recommended_action}
              </p>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                {selectedFinding.implementation_steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>

            {/* Regulatory Authority Citation */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-900 block">Regulatory Source Authority</span>
              <span className="text-slate-600 block">{selectedFinding.regulatory_source.document_title}</span>
              <span className="text-slate-500 block font-mono text-[11px]">
                {selectedFinding.regulatory_source.document_number} · Locator: {selectedFinding.regulatory_source.locator}
              </span>
              {selectedFinding.regulatory_source.url && (
                <a
                  href={selectedFinding.regulatory_source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline pt-1"
                >
                  <span>Official Government Reference</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedFinding(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Close Finding Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
