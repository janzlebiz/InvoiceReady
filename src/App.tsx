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
  CanonicalInvoice,
  ExtractedFieldEvidence,
} from './engine/types';
import { RuleRegistry } from './rules/ruleRegistry';
import { ApplicabilityEngine } from './engine/applicabilityEngine';
import { RuleEngine } from './engine/ruleEngine';
import { ScoringEngine } from './engine/scoringEngine';
import { ClientExtractor } from './services/clientExtractor';
import { SAMPLE_INVOICES } from './engine/sampleInvoices';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('landing');
  const [testSuiteOpen, setTestSuiteOpen] = useState<boolean>(false);
  const [traceabilityOpen, setTraceabilityOpen] = useState<boolean>(false);

  // Assessment flow states
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<JurisdictionCode>('AE');

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    id: 'bp_session',
    organization_id: 'org_main',
    country: 'AE',
    business_name: 'Al-Noor Technologies Trading LLC',
    trade_name: 'Al-Noor Tech',
    tax_identifier: '100456789012345',
    vat_registered: true,
    revenue_band: 'ABOVE_50M_AED',
    transaction_types: ['B2B'],
    branch_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const [systemProfile, setSystemProfile] = useState<SystemProfile>({
    id: 'sys_session',
    organization_id: 'org_main',
    accounting_system: 'CUSTOM_ERP',
    invoicing_system: 'CUSTOM_ERP',
    current_invoice_format: 'XML_UBL',
    structured_export_capability: true,
    electronic_transmission_capability: true,
    asp_partner_selected: true,
    number_of_invoice_templates: 1,
  });

  const [uploadedDocument, setUploadedDocument] = useState<{
    fileName: string;
    fileSize: number;
    mimeType: string;
    rawText: string;
  }>({
    fileName: 'AE-COMPLIANT-B2B.pdf',
    fileSize: 4200,
    mimeType: 'application/pdf',
    rawText: SAMPLE_INVOICES[0].rawDocumentText,
  });

  const [currentExtraction, setCurrentExtraction] = useState<ExtractionResult | null>(null);
  const [currentScan, setCurrentScan] = useState<ScanSession | null>(null);

  // Transition handlers
  const handleSelectJurisdiction = (jur: JurisdictionCode) => {
    setSelectedJurisdiction(jur);
    setBusinessProfile((prev) => ({
      ...prev,
      country: jur,
      business_name: jur === 'AE' ? 'Al-Noor Technologies Trading LLC' : 'Manila Enterprise Systems Inc.',
      tax_identifier: jur === 'AE' ? '100456789012345' : '004-987-654-00000',
      revenue_band: jur === 'AE' ? 'ABOVE_50M_AED' : 'ABOVE_1B_PHP',
      taxpayer_category: jur === 'AE' ? undefined : 'LTS',
    }));
    setSystemProfile((prev) => ({
      ...prev,
      asp_partner_selected: jur === 'AE',
      cas_permit_active: jur === 'PH',
    }));
  };

  const handleStartAssessment = () => {
    setCurrentView('country-select');
  };

  const handleStartProcessing = () => {
    setCurrentView('processing');
  };

  const handleProcessingComplete = async () => {
    // Run live server extraction or client-safe parser
    const scanId = `scan_${Date.now().toString(36)}`;
    const extraction = await ClientExtractor.extractInvoice(
      uploadedDocument.fileName,
      uploadedDocument.rawText,
      uploadedDocument.mimeType,
      scanId
    );
    setCurrentExtraction(extraction);
    setCurrentView('extraction-review');
  };

  const handleConfirmExtraction = (
    updatedInvoice: CanonicalInvoice,
    updatedEvidence: Record<string, ExtractedFieldEvidence>
  ) => {
    const scanId = currentExtraction?.scan_id || `scan_${Date.now().toString(36)}`;

    // 1. Determine Applicability BEFORE scoring (TSD-020)
    const applicability = ApplicabilityEngine.determineApplicability(
      businessProfile,
      systemProfile
    );

    // 2. Deterministic rule validation
    const execution = RuleEngine.executeRules(
      applicability.applicable_rules,
      updatedInvoice,
      businessProfile,
      systemProfile,
      updatedEvidence
    );

    // 3. Readiness Scoring & Critical Gates
    const scorecard = ScoringEngine.calculateScorecard(
      execution.validationResults,
      execution.findings,
      applicability.applicable_rules.length
    );

    const scanSession: ScanSession = {
      scan_id: scanId,
      organization_id: businessProfile.organization_id,
      jurisdiction: businessProfile.country,
      business_profile: businessProfile,
      system_profile: systemProfile,
      status: 'COMPLETED',
      document_name: uploadedDocument.fileName,
      document_size_bytes: uploadedDocument.fileSize,
      document_mime_type: uploadedDocument.mimeType,
      document_hash: `sha256:${Date.now().toString(36)}`,
      storage_path: `/storage/${uploadedDocument.fileName}`,
      uploaded_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      extraction_result: currentExtraction || undefined,
      applicable_rules: applicability.applicable_rules.map((r) => r.rule_id),
      validation_results: execution.validationResults,
      scorecard: scorecard,
      findings: execution.findings,
      remediation_plan: execution.remediationActions,
      rule_pack_version: RuleRegistry.getPackVersion(businessProfile.country),
    };

    setCurrentScan(scanSession);
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
          <InvoiceUpload
            jurisdiction={selectedJurisdiction}
            onFileSelected={(data) => setUploadedDocument(data)}
            onContinue={handleStartProcessing}
            onBack={() => setCurrentView('system-assessment')}
          />
        )}

        {currentView === 'processing' && (
          <ProcessingScreen
            documentName={uploadedDocument.fileName}
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
            onDeleteScan={handleDeleteScan}
            onStartNewScan={handleStartAssessment}
          />
        )}

        {currentView === 'admin' && <AdminConsole />}

        {currentView === 'privacy' && <PrivacyCenter />}
      </main>

      {/* Test Suite Modal */}
      <TestSuiteModal isOpen={testSuiteOpen} onClose={() => setTestSuiteOpen(false)} />

      {/* Traceability Matrix Modal */}
      <TraceabilityMatrix isOpen={traceabilityOpen} onClose={() => setTraceabilityOpen(false)} />
    </div>
  );
};
export default App;
