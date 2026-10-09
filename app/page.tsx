'use client';

import dynamic from 'next/dynamic';
import { Providers } from './providers';

const DynamicApp = dynamic(() => import('../src/App').then((mod) => mod.App), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-600">Loading InvoiceReady...</span>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <Providers>
      <DynamicApp />
    </Providers>
  );
}
