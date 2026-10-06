import React, { useState } from 'react';
import { RemediationAction } from '../engine/types';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Layers,
  UserCheck,
  Zap,
  ArrowUpDown,
  Filter,
} from 'lucide-react';

interface RemediationScreenProps {
  remediationPlan: RemediationAction[];
  onBackToDashboard: () => void;
  onGoToReport: () => void;
}

export const RemediationScreen: React.FC<RemediationScreenProps> = ({
  remediationPlan,
  onBackToDashboard,
  onGoToReport,
}) => {
  const [sortBy, setSortBy] = useState<'PRIORITY' | 'EFFORT' | 'TIMELINE'>('PRIORITY');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const sortedPlan = [...remediationPlan].sort((a, b) => {
    if (sortBy === 'PRIORITY') {
      const pOrder: Record<string, number> = { P0: 1, P1: 2, P2: 3, P3: 4 };
      return (pOrder[a.priority] || 9) - (pOrder[b.priority] || 9);
    }
    if (sortBy === 'EFFORT') {
      const eOrder: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
      return (eOrder[a.effort] || 9) - (eOrder[b.effort] || 9);
    }
    return a.estimated_timeline_days - b.estimated_timeline_days;
  });

  const filteredPlan = sortedPlan.filter((action) => {
    if (roleFilter === 'ALL') return true;
    return action.owner_role === roleFilter;
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'P0':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'P1':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <button
            onClick={onBackToDashboard}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-1 block"
          >
            ← Back to Dashboard
          </button>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Remediation &amp; Transition Roadmap
          </h2>
        </div>

        <button
          onClick={onGoToReport}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
        >
          <span>Executive Report</span>
        </button>
      </div>

      {/* Control bar: Sort & Role Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-700">Sort By:</span>
          <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
            {(['PRIORITY', 'EFFORT', 'TIMELINE'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  sortBy === s ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-700">Owner Team:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">All Teams ({remediationPlan.length})</option>
            <option value="IT_DEVELOPER">IT &amp; Systems Engineering</option>
            <option value="FINANCE">Finance &amp; Tax</option>
            <option value="BILLING_OPS">Billing Operations</option>
          </select>
        </div>
      </div>

      {/* Remediation Cards */}
      {filteredPlan.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">Zero Remediation Actions Required</p>
          <p className="text-xs mt-1">Your invoicing setup meets all assessed regulatory requirements.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredPlan.map((action, index) => (
            <div
              key={action.action_id}
              className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getPriorityBadge(
                      action.priority
                    )}`}
                  >
                    Priority {action.priority}
                  </span>
                  <span className="text-xs font-mono text-slate-400">Rule: {action.rule_id}</span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Role: {action.owner_role.replace(/_/g, ' ')}</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Timeline: ~{action.estimated_timeline_days} days</span>
                  </span>
                  <span>·</span>
                  <span className="font-semibold text-slate-700">Effort: {action.effort}</span>
                </div>
              </div>

              {/* Title & Problem */}
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{action.title}</h3>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                  <strong>Problem:</strong> {action.problem}
                </p>
              </div>

              {/* What to change & Implementation Steps */}
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    What To Change
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {action.what_to_change}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Recommended Implementation Steps
                  </span>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                    {action.suggested_implementation.map((step, sIdx) => (
                      <li key={sIdx}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
