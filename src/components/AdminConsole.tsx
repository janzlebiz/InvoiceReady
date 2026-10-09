'use client';

import React, { useState } from 'react';
import { RuleRegistry } from '../rules/ruleRegistry';
import { REGULATORY_SOURCES } from '../rules/sourcesRegistry';
import { Shield, BookOpen, Layers, History, ExternalLink, CheckCircle2, Lock, ArrowLeft } from 'lucide-react';

interface AdminConsoleProps {
  onBackToDashboard?: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ onBackToDashboard }) => {
  const [activeTab, setActiveTab] = useState<'PACKS' | 'SOURCES' | 'AUDIT'>('PACKS');

  const packs = RuleRegistry.getAllPacks();
  const sources = Object.values(REGULATORY_SOURCES);

  // Mock initial audit logs
  const auditLogs = [
    {
      log_id: 'LOG-001',
      actor: 'system:deployer',
      action: 'RULE_PACK_PUBLISHED',
      resource_id: 'AE-2026.1',
      result: 'SUCCESS',
      ip_address: '10.0.1.42',
      timestamp: '2026-08-01T09:00:00Z',
    },
    {
      log_id: 'LOG-002',
      actor: 'system:deployer',
      action: 'RULE_PACK_PUBLISHED',
      resource_id: 'PH-2026.1',
      result: 'SUCCESS',
      ip_address: '10.0.1.42',
      timestamp: '2026-08-01T09:05:00Z',
    },
    {
      log_id: 'LOG-003',
      actor: 'analyst:compliance',
      action: 'VERIFY_EOPT_ACT_RULES',
      resource_id: 'PH-RULE-INVOICE-VERSUS-OR',
      result: 'SUCCESS',
      ip_address: '192.168.1.10',
      timestamp: '2026-08-10T14:22:00Z',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Platform Governance · Section 57 &amp; 58
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Regulatory Administration &amp; Source Registry
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Rule packs are immutable once published. Only authoritative government decrees establish compliance rules.
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

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('PACKS')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'PACKS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Rule Packs ({packs.length})
        </button>
        <button
          onClick={() => setActiveTab('SOURCES')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'SOURCES' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Authoritative Sources ({sources.length})
        </button>
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'AUDIT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Audit Trail Log
        </button>
      </div>

      {/* Tab: Rule Packs */}
      {activeTab === 'PACKS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {packs.map((pack) => {
            const rules = RuleRegistry.getRulesForJurisdiction(pack.jurisdiction, pack.version);
            return (
              <div
                key={pack.version}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{pack.jurisdiction === 'AE' ? '🇦🇪' : '🇵🇭'}</span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {pack.jurisdiction === 'AE' ? 'United Arab Emirates' : 'Philippines'}
                      </h3>
                      <span className="text-xs font-mono text-slate-500">{pack.version}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      pack.status === 'PUBLISHED'
                        ? 'text-emerald-800 bg-emerald-100'
                        : 'text-amber-800 bg-amber-100'
                    }`}
                  >
                    {pack.status} (IMMUTABLE)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-500 block">Version Tag:</span>
                    <strong className="text-slate-900 font-mono">{pack.version}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Active Rules:</span>
                    <strong className="text-slate-900">{pack.rulesCount} deterministic rules</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Legal Sources:</span>
                    <strong className="text-slate-900">{pack.sourcesCount} authoritative laws</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Effective Rollout:</span>
                    <strong className="text-slate-900">
                      {pack.jurisdiction === 'AE' ? 'July 2026' : 'Active (EOPT / RR 8-2022)'}
                    </strong>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Key Rules Included:
                  </span>
                  <div className="space-y-1 text-xs text-slate-700">
                    {rules.slice(0, 4).map((r) => (
                      <div key={r.rule_id} className="flex items-center justify-between">
                        <span className="truncate pr-2 font-medium">{r.title}</span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">{r.rule_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Authoritative Sources */}
      {activeTab === 'SOURCES' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            <strong>REG-001 Compliance:</strong> Only official government statutes and revenue circulars establish compliance criteria. Vendor websites are strictly prohibited as authoritative sources.
          </div>
          <div className="divide-y divide-slate-100">
            {sources.map((src) => (
              <div key={src.source_id} className="p-6 space-y-2 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{src.document_title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {src.jurisdiction}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{src.document_number}</span>
                </div>

                <p className="text-xs text-slate-600">Authority: {src.authority}</p>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                  <span>Publication: {src.publication_date}</span>
                  <span>·</span>
                  <span>Effective Date: {src.effective_date}</span>
                  <span>·</span>
                  <span className="font-mono truncate max-w-xs">{src.source_hash}</span>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Official Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Audit Log */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            <strong>Section 59 Compliance:</strong> Structured immutable audit trail. Sensitive document contents are strictly excluded from audit logs.
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Log ID</th>
                <th className="p-3.5">Actor</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Resource</th>
                <th className="p-3.5">Result</th>
                <th className="p-3.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {auditLogs.map((log) => (
                <tr key={log.log_id} className="hover:bg-slate-50">
                  <td className="p-3.5 text-slate-400">{log.log_id}</td>
                  <td className="p-3.5 text-slate-700">{log.actor}</td>
                  <td className="p-3.5 font-bold text-slate-900">{log.action}</td>
                  <td className="p-3.5 text-slate-600">{log.resource_id}</td>
                  <td className="p-3.5 text-emerald-600 font-bold">{log.result}</td>
                  <td className="p-3.5 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
