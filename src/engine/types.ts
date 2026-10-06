/**
 * InvoiceReady v1.0 - Core Canonical Types & Interfaces
 * Authoritative Frozen Baseline Specification (Production Remediated)
 */

// ---------------------------------------------------------------------------
// 1. CANONICAL INVOICE MODEL (Section 10)
// ---------------------------------------------------------------------------

export interface InvoiceParty {
  legal_name: string | null;
  trade_name?: string | null;
  tax_id: string | null; // TRN (UAE) or TIN (Philippines)
  branch_code?: string | null; // BIR 3-5 digit branch code
  address: {
    street?: string | null;
    city?: string | null;
    state_province?: string | null;
    postal_code?: string | null;
    country: string; // ISO 2-letter, e.g. "AE" or "PH"
  } | null;
  registration_ids?: {
    commercial_register?: string | null;
    dti_sec_registration?: string | null;
    business_license?: string | null;
  };
  contact_information?: {
    email?: string | null;
    phone?: string | null;
  };
}

export interface InvoiceLine {
  line_number: number;
  description: string;
  product_code?: string | null;
  quantity: number | null;
  unit?: string | null;
  unit_price: number | null;
  discount?: number | null;
  tax_category?: 'STANDARD' | 'ZERO_RATED' | 'EXEMPT' | 'OUT_OF_SCOPE' | 'VATABLE' | null;
  tax_rate: number | null; // e.g. 0.05 for UAE, 0.12 for PH
  tax_amount: number | null;
  line_total: number | null;
}

export interface InvoiceTaxSubtotal {
  taxable_amount: number;
  tax_rate: number;
  tax_amount: number;
  category: string; // e.g. 'STANDARD_5%', 'VATABLE_12%', 'ZERO_RATED', 'EXEMPT'
  currency: string;
}

export interface InvoiceTotals {
  subtotal: number | null;
  discount_total: number | null;
  charge_total: number | null;
  tax_total: number | null;
  grand_total: number | null;
  amount_due: number | null;
  vatable_sales?: number | null; // Required under PH BIR
  vat_exempt_sales?: number | null;
  zero_rated_sales?: number | null;
}

export interface CanonicalInvoice {
  invoice_id: string;
  source_document_id: string;
  metadata: {
    document_type:
      | 'TAX_INVOICE'
      | 'SIMPLIFIED_TAX_INVOICE'
      | 'COMMERCIAL_INVOICE'
      | 'OFFICIAL_RECEIPT'
      | 'CREDIT_NOTE'
      | 'UNKNOWN';
    format: 'PDF_SCANNED' | 'PDF_NATIVE' | 'IMAGE' | 'XML_UBL' | 'JSON' | 'SPREADSHEET';
    structured_export_available: boolean;
    page_count: number;
    // Model Philippine transition states (Requirement 30, RMC 98-2026 / RR 7-2024)
    is_converted_official_receipt?: boolean; // True if stamped/converted to "Invoice" during transition
    conversion_stamp_text?: string | null;
  };
  identifiers: {
    invoice_number: string | null;
    reference_number?: string | null;
    serial_number?: string | null;
    cas_accreditation_number?: string | null; // BIR CAS permit
    ptu_atp_number?: string | null; // BIR Permit to Use / Authority to Print
  };
  invoice_dates: {
    issue_date: string | null; // ISO YYYY-MM-DD
    supply_date?: string | null;
    due_date?: string | null;
  };
  currency: {
    invoice_currency: string; // e.g. "AED", "PHP", "USD"
    tax_currency: string; // "AED" or "PHP"
    exchange_rate?: number | null;
  };
  seller: InvoiceParty;
  buyer: InvoiceParty;
  lines: InvoiceLine[];
  taxes: {
    tax_total: number | null;
    subtotals: InvoiceTaxSubtotal[];
  };
  totals: InvoiceTotals;
  payment?: {
    payment_means_code?: string | null;
    payee_account?: string | null;
    terms?: string | null;
  };
  supporting_information?: {
    notes?: string | null;
    qr_code_present?: boolean;
    qr_code_data?: string | null;
    peppol_pint_ready?: boolean;
  };
}

// ---------------------------------------------------------------------------
// 2. EVIDENCE MODEL (Section 11)
// ---------------------------------------------------------------------------

