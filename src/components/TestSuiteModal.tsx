'use client';

import React, { useState, useEffect } from 'react';
import { TestCaseResult, TestSuiteOutcome } from '../engine/types';
import { CheckCircle2, XCircle, PlayCircle, X, ShieldCheck, RefreshCw } from 'lucide-react';
import { getClientAuthHeader } from '../services/supabaseClient';

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({ isOpen, onClose }) => {
  const [testResults, setTestResults] = useState<TestSuiteOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const executeTests = async () => {
    setRunning(true);
    setErrorMsg(null);
    try {
      const authHeader = await getClientAuthHeader();
      const resp = await fetch('/api/tests/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        setTestResults(data);
      } else {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.message || `Test runner service returned HTTP ${resp.status}`);
      }
    } catch (err: any) {
      console.error('Failed to run backend tests:', err);
      setErrorMsg(err.message || 'Failed to connect to backend test runner service.');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen && !testResults) {
      executeTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Automated Regulatory &amp; Technical Test Suite
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Verifies regulatory test cases, invoice parsing, AI determinism, and security isolation (Sections 71–77).
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="my-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={executeTests}
              className="font-semibold underline ml-2 text-rose-800 hover:text-rose-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Results Banner */}
        {testResults && (
          <div className="my-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Tests</span>
                <span className="text-xl font-bold font-mono text-slate-900">{testResults.total}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Passed</span>
                <span className="text-xl font-bold font-mono text-emerald-600">{testResults.passed}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Failed</span>
                <span className="text-xl font-bold font-mono text-rose-600">{testResults.failed}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Execution Time</span>
                <span className="text-xl font-bold font-mono text-slate-700">{testResults.durationMs}ms</span>
              </div>
            </div>

            <button
              onClick={executeTests}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
              <span>Re-run Suite</span>
            </button>
          </div>
        )}

        {/* Test Cases List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 my-2 pr-1">
          {testResults?.results.map((t) => (
            <div
              key={t.testId}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/50 flex items-start justify-between gap-4 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {t.status === 'PASS' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-mono font-bold text-slate-900">{t.testId}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-semibold text-slate-800">{t.name}</span>
                </div>
                <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">{t.details}</p>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                    t.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {t.status}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Req: {t.mappedRequirementId}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Acceptance Gate (Section 78): 100% P0 and Regulatory tests must pass.</span>
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
