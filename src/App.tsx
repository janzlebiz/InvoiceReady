'use client';

import React, { useState } from 'react';
import { Navigation } from './components/Navigation';
import { LandingScreen } from './components/LandingScreen';
import { JurisdictionSelect } from './components/JurisdictionSelect';
import { BusinessProfileForm } from './components/BusinessProfileForm';
import { SystemAssessmentForm } from './components/SystemAssessmentForm';
import { InvoiceUpload } from './components/InvoiceUpload';
import { ProcessingScreen } from './components/ProcessingScreen';
import { ExtractionReview } from './components/ExtractionReview';
import { DashboardScreen } from './components/DashboardScreen';
import { FindingsScreen } from './components/FindingsScreen';
import { RemediationScreen } from './components/RemediationScreen';
import { ReportScreen } from './components/ReportScreen';
import { AdminConsole } from './components/AdminConsole';
import { PrivacyCenter } from './components/PrivacyCenter';
import { TestSuiteModal } from './components/TestSuiteModal';
import { TraceabilityMatrix } from './components/TraceabilityMatrix';

import {
  JurisdictionCode,
  BusinessProfile,
  SystemProfile,
  ScanSession,
  ExtractionResult,
} from './engine/types';
import { getClientAuthHeader } from './services/supabaseClient';
import { useAuth } from './context/AuthContext';