export type ExtractionConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ExtractedFieldEvidence {
  field: string;
  original_label?: string | null;
  original_value: string | number | null;
  normalized_value: any;
  confidence: number; // 0.00 to 1.00
  confidence_level: ExtractionConfidenceLevel;
  source_document: string;
  page: number;
  source_region?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } | null;
  extraction_method: 'GEMINI_AI' | 'HEURISTIC' | 'USER_CONFIRMED';
  user_modified?: boolean;
}

export interface DocumentPageExtraction {
  page_number: number;
  text_length: number;
  fields_found: number;
}

export interface ExtractionResult {
  scan_id: string;
  document_id: string;
  raw_text?: string;
  pages?: DocumentPageExtraction[];
  canonical_invoice: CanonicalInvoice;
  evidence_map: Record<string, ExtractedFieldEvidence>;
  uncertain_fields: string[];
  extraction_duration_ms: number;
  prompt_injection_flagged: boolean;
  status: 'EXTRACTED' | 'REVIEW_REQUIRED' | 'FAILED';
  error_message?: string;
}

// ---------------------------------------------------------------------------
// 3. BUSINESS & SYSTEM PROFILE (PRD-042, Screen 03 & 04)
// ---------------------------------------------------------------------------

export type JurisdictionCode = 'AE' | 'PH';

export type UAEPhase = 'PHASE_1' | 'PHASE_2' | 'VOLUNTARY' | 'NOT_APPLICABLE';
export type PHTaxpayerCategory = 'LTS' | 'EXPORTER' | 'ECOMMERCE' | 'CAS_USER' | 'SME_STANDARD' | 'MICRO_NON_VAT';

export interface BusinessProfile {
  id: string;
  organization_id: string;
  country: JurisdictionCode;
  business_name: string;
  trade_name?: string;
  tax_identifier: string; // TRN (15 digits) or TIN (9/12 digits + branch)
  vat_registered: boolean;
  revenue_band:
    | 'ABOVE_50M_AED' // UAE Phase 1 threshold
    | 'BELOW_50M_AED'
    | 'ABOVE_1B_PHP' // PH Large Taxpayer
    | 'ABOVE_100M_PHP'
    | 'ABOVE_3M_PHP' // PH VAT threshold
    | 'MICRO_BELOW_3M_PHP';
  // Precise boundary comparison (Requirement 25)
  annual_turnover_amount?: number;
  transaction_types: ('B2B' | 'B2G' | 'B2C' | 'EXPORT')[];
  taxpayer_category?: UAEPhase | PHTaxpayerCategory;
  // Model Philippine transition states (Requirement 29)
  ph_transition_status?: 'PRE_EOPT' | 'IN_TRANSITION' | 'POST_TRANSITION';
  branch_count: number;
  created_at: string;
  updated_at: string;
}

export type AccountingSystemChoice =
  | 'QUICKBOOKS'
  | 'XERO'
  | 'ODOO'
  | 'EXCEL'
  | 'GOOGLE_SHEETS'
  | 'POS'
  | 'CUSTOM_ERP'
  | 'CUSTOM_INVOICING'
  | 'OTHER';

export interface SystemProfile {
  id: string;
  organization_id: string;
  accounting_system: AccountingSystemChoice;
  invoicing_system: AccountingSystemChoice;
  pos_erp_name?: string;
  current_invoice_format: 'PDF' | 'PRINTED_PAPER' | 'EXCEL' | 'XML_UBL' | 'JSON' | 'HYBRID';
  structured_export_capability: boolean; // Can produce XML/JSON
  electronic_transmission_capability: boolean; // API / ASP / PEPPOL
  asp_partner_selected?: boolean;
  asp_partner_name?: string;
  cas_permit_active?: boolean; // Philippines BIR CAS
  number_of_invoice_templates: number;
}

// ---------------------------------------------------------------------------
// 4. REGULATORY RULE ENGINE & SOURCES (Sections 12-16)
// ---------------------------------------------------------------------------

export type RuleState =
  | 'PASS'
  | 'FAIL'
  | 'PARTIAL'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN'
  | 'REVIEW_REQUIRED';

export type RuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type RuleCategory =
  | 'INVOICE_STRUCTURE'
  | 'SELLER_IDENTITY'
  | 'BUYER_IDENTITY'
  | 'TAX_VAT_CALCULATION'
  | 'NUMBERING_DATES'
  | 'LINE_MASTER_DATA'
  | 'STRUCTURED_DATA_CAPABILITY'
  | 'TRANSMISSION_SYSTEM_READINESS';

