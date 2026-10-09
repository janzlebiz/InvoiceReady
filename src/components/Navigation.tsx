import React from 'react';
import { ShieldCheck, PlayCircle, BookOpen, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavigationProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenTests: () => void;
  onOpenTraceability: () => void;
  isAdmin?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onNavigate,
  onOpenTests,
  onOpenTraceability,
  isAdmin = false,
}) => {
  const { user, profile, openAuthModal, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Brand title wordmark */}
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
          aria-label="InvoiceReady Home"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm">
            IR
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-slate-800 transition-colors">
              InvoiceReady
            </span>
          </div>
        </button>

        {/* Zone 2: Clean 4-6 text navigation links */}
        <nav
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          aria-label="Main Navigation"
        >
          <button
            onClick={() => onNavigate('landing')}
            className={`transition-colors hover:text-slate-900 py-1 ${
              currentView === 'landing' ? 'text-slate-900 font-semibold border-b-2 border-slate-900' : ''
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => onNavigate('country-select')}
            className={`transition-colors hover:text-slate-900 py-1 ${
              ['country-select', 'business-profile', 'system-assessment', 'upload', 'processing', 'extraction-review', 'dashboard', 'findings', 'remediation', 'report'].includes(currentView)
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : ''
            }`}
          >
            Assessment
          </button>
          <button
            onClick={() => onNavigate('admin')}
            className={`transition-colors hover:text-slate-900 py-1 ${
              currentView === 'admin' ? 'text-slate-900 font-semibold border-b-2 border-slate-900' : ''
            }`}
          >
            Regulatory Registry
          </button>
          <button
            onClick={() => onNavigate('privacy')}
            className={`transition-colors hover:text-slate-900 py-1 ${
              currentView === 'privacy' ? 'text-slate-900 font-semibold border-b-2 border-slate-900' : ''
            }`}
          >
            Privacy & Retention
          </button>
          <button
            onClick={onOpenTraceability}
            className="transition-colors hover:text-slate-900 flex items-center gap-1.5 py-1"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            Traceability Matrix
          </button>
        </nav>

        {/* Zone 3: Primary actions & Supabase Auth */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-700">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-medium max-w-[120px] truncate" title={user.email || ''}>
                  {profile?.fullName || user.email?.split('@')[0]}
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  {profile?.role || 'User'}
                </span>
              </div>
              <button
                onClick={() => signOut()}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Sign out of Supabase"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Sign In</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={onOpenTests}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              title="Execute Authorized Regression &amp; Regulatory Test Suite (Admin Only)"
            >
              <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Run Test Suite</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('country-select')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Check My Readiness</span>
          </button>
        </div>
      </div>
    </header>
  );
};