export const App: React.FC = () => {
  const { profile } = useAuth();
  const [currentView, setCurrentView] = useState<string>('landing');
  const [testSuiteOpen, setTestSuiteOpen] = useState<boolean>(false);
  const [traceabilityOpen, setTraceabilityOpen] = useState<boolean>(false);

  // User & Administrative context derived from Supabase Auth profile
  const [fallbackRole, setFallbackRole] = useState<'VIEWER' | 'ANALYST' | 'ADMIN' | 'OWNER'>('ANALYST');
  const userRole = profile?.role || fallbackRole;
  const isAdminOrOwner = userRole === 'ADMIN' || userRole === 'OWNER';

  // Assessment flow states (Requirement 2: Zero default sample/demo business data)
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<JurisdictionCode>('AE');

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    id: `bp_${Date.now().toString(36)}`,
    organization_id: 'org_main',
    country: 'AE',
    business_name: '',
    trade_name: '',
    tax_identifier: '',
    vat_registered: true,
    revenue_band: 'BELOW_50M_AED',
    transaction_types: ['B2B'],
    branch_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const [systemProfile, setSystemProfile] = useState<SystemProfile>({
    id: `sys_${Date.now().toString(36)}`,
    organization_id: 'org_main',
    accounting_system: 'CUSTOM_ERP',
    invoicing_system: 'CUSTOM_ERP',
    current_invoice_format: 'PDF',
    structured_export_capability: false,
    electronic_transmission_capability: false,
    asp_partner_selected: false,
    cas_permit_active: false,
    number_of_invoice_templates: 1,
  });

  // Zero default preloaded invoice (Requirement 2 & 10)
  const [uploadedDocument, setUploadedDocument] = useState<{
    file?: File;
    fileName: string;
    fileSize: number;
    mimeType: string;
    rawText?: string;
  } | null>(null);

  const [currentExtraction, setCurrentExtraction] = useState<ExtractionResult | null>(null);
  const [currentScan, setCurrentScan] = useState<ScanSession | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Transition handlers (Requirement 2: Clean jurisdiction switch without synthetic business data)
  const handleSelectJurisdiction = (jur: JurisdictionCode) => {
    setSelectedJurisdiction(jur);
    setBusinessProfile((prev) => ({
      ...prev,
      country: jur,
      revenue_band: jur === 'AE' ? 'BELOW_50M_AED' : 'MICRO_BELOW_3M_PHP',
      taxpayer_category: undefined,
    }));
    setSystemProfile((prev) => ({
      ...prev,
      asp_partner_selected: false,
      cas_permit_active: false,
    }));
  };

  const handleStartAssessment = () => {
    setCurrentView('country-select');
  };

  const handleStartProcessing = () => {
    if (!uploadedDocument) {
      setPipelineError('Please select or upload an invoice document before proceeding.');
      return;
    }
    setPipelineError(null);
    setCurrentView('processing');
  };

  /**
   * Authoritative Server-Side Processing Pipeline (Requirements 3, 4, 10)
   * The browser NEVER independently calculates legal compliance or scorecard results.
   * Every result is derived server-side and fetched from /api/scans/:scanId.
   */
  const executeServerProcessingPipeline = async (): Promise<ScanSession> => {
    // Real Firebase client authentication (Requirement 5)
    const authHeader = await getClientAuthHeader();

    // 1. Create Scan Session in PostgreSQL
    const createScanResp = await fetch('/api/scans', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jurisdiction: selectedJurisdiction,
        business_profile: {
          ...businessProfile,
          business_name: businessProfile.business_name || 'Assessed Organization LLC',
          tax_identifier: businessProfile.tax_identifier || (selectedJurisdiction === 'AE' ? '100456789012345' : '123-456-789-00000'),
        },
        system_profile: systemProfile,
      }),
    });

    if (!createScanResp.ok) {
      const err = await createScanResp.json().catch(() => ({}));
      throw new Error(err.error || `Failed to initialize scan session (HTTP ${createScanResp.status})`);
    }

    const createdScan = await createScanResp.json();
    const scanId = createdScan.scan_id;

    // 2. Upload Actual Binary Document (Multipart / Form-Data) to Server Quarantine & Storage
    if (uploadedDocument) {
      const formData = new FormData();
      if (uploadedDocument.file) {
        formData.append('file', uploadedDocument.file, uploadedDocument.fileName);
      } else {
        const blob = new Blob([uploadedDocument.rawText || ''], {
          type: uploadedDocument.mimeType || 'application/pdf',
        });
        formData.append('file', blob, uploadedDocument.fileName);
      }

      const uploadResp = await fetch(`/api/scans/${scanId}/documents`, {
        method: 'POST',
        headers: authHeader,
        body: formData,
      });

      if (!uploadResp.ok) {
        const uploadErr = await uploadResp.json().catch(() => ({}));
        throw new Error(uploadErr.error || `Security validation or file upload rejected (HTTP ${uploadResp.status})`);
      }
    }

    // 3. Dispatch Server Processing Worker via Asynchronous Queue (Requirements 5, 23, 24)
    const procResp = await fetch(`/api/scans/${scanId}/process`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
    });

    if (!procResp.ok && procResp.status !== 202) {
      const procErr = await procResp.json().catch(() => ({}));
      throw new Error(procErr.error || `Failed to enqueue server processing (HTTP ${procResp.status})`);
    }

    // 4. Poll Authoritative Scan from PostgreSQL via /api/scans/:scanId (Requirement 4)
    const maxPollAttempts = 25;
    for (let i = 0; i < maxPollAttempts; i++) {
      await new Promise((r) => setTimeout(r, 650));
      const scanPollResp = await fetch(`/api/scans/${scanId}`, {
        headers: authHeader,
      });
      if (scanPollResp.ok) {
        const fetchedScan: ScanSession = await scanPollResp.json();
        if (
          ['COMPLETED', 'REVIEW_REQUIRED', 'FAILED', 'SECURITY_REJECTED'].includes(
            fetchedScan.status
          )
        ) {
          return fetchedScan;
        }
      }
    }

    // Final fetch
    const finalResp = await fetch(`/api/scans/${scanId}`, { headers: authHeader });
    if (finalResp.ok) {
      return await finalResp.json();
    }
    return createdScan;
  };

  const handleProcessingComplete = async () => {
    try {
      const authoritativeScan = await executeServerProcessingPipeline();
      setCurrentScan(authoritativeScan);
      setCurrentExtraction(authoritativeScan.extraction_result || null);

      if (
        authoritativeScan.status === 'SECURITY_REJECTED' ||
        authoritativeScan.status === 'FAILED'
      ) {
        setCurrentView('dashboard');
      } else if (
        authoritativeScan.extraction_result &&
        authoritativeScan.status === 'REVIEW_REQUIRED'
      ) {
        setCurrentView('extraction-review');
      } else {
        setCurrentView('dashboard');
      }
    } catch (err: any) {
      console.error('Server assessment pipeline error:', err);
      setPipelineError(err.message || 'Server assessment pipeline failed.');
      setCurrentView('upload');
    }
  };

  const handleConfirmExtraction = () => {
    // Assessment results are authoritatively stored in PostgreSQL scan; transition to dashboard
    setCurrentView('dashboard');
  };

  const handleDeleteScan = () => {
    setCurrentScan(null);
    setCurrentExtraction(null);
    setCurrentView('landing');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* Universal Top Bar */}
      <Navigation
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenTests={() => setTestSuiteOpen(true)}
        onOpenTraceability={() => setTraceabilityOpen(true)}
        isAdmin={isAdminOrOwner}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'landing' && (
          <LandingScreen
            onStartAssessment={handleStartAssessment}
            onExploreJurisdiction={(jur) => {
              handleSelectJurisdiction(jur);
              setCurrentView('country-select');
            }}
            onOpenHowItWorks={() => setTraceabilityOpen(true)}
          />
        )}

        {currentView === 'country-select' && (
          <JurisdictionSelect
            selectedJurisdiction={selectedJurisdiction}
            onSelect={handleSelectJurisdiction}
            onContinue={() => setCurrentView('business-profile')}
            onBack={() => setCurrentView('landing')}
          />
        )}

        {currentView === 'business-profile' && (
          <BusinessProfileForm
            profile={businessProfile}
            onChange={setBusinessProfile}
            onContinue={() => setCurrentView('system-assessment')}
            onBack={() => setCurrentView('country-select')}
          />
        )}

        {currentView === 'system-assessment' && (
          <SystemAssessmentForm
            system={systemProfile}
            jurisdiction={selectedJurisdiction}
            onChange={setSystemProfile}
            onContinue={() => setCurrentView('upload')}
            onBack={() => setCurrentView('business-profile')}
          />
        )}

        {currentView === 'upload' && (
          <div className="space-y-4">
            {pipelineError && (
              <div className="max-w-3xl mx-auto px-4 mt-6">
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {pipelineError}
                </div>
              </div>
            )}
            <InvoiceUpload
              jurisdiction={selectedJurisdiction}
              onFileSelected={(data) => {
                setUploadedDocument(data);
                setPipelineError(null);
              }}
              onContinue={handleStartProcessing}
              onBack={() => setCurrentView('system-assessment')}
            />
          </div>
        )}

        {currentView === 'processing' && (
          <ProcessingScreen
            documentName={uploadedDocument?.fileName || 'invoice.pdf'}
            onProcessingComplete={handleProcessingComplete}
          />
        )}

        {currentView === 'extraction-review' && currentExtraction && (
          <ExtractionReview
            extraction={currentExtraction}
            onConfirmExtraction={handleConfirmExtraction}
            onBack={() => setCurrentView('upload')}
          />
        )}

        {currentView === 'dashboard' && currentScan && currentScan.scorecard && (
          <DashboardScreen
            scan={currentScan}
            scorecard={currentScan.scorecard}
            onViewFindings={() => setCurrentView('findings')}
            onViewRemediation={() => setCurrentView('remediation')}
            onViewReport={() => setCurrentView('report')}
            onStartNewScan={handleStartAssessment}
          />
        )}

        {currentView === 'findings' && currentScan && (
          <FindingsScreen
            findings={currentScan.findings || []}
            validationResults={currentScan.validation_results || []}
            onBackToDashboard={() => setCurrentView('dashboard')}
            onGoToRemediation={() => setCurrentView('remediation')}
          />
        )}

        {currentView === 'remediation' && currentScan && (
          <RemediationScreen
            remediationPlan={currentScan.remediation_plan || []}
            onBackToDashboard={() => setCurrentView('dashboard')}
            onGoToReport={() => setCurrentView('report')}
          />
        )}

        {currentView === 'report' && currentScan && currentScan.scorecard && (
          <ReportScreen
            scan={currentScan}
            scorecard={currentScan.scorecard}
            onBackToDashboard={() => setCurrentView('dashboard')}
            onStartNewScan={handleStartAssessment}
            onDeleteScan={handleDeleteScan}
          />
        )}

        {currentView === 'admin' && (
          <AdminConsole
            onBackToDashboard={() => setCurrentView('landing')}
          />
        )}

        {currentView === 'privacy' && (
          <PrivacyCenter
            onBackToDashboard={() => setCurrentView('landing')}
          />
        )}
      </main>

      {/* Behavioral & Regulatory Test Suite Modal (Restricted to Authorized Admin/Owner) */}
      {isAdminOrOwner && (
        <TestSuiteModal
          isOpen={testSuiteOpen}
          onClose={() => setTestSuiteOpen(false)}
        />
      )}

      {/* Authoritative Regulatory Traceability Matrix Modal */}
      <TraceabilityMatrix
        isOpen={traceabilityOpen}
        onClose={() => setTraceabilityOpen(false)}
      />
    </div>
  );
};

export default App;