export interface RegulatorySource {
  source_id: string;
  jurisdiction: JurisdictionCode;
  authority: string; // e.g. "Ministry of Finance (UAE)", "Bureau of Internal Revenue (BIR)"
  document_title: string;
  document_number: string; // e.g. "Cabinet Decision No. 91/2023", "RR No. 26-2025"
  publication_date: string;
  effective_date: string;
  url: string;
  // Requirement 33 & 34: Real cryptographic SHA-256 hash, retrieval date, version
  source_hash: string;
  retrieved_at: string;
  document_version: string;
  exact_locator: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'REPEALED' | 'DRAFT' | 'REFERENCE_ONLY';
}

export interface RulePackConfiguration {
  pack_id: string;
  jurisdiction: JurisdictionCode;
  version: string;
  release_date: string;
  description: string;
  dimension_weights: Record<RuleCategory, number>;
  critical_gate_caps: Record<string, number>;
  mandatory_effective_dates: {
    phase_1_asp_selection: string;
    phase_1_live_mandate: string;
    phase_2_asp_selection?: string;
    phase_2_live_mandate?: string;
    eopt_transition_deadline?: string;
  };
}

export interface RegulatoryRule {
  rule_id: string;
  jurisdiction: JurisdictionCode;
  pack_version: string; // e.g. "AE-2026.2", "PH-2026.2"
  title: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  effective_from: string;
  effective_until?: string | null;
  source_id: string;
  source_locator: string; // e.g. "Ministerial Decision 145/2024 Art. 3", "RMC 98-2026 Q&A 4"
  is_critical_gate: boolean;
  failure_score_cap?: number; // Caps overall score if this rule fails (e.g. 69)
  points_allocated: number; // Dimension weight contribution

  // Deterministic validation functions
  evaluateApplicability: (profile: BusinessProfile, system: SystemProfile) => boolean;
  evaluateRule: (
    invoice: CanonicalInvoice,
    profile: BusinessProfile,
    system: SystemProfile,
    evidenceMap: Record<string, ExtractedFieldEvidence>
  ) => {
    state: RuleState;
    message: string;
    evidence_fields: string[];
    partial_score_ratio?: number; // 0.0 to 1.0
    recommended_action: string;
    why_it_matters: string;
    implementation_steps: string[];
  };
}

export interface RuleValidationResult {
  rule_id: string;
  pack_version: string;
  title: string;
  category: RuleCategory;
  severity: RuleSeverity;
  state: RuleState;
  score_awarded: number;
  points_possible: number;
  message: string;
  evidence_fields: string[];
  source_id: string;
  source_locator: string;
  is_critical_gate: boolean;
  failure_score_cap?: number;
  why_it_matters: string;
  recommended_action: string;
  implementation_steps: string[];
}

// ---------------------------------------------------------------------------
// 5. READINESS SCORE & FINDINGS (Sections 17-22, Requirement 46-48)
// ---------------------------------------------------------------------------

export type ScoreClassification =
  | 'READY' // 90-100
  | 'MOSTLY_READY' // 75-89
  | 'NEEDS_ATTENTION' // 60-74
  | 'SIGNIFICANT_GAPS' // 40-59
  | 'NOT_READY' // 0-39
  | 'REVIEW_REQUIRED'; // Critical evidence uncertain

export interface DimensionScore {
  dimension: RuleCategory;
  label: string;
  weight: number;
  points_earned: number;
  percentage: number;
  applicable_rules_count: number;
  passed_rules_count: number;
  failed_rules_count: number;
  review_required_count?: number;
}

