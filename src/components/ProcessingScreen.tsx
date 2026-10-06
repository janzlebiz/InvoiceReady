import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, FileSearch, Scale, BarChart3, FileText } from 'lucide-react';

interface ProcessingScreenProps {
  onProcessingComplete: () => void;
  documentName: string;
}

const STAGES = [
  { id: 'SECURITY_CHECK', label: 'Document security & MIME validation', icon: ShieldCheck },
  { id: 'READING_INVOICE', label: 'Reading invoice & optical parsing', icon: FileSearch },
  { id: 'EXTRACTING', label: 'Extracting canonical invoice schema', icon: FileText },
  { id: 'CHECKING_APPLICABILITY', label: 'Evaluating regulatory applicability & phase logic', icon: Scale },
  { id: 'RUNNING_CHECKS', label: 'Running deterministic validation rules', icon: BarChart3 },
  { id: 'PREPARING_REPORT', label: 'Compiling scorecard & remediation plan', icon: CheckCircle2 },
];

export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({
  onProcessingComplete,
  documentName,
}) => {
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStageIndex((prev) => {
        if (prev < STAGES.length - 1) {
          return prev + 1;
        } else {
          clearInterval(timer);
          setTimeout(() => {
            onProcessingComplete();
          }, 600);
          return prev;
        }
      });
    }, 700);

    return () => clearInterval(timer);
  }, [onProcessingComplete]);

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="space-y-3 mb-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Deterministic Pipeline · Processing
        </span>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Analyzing {documentName || 'invoice'}
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Executing deterministic regulatory evaluation. Compliance decisions originate exclusively from statutory rule packs.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs text-left space-y-4">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isDone = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          const isPending = idx > currentStageIndex;

          return (
            <div
              key={stage.id}
              className={`flex items-center gap-3.5 p-3 rounded-xl transition-all ${
                isCurrent
                  ? 'bg-slate-900 text-white shadow-xs'
                  : isDone
                  ? 'bg-slate-50 text-slate-700'
                  : 'text-slate-400 opacity-60'
              }`}
            >
              <div className="shrink-0">
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 flex items-center justify-between text-xs font-semibold">
                <span>{stage.label}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">
                  {isDone ? 'COMPLETED' : isCurrent ? 'RUNNING' : 'PENDING'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
