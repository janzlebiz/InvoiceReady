'use client';

import React from 'react';
import { AuthProvider } from '../src/context/AuthContext';
import { AuthModal } from '../src/components/AuthModal';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <AuthModal />
    </AuthProvider>
  );
}
