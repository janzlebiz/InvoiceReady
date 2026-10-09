import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InvoiceReady - E-Invoicing Regulatory Readiness Assessment',
  description:
    'E-invoicing regulatory readiness assessment platform for UAE and the Philippines. Upload invoices, evaluate regulatory applicability, and receive deterministic gap analysis and remediation plans.',
  openGraph: {
    title: 'InvoiceReady - E-Invoicing Regulatory Readiness Assessment',
    description:
      'E-invoicing regulatory readiness assessment platform for UAE and the Philippines. Upload invoices, evaluate regulatory applicability, and receive deterministic gap analysis and remediation plans.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InvoiceReady - E-Invoicing Regulatory Readiness Assessment',
    description:
      'E-invoicing regulatory readiness assessment platform for UAE and the Philippines. Upload invoices, evaluate regulatory applicability, and receive deterministic gap analysis and remediation plans.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
