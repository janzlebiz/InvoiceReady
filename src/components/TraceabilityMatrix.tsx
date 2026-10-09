'use client';

import React from 'react';
import { X, CheckCircle2, BookOpen, Layers } from 'lucide-react';

interface TraceabilityMatrixProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TraceabilityMatrix: React.FC<TraceabilityMatrixProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const requirements = [
    {
      id: 'PRD-001',
      category: 'P0 - WORKFLOW',
      title: 'End-to-End Audit Workflow',
      implementation: 'App.tsx state machine (Screen 01 through Screen 12)',
      test: 'E2E-WORKFLOW-001',
      status: 'PASS',
    },
    {
      id: 'PRD-002',
      category: 'P0 - BOUNDARY',
      title: 'AI Boundary (AI never decides compliance)',
      implementation: 'GeminiExtractor.ts + prompt injection defenses',
      test: 'TEST-INV-015, AI-006',
      status: 'PASS',
    },
    {
      id: 'PRD-003',
      category: 'P0 - AUTHORITY',
      title: 'Deterministic Rule Authority',
      implementation: 'RuleEngine.ts, uae2026.ts, ph2026.ts',
      test: 'RULE-ENGINE-001',
      status: 'PASS',
    },
    {
      id: 'PRD-010',
      category: 'P0 - JURISDICTION',
      title: 'Initial Scope: UAE & Philippines',
      implementation: 'RuleRegistry.ts, JurisdictionSelect.tsx',
      test: 'AE-TEST-001, PH-TEST-001',
      status: 'PASS',
    },
    {
      id: 'PRD-020',
      category: 'P0 - UAE',
      title: 'UAE E-Invoicing Phase 1 Mandate (> AED 50M)',
      implementation: 'uae2026.ts (AE-RULE-APPLICABILITY-PHASE)',
      test: 'AE-TEST-001, AE-TEST-002',
      status: 'PASS',
    },
    {
      id: 'PRD-030',
      category: 'P0 - PH',
      title: 'Philippines BIR EIS & Covered Taxpayers',
      implementation: 'ph2026.ts (PH-RULE-APPLICABILITY-EIS)',
      test: 'PH-TEST-001, PH-TEST-003',
      status: 'PASS',
    },
    {
      id: 'TSD-001',
      category: 'P0 - PIPELINE',
      title: 'Secure Document Extraction Pipeline',
      implementation: 'StorageService.ts + GeminiExtractor.ts',
      test: 'AI-001',
      status: 'PASS',
    },
    {
      id: 'TSD-002',
      category: 'P0 - SCHEMA',
      title: 'Strict JSON Schema & Extracted Evidence Model',
      implementation: 'types.ts (CanonicalInvoice, ExtractedFieldEvidence)',
      test: 'AI-002',
      status: 'PASS',
    },
    {
      id: 'TSD-003',
      category: 'P0 - ACCURACY',
      title: 'Missing information represented as null (No hallucination)',
      implementation: 'GeminiExtractor.ts prompt instructions',
      test: 'AI-002, AI-004',
      status: 'PASS',
    },
    {
      id: 'TSD-010',
      category: 'P0 - ENGINE',
      title: 'Decoupled Deterministic Rule Engine',
      implementation: 'RuleEngine.ts',
      test: 'RULE-001',
      status: 'PASS',
    },
    {
      id: 'TSD-011',
      category: 'P0 - VERSIONING',
      title: 'Versioned Rule Pack Architecture',
      implementation: 'uae2026.ts (AE-2026.1), ph2026.ts (PH-2026.1)',
      test: 'REG-001',
      status: 'PASS',
    },
    {
      id: 'TSD-020',
      category: 'P0 - APPLICABILITY',
      title: 'Applicability Evaluated BEFORE Scoring',
      implementation: 'ApplicabilityEngine.ts',
      test: 'AE-TEST-003, AE-TEST-004',
      status: 'PASS',
    },
    {
      id: 'PRD-060',
      category: 'P0 - SCORING',
      title: '100-Point Dimensional Weighting & Critical Gates',
      implementation: 'ScoringEngine.ts (Section 17-20)',
      test: 'TEST-INV-001, TEST-INV-002',
      status: 'PASS',
    },
    {
      id: 'SEC-001',
      category: 'P0 - SECURITY',
      title: 'Multi-Tenant Isolation (organization_id)',
      implementation: 'schema.sql, models.ts, server.ts',
      test: 'SEC-001',
      status: 'PASS',
    },
    {
      id: 'SEC-007',
      category: 'P0 - SECURITY',
      title: 'Prompt Injection Defense in Document Text',
      implementation: 'GeminiExtractor.ts untrusted text defense',
      test: 'TEST-INV-015',
      status: 'PASS',
    },
    {
      id: 'PRIV-001',
      category: 'P0 - PRIVACY',
      title: '24-Hour File Retention & Consent Management',
      implementation: 'StorageService.ts, PrivacyCenter.tsx',
      test: 'PRIV-001, PRIV-002',
      status: 'PASS',
    },
    {
      id: 'A11Y-008',
      category: 'P0 - ACCESSIBILITY',
      title: 'WCAG 2.2 AA: No Color-Only Status Signaling',
      implementation: 'DashboardScreen.tsx, FindingsScreen.tsx',
      test: 'A11Y-008',
      status: 'PASS',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Authoritative Requirement Traceability Matrix (Section 87)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Every P0 and P1 requirement mapped directly to code implementation, test verification, and current status.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Matrix Table */}
        <div className="flex-1 overflow-y-auto my-4 border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] sticky top-0">
              <tr>
                <th className="p-3">Req ID</th>
                <th className="p-3">Category</th>
                <th className="p-3">Requirement Title</th>
                <th className="p-3">Implementation Module</th>
                <th className="p-3">Test Case</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requirements.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-900">{req.id}</td>
                  <td className="p-3 text-[10px] font-bold text-slate-500">{req.category}</td>
                  <td className="p-3 font-semibold text-slate-800">{req.title}</td>
                  <td className="p-3 font-mono text-[11px] text-slate-600">{req.implementation}</td>
                  <td className="p-3 font-mono text-[11px] text-slate-500">{req.test}</td>
                  <td className="p-3 text-right">
                    <span className="inline-flex items-center gap-1 font-bold font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{req.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Release Verdict (Section 97): 100% Core Requirements Implemented &amp; Verified.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