export interface Scorecard {
  overall_score: number | null; // null if definitive score blocked by REVIEW_REQUIRED
  raw_calculated_score: number;
  classification: ScoreClassification;
  definitive_score_blocked: boolean;
  critical_gate_triggered: boolean;
  critical_gate_cap?: number;
  critical_gate_reason?: string;
  dimensions: DimensionScore[];
  rules_summary: {
    total: number;
    applicable: number;
    passed: number;
    partial: number;
    failed: number;
    not_applicable: number;
    unknown: number;
    review_required: number;
  };
  findings_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface Finding {
  finding_id: string;
  rule_id: string;
  severity: RuleSeverity;
  title: string;
  description: string;
  category: RuleCategory;
  state: RuleState;
  evidence: {
    fields: string[];
    values: Record<string, any>;
  };
  impact: string;
  why_it_matters: string;
  recommended_action: string;
  implementation_steps: string[];
  regulatory_source: {
    authority: string;
    document_title: string;
    document_number: string;
    locator: string;
    url: string;
    source_hash: string;
    document_version: string;
  };
  pack_version: string;
}

export interface RemediationAction {
  action_id: string;
  finding_id: string;
  rule_id: string;
  title: string;
  category: RuleCategory;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  problem: string;
  why_it_matters: string;
  what_to_change: string;
  suggested_implementation: string[];
  owner_role: 'FINANCE' | 'IT_DEVELOPER' | 'BILLING_OPS' | 'LEGAL_TAX';
  estimated_timeline_days: number;
}

// ---------------------------------------------------------------------------
// 6. SCAN PIPELINE & LIFECYCLE (Section 30, 31, Requirement 10, 12)
// ---------------------------------------------------------------------------

export type ScanStatus =
  | 'CREATED'
  | 'QUARANTINED'
  | 'SECURITY_VALIDATING'
  | 'SECURITY_PASSED'
  | 'SECURITY_REJECTED'
  | 'EXTRACTING'
  | 'REVIEW_REQUIRED'
  | 'NORMALIZING'
  | 'VALIDATING'
  | 'SCORING'
  | 'REPORTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DELETED';

export interface ScanSession {
  scan_id: string;
  organization_id: string;
  jurisdiction: JurisdictionCode;
  business_profile: BusinessProfile;
  system_profile: SystemProfile;
  status: ScanStatus;
  document_name?: string;
  document_size_bytes?: number;
  document_mime_type?: string;
  document_hash?: string;
  storage_path?: string;
  security_scan_result?: {
    passed: boolean;
    malware_clean: boolean;
    structural_integrity_clean: boolean;
    findings: string[];
    scanned_at: string;
  };
  uploaded_at?: string;
  completed_at?: string;
  extraction_result?: ExtractionResult;
  applicable_rules?: string[];
  validation_results?: RuleValidationResult[];
  scorecard?: Scorecard;
  findings?: Finding[];
  remediation_plan?: RemediationAction[];
  rule_pack_version: string;
  error_message?: string;
}

// ---------------------------------------------------------------------------
// 7. PRIVACY, CONSENT & AUDIT (Sections 35, 36, 50, 59, Requirement 14, 15)
// ---------------------------------------------------------------------------

export interface CookieConsentPreferences {
  consent_id: string;
  organization_id: string;
  user_id?: string;
  timestamp: string;
  policy_version: string;
  necessary: boolean; // Always true
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  jurisdiction_context: JurisdictionCode;
}

export interface PrivacyRequest {
  request_id: string;
  organization_id: string;
  requester_email: string;
  request_type: 'ACCESS' | 'CORRECTION' | 'DELETION' | 'EXPORT';
  status: 'PENDING' | 'VERIFIED' | 'COMPLETED' | 'REJECTED';
  received_at: string;
  completed_at?: string;
}

export interface AuditLogEntry {
  log_id: string;
  actor: string;
  organization_id: string;
  action:
    | 'USER_LOGIN'
    | 'SCAN_CREATED'
    | 'DOCUMENT_UPLOADED'
    | 'SECURITY_SCAN_PASSED'
    | 'SECURITY_SCAN_FAILED'
    | 'EXTRACTION_COMPLETED'
    | 'EVIDENCE_MODIFIED'
    | 'DOCUMENT_DELETED'
    | 'DOCUMENT_RETENTION_PURGED'
    | 'RULE_PACK_PUBLISHED'
    | 'REPORT_GENERATED'
    | 'PRIVACY_REQUEST_CREATED'
    | 'CONSENT_UPDATED'
    | 'UNAUTHORIZED_ACCESS_ATTEMPT';
  resource_id: string;
  timestamp: string;
  result: 'SUCCESS' | 'FAILURE';
  ip_address: string;
  metadata?: Record<string, any>;
}

export interface TestCaseResult {
  testId: string;
  category: 'SECURITY' | 'TENANT_ISOLATION' | 'REGULATORY' | 'CRITICAL_GATE' | 'AI_EXTRACTION' | 'PRIVACY';
  name: string;
  mappedRequirementId: string;
  status: 'PASS' | 'FAIL';
  executionTimeMs: number;
  details: string;
}

export interface TestSuiteOutcome {
  results: TestCaseResult[];
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
}
