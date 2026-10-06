/**
 * InvoiceReady v1.0 - Remediated Philippines Regulatory Rule Pack (PH-2026.2)
 * Reconciled against:
 * - Tax Reform for Acceleration and Inclusion (TRAIN) Law (RA 10963, Sec. 237 & 237-A)
 * - BIR Revenue Regulations (RR) No. 8-2022 (Electronic Invoicing / EIS Guidelines)
 * - Ease of Paying Taxes (EOPT) Act (Republic Act No. 11976) & RR No. 7-2024
 * - BIR Revenue Regulations (RR) No. 26-2025 (Updated Invoicing Standards)
 * - BIR Revenue Memorandum Circular (RMC) No. 98-2026 (Clarifications on Transition and Stamped Invoices)
 *
 * Specific Corrections (Requirements 27, 28, 29, 30, 31):
 * - Covered taxpayers under EIS: Large Taxpayer Service (LTS), Exporters, and E-Commerce sellers.
 * - Non-covered standard SMEs are subject to EOPT Invoicing standards, but mandatory EIS transmission
 *   applies specifically to covered categories through December 31, 2026.
 * - Stamped / Converted Official Receipts (striking through OR and stamping "INVOICE") issued during
 *   the transition period ending December 31, 2026 ARE RECOGNIZED AS VALID under RMC 98-2026 and RR 7-2024.
 */

import { RegulatoryRule, RulePackConfiguration, RuleState } from '../../engine/types';

export const PH_RULE_PACK_2_VERSION = 'PH-2026.2';

export const PH_PACK_2_CONFIG: RulePackConfiguration = {
  pack_id: 'PH-2026.2',
  jurisdiction: 'PH',
  version: '2.0.0',
  release_date: '2026-10-01',
  description: 'Reconciled Philippines rules under EOPT Act RA 11976, RR 26-2025, and RMC 98-2026.',
  dimension_weights: {
    INVOICE_STRUCTURE: 20,
    SELLER_IDENTITY: 15,
    BUYER_IDENTITY: 10,
    TAX_VAT_CALCULATION: 20,
    NUMBERING_DATES: 10,
    LINE_MASTER_DATA: 10,
    STRUCTURED_DATA_CAPABILITY: 10,
    TRANSMISSION_SYSTEM_READINESS: 5,
  },
  critical_gate_caps: {
    'PH-RULE-VAT-BREAKDOWN': 65,
    'PH-RULE-SELLER-TIN': 60,
  },
  mandatory_effective_dates: {
    phase_1_asp_selection: '2022-07-01',
    phase_1_live_mandate: '2022-07-01',
    eopt_transition_deadline: '2026-12-31',
  },
};

export const PH_RULES_V2: RegulatoryRule[] = [
  // -------------------------------------------------------------------------
  // 1. APPLICABILITY & COVERED TAXPAYER CATEGORIES (RR 8-2022 & RMC 98-2026)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-APPLICABILITY-EIS',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_2_VERSION,
    title: 'BIR EIS Covered Taxpayer Mandate (LTS, Exporters, and E-Commerce)',
    description:
      'Pursuant to Section 237-A of the Tax Code, RR No. 8-2022, and RMC No. 98-2026, mandatory electronic invoice issuance and transmission to the BIR EIS applies strictly to: (1) Large Taxpayers under LTS; (2) Exporters of goods and services; and (3) E-commerce merchants / digital marketplace sellers.',
    category: 'TRANSMISSION_SYSTEM_READINESS',
    severity: 'CRITICAL',
    effective_from: '2022-07-01',
    source_id: 'PH-SRC-BIR-RR-8-2022',
    source_locator: 'Section 2 (Coverage) & RMC 98-2026 Q&A 2',
    is_critical_gate: false,
    points_allocated: 5,
    evaluateApplicability: (profile) => profile.country === 'PH',
    evaluateRule: (invoice, profile) => {
      const isLTS = profile.taxpayer_category === 'LTS' || profile.revenue_band === 'ABOVE_1B_PHP';
      const isExporter = profile.taxpayer_category === 'EXPORTER' || profile.transaction_types.includes('EXPORT');
      const isEcommerce = profile.taxpayer_category === 'ECOMMERCE';

      if (isLTS || isExporter || isEcommerce) {
        const categoryLabel = isLTS ? 'Large Taxpayer Service' : isExporter ? 'Exporter' : 'E-Commerce Merchant';
        return {
          state: 'PASS',
          message: `Taxpayer falls under statutory BIR EIS Mandatory Category (${categoryLabel}). Mandatory transmission of e-invoices to BIR EIS within 3 days is legally required pursuant to Section 237-A and RR 8-2022.`,
          evidence_fields: ['profile.taxpayer_category', 'profile.revenue_band'],
          recommended_action:
            'Maintain authenticated API connection to BIR EIS and transmit all invoice payloads within 3 calendar days of issuance.',
          why_it_matters:
            'Mandated taxpayers failing to transmit sales data to BIR EIS are subject to statutory fines and penalties under Section 264 of the Tax Code.',
          implementation_steps: [
            'Obtain BIR EIS API credentials from the National Office / Large Taxpayers Service.',
            'Ensure daily automated transmission of JSON sales records.',
          ],
        };
      }

      return {
        state: 'PASS',
        message:
          'Standard SME taxpayer: Not within the mandatory EIS covered categories (LTS/Exporter/E-Commerce). Compliance governed by EOPT Act general invoicing rules; EIS participation remains voluntary through December 31, 2026.',
        evidence_fields: ['profile.taxpayer_category'],
        recommended_action:
          'Ensure invoices meet EOPT Act standards (Invoice title, 4-way VAT breakdown). Automated EIS integration remains optional until BIR issues subsequent expansion regulations.',
        why_it_matters:
          'Under RMC 98-2026, general non-covered taxpayers are not subject to immediate EIS transmission sanctions during the transition period.',
        implementation_steps: ['Standardize Invoice template formatting.'],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 2. SELLER TIN WITH BRANCH CODE (RR 8-2022 & RR 26-2025)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-SELLER-TIN',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_2_VERSION,
    title: 'Valid Seller TIN with 3 to 5 Digit Branch Code',
    description:
      'Section 6(1)(b) of RR No. 8-2022 and RR No. 26-2025 require the seller Taxpayer Identification Number (TIN) to be stated alongside the registered 3-to-5 digit Branch Code (e.g. 123-456-789-000). Invoices omitting the branch code fail statutory identification rules.',
    category: 'SELLER_IDENTITY',
    severity: 'CRITICAL',
    effective_from: '2022-07-01',
    source_id: 'PH-SRC-BIR-RR-8-2022',
    source_locator: 'Section 6(1)(b)',
    is_critical_gate: true,
    failure_score_cap: 60,
    points_allocated: 15,
    evaluateApplicability: (profile) => profile.country === 'PH',
    evaluateRule: (invoice, profile, system, evidenceMap) => {
      const sellerTin = invoice.seller.tax_id ? invoice.seller.tax_id.replace(/\s|-/g, '') : null;
      const branchCode = invoice.seller.branch_code;
      const evidence = evidenceMap['seller.tax_id'];

      // Low confidence review handling (Requirement 42)
      if (evidence && evidence.confidence_level === 'LOW') {
        return {
          state: 'REVIEW_REQUIRED',
          message: 'Seller TIN extraction confidence is low. Manual review required.',
          evidence_fields: ['seller.tax_id'],
          recommended_action: 'Confirm the seller TIN in the Extraction Review screen.',
          why_it_matters: 'Critical statutory field requires unambiguous validation.',
          implementation_steps: ['Verify TIN against BIR Form 2303 Certificate of Registration.'],
        };
      }

      if (!sellerTin) {
        return {
          state: 'FAIL',
          message: 'Missing Seller Taxpayer Identification Number (TIN) on invoice.',
          evidence_fields: ['seller.tax_id'],
          recommended_action: 'Display registered 9 or 12 digit TIN with branch code on invoice header.',
          why_it_matters: 'Invoices without seller TIN violate Section 237 of the Tax Code.',
          implementation_steps: ['Update invoice header with registered BIR Form 2303 TIN.'],
        };
      }

      const cleanDigits = sellerTin.replace(/\D/g, '');
      if (cleanDigits.length < 9) {
        return {
          state: 'FAIL',
          message: `Seller TIN "${sellerTin}" is invalid: must contain at least 9 numeric digits.`,
          evidence_fields: ['seller.tax_id'],
          recommended_action: 'Enter complete 9 or 12 digit BIR TIN.',
          why_it_matters: 'BIR EIS rejects payloads with truncated TINs.',
          implementation_steps: ['Verify Form 2303.'],
        };
      }

      const hasBranch = branchCode || cleanDigits.length >= 12;
      if (!hasBranch) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.6,
          message: `Seller TIN (${cleanDigits.slice(0, 9)}) is present, but missing the mandatory 3-to-5 digit Branch Code suffix (e.g. -00000 for Head Office).`,
          evidence_fields: ['seller.tax_id', 'seller.branch_code'],
          recommended_action: 'Append registered branch code suffix (e.g. -000 or -00000) to TIN.',
          why_it_matters: 'RR 8-2022 and RR 26-2025 mandate branch-level taxpayer identification.',
          implementation_steps: ['Configure TIN field to include branch suffix.'],
        };
      }

      return {
        state: 'PASS',
        message: `Valid Seller TIN and Branch Code detected (${cleanDigits.slice(0, 9)}-${branchCode || cleanDigits.slice(9)}) meeting RR 8-2022 standards.`,
        evidence_fields: ['seller.tax_id', 'seller.branch_code'],
        recommended_action: 'Maintain registered branch records.',
        why_it_matters: 'Ensures correct tax allocation and validation.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 3. EOPT ACT: INVOICE AS PRIMARY PROOF & CONVERTED-OR TREATMENT (RMC 98-2026)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-INVOICE-VERSUS-OR',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_2_VERSION,
    title: 'EOPT Act Invoice Designation & Transition Stamped-OR Treatment',
    description:
      'Under the Ease of Paying Taxes Act (RA 11976), RR No. 7-2024, and RMC No. 98-2026, the Invoice is the primary proof of sale. During the transition period ending December 31, 2026, unused Official Receipts converted by striking through "Official Receipt" and stamping "INVOICE" are recognized as legally valid for input tax claims.',
    category: 'INVOICE_STRUCTURE',
    severity: 'HIGH',
    effective_from: '2024-04-27',
    source_id: 'PH-SRC-BIR-RMC-98-2026',
    source_locator: 'Q&A 3, 4 & 5 (Transition Stamped-OR Rules)',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) => profile.country === 'PH',
    evaluateRule: (invoice, profile) => {
      const docType = invoice.metadata.document_type;
      const isConvertedOR = invoice.metadata.is_converted_official_receipt;
      const issueDate = invoice.invoice_dates.issue_date || '2026-01-01';

      // Case 1: Properly designated Invoice
      if (docType === 'TAX_INVOICE' || docType === 'COMMERCIAL_INVOICE') {
        return {
          state: 'PASS',
          message: 'Document correctly designated as an Invoice compliant with RA 11976 and RR 26-2025.',
          evidence_fields: ['metadata.document_type'],
          recommended_action: 'Maintain Invoice designation.',
          why_it_matters: 'Fully substantiates input VAT claims.',
          implementation_steps: [],
        };
      }

      // Case 2: Converted Official Receipt during Transition Period (Requirement 30)
      if (docType === 'OFFICIAL_RECEIPT' && isConvertedOR && issueDate <= '2026-12-31') {
        return {
          state: 'PASS',
          message:
            'Converted Official Receipt recognized: Unused Official Receipt converted by striking through "Official Receipt" and stamping "INVOICE" is legally valid to substantiate input tax through December 31, 2026 pursuant to RMC No. 98-2026.',
          evidence_fields: ['metadata.document_type', 'metadata.is_converted_official_receipt'],
          recommended_action:
            'Exhaust stamped OR inventory before December 31, 2026, and transition to newly printed Invoices for 2027.',
          why_it_matters:
            'RMC 98-2026 explicitly allows converted Official Receipts during the transition window to prevent business disruption.',
          implementation_steps: [
            'Maintain inventory log of converted ORs submitted to RDO.',
            'Procure newly printed Invoices prior to January 1, 2027.',
          ],
        };
      }

      // Case 2B: Expired Converted Official Receipt after Transition Window (Requirement 53, 54)
      if (docType === 'OFFICIAL_RECEIPT' && isConvertedOR && issueDate > '2026-12-31') {
        return {
          state: 'FAIL',
          message:
            'Expired Converted Official Receipt: The statutory transition period for using converted/stamped Official Receipts expired on December 31, 2026 pursuant to RMC No. 98-2026 and RR 7-2024. Effective January 1, 2027, all sales substantiation requires newly printed Invoices.',
          evidence_fields: ['metadata.document_type', 'metadata.is_converted_official_receipt', 'invoice_dates.issue_date'],
          recommended_action:
            'Issue newly printed Invoices compliant with RR 26-2025. Converted/stamped Official Receipts are strictly invalid after December 31, 2026.',
          why_it_matters:
            'Post-transition input tax claims based on converted Official Receipts are disallowed by the BIR pursuant to RMC 98-2026.',
          implementation_steps: [
            'Transition billing systems to newly printed Invoices immediately.',
          ],
        };
      }

      // Case 3: Unconverted Official Receipt issued after EOPT effective date
      if (docType === 'OFFICIAL_RECEIPT' && !isConvertedOR) {
        return {
          state: 'FAIL',
          message:
            'Unconverted Official Receipt detected. Under RA 11976 and RMC 98-2026, an unstamped Official Receipt cannot substantiate input tax. To be valid during transition, "Official Receipt" must be stricken through and stamped "INVOICE".',
          evidence_fields: ['metadata.document_type'],
          recommended_action:
            'Stamp unused Official Receipts with "INVOICE" and report inventory to your RDO, or issue newly printed Invoices.',
          why_it_matters:
            'Unconverted Official Receipts are treated merely as supplementary documents and are disallowed for VAT deduction.',
          implementation_steps: [
            'Stamp unused ORs with "INVOICE" as prescribed in RR 7-2024 and RMC 98-2026.',
            'Submit required inventory list of unused stamped receipts to your RDO.',
          ],
        };
      }

      return {
        state: 'PASS',
        message: 'Document title compliant with current transition guidelines.',
        evidence_fields: ['metadata.document_type'],
        recommended_action: 'Maintain standard invoice headers.',
        why_it_matters: 'Ensures tax validity.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 4. STATUTORY 4-WAY VAT BREAKDOWN (CRITICAL GATE: CAP 65)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-VAT-BREAKDOWN',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_2_VERSION,
    title: 'Statutory 4-Way VAT Breakdown (Vatable, 12% VAT, Exempt, Zero-Rated)',
    description:
      'Section 113 of the Tax Code, RR No. 8-2022, and RR No. 26-2025 require VAT-registered sellers to explicitly display: (1) Vatable Sales, (2) VAT Amount (12%), (3) VAT-Exempt Sales, and (4) Zero-Rated Sales. Combining all into one gross sum is non-compliant.',
    category: 'TAX_VAT_CALCULATION',
    severity: 'CRITICAL',
    effective_from: '2018-01-01',
    source_id: 'PH-SRC-BIR-RR-26-2025',
    source_locator: 'Section 4 & Tax Code Sec. 113',
    is_critical_gate: true,
    failure_score_cap: 65,
    points_allocated: 20,
    evaluateApplicability: (profile) => profile.country === 'PH' && profile.vat_registered,
    evaluateRule: (invoice) => {
      const totals = invoice.totals;
      const hasTaxTotal = totals.tax_total !== null && totals.tax_total !== undefined;
      const hasVatable = totals.vatable_sales !== null && totals.vatable_sales !== undefined;

      if (!hasTaxTotal || totals.tax_total === null) {
        return {
          state: 'FAIL',
          message: 'Missing explicit 12% Value Added Tax amount breakdown line.',
          evidence_fields: ['totals.tax_total'],
          recommended_action: 'Display distinct numerical line for 12% VAT in the invoice summary.',
          why_it_matters:
            'VAT must be billed as a separate item under Section 113. Failure triggers Critical Gate score cap of 65.',
          implementation_steps: ['Update invoice template summary to explicitly separate net sales and 12% VAT.'],
        };
      }

      if (!hasVatable) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.6,
          message:
            'VAT amount is indicated, but distinct "Vatable Sales" base is not separated from Exempt and Zero-Rated sales categories.',
          evidence_fields: ['totals.vatable_sales', 'totals.tax_total'],
          recommended_action:
            'Separate invoice summary into: Vatable Sales, VAT Amount, VAT-Exempt Sales, and Zero-Rated Sales.',
          why_it_matters:
            'BIR EIS transmission schema mandates individual XML/JSON elements for each of the four sales categories.',
          implementation_steps: ['Configure accounting software summary layout.'],
        };
      }

      return {
        state: 'PASS',
        message: 'Statutory 4-way VAT breakdown meets Section 113 and RR 26-2025 requirements.',
        evidence_fields: ['totals.vatable_sales', 'totals.tax_total'],
        recommended_action: 'Maintain automated subtotal calculations.',
        why_it_matters: 'Ensures immediate compliance with EIS validation rules.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 5. BUYER REGISTERED DETAILS FOR B2B >= PHP 1,000
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-BUYER-INFO',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_2_VERSION,
    title: 'Buyer Registered Name, TIN, and Address (B2B >= PHP 1,000)',
    description:
      'Pursuant to RR No. 8-2022 and RR No. 26-2025, commercial invoices issued to registered taxpayers or transactions >= PHP 1,000 must state the buyer Registered Legal Name, TIN with branch code, and Registered Address.',
    category: 'BUYER_IDENTITY',
    severity: 'HIGH',
    effective_from: '2018-01-01',
    source_id: 'PH-SRC-BIR-RR-26-2025',
    source_locator: 'Section 4(2)',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) =>
      profile.country === 'PH' && profile.transaction_types.some((t) => t === 'B2B' || t === 'B2G'),
    evaluateRule: (invoice) => {
      const buyerName = invoice.buyer.legal_name;
      const buyerTin = invoice.buyer.tax_id;
      const buyerAddress = invoice.buyer.address;

      if (!buyerTin) {
        return {
          state: 'FAIL',
          message: 'Missing Buyer TIN on B2B transaction.',
          evidence_fields: ['buyer.tax_id'],
          recommended_action: 'Record Buyer 9/12 digit TIN on all B2B and corporate invoices.',
          why_it_matters:
            'Without the buyer TIN, the purchasing entity cannot substantiate VAT input tax credits under audit.',
          implementation_steps: ['Require customer TIN entry during business onboarding.'],
        };
      }

      if (!buyerName || !buyerAddress) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.6,
          message: 'Buyer TIN detected, but registered corporate name or registered business address is incomplete.',
          evidence_fields: ['buyer.legal_name', 'buyer.address'],
          recommended_action: 'Ensure full registered trade name and official address are displayed.',
          why_it_matters: 'BIR cross-audit matching (SLSP) requires matching TIN and address records.',
          implementation_steps: ['Standardize client master records.'],
        };
      }

      return {
        state: 'PASS',
        message: `Valid Buyer identification detected (${buyerName}, TIN: ${buyerTin}).`,
        evidence_fields: ['buyer.tax_id', 'buyer.legal_name'],
        recommended_action: 'Maintain client master data.',
        why_it_matters: 'Guarantees buyer VAT deductibility.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 6. BIR EIS REAL-TIME TRANSMISSION (WITHIN 3 CALENDAR DAYS - REVALIDATED)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-EIS-TRANSMISSION',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_2_VERSION,
    title: 'BIR EIS Real-Time API Transmission Readiness (3 Calendar Days)',
    description:
      'Revalidated under Section 4 of RR No. 8-2022 and RMC No. 98-2026: Covered taxpayers must transmit sales records in standardized JSON format to the BIR EIS within three (3) calendar days from the date of invoice issuance.',
    category: 'TRANSMISSION_SYSTEM_READINESS',
    severity: 'HIGH',
    effective_from: '2022-07-01',
    source_id: 'PH-SRC-BIR-RR-8-2022',
    source_locator: 'Section 4 (Submission Deadline) & Annex A',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) => {
      // Reconciled: Applies strictly to covered taxpayers (Requirement 28)
      const isLTS = profile.taxpayer_category === 'LTS' || profile.revenue_band === 'ABOVE_1B_PHP';
      const isExporter = profile.taxpayer_category === 'EXPORTER' || profile.transaction_types.includes('EXPORT');
      const isEcommerce = profile.taxpayer_category === 'ECOMMERCE';
      return profile.country === 'PH' && (isLTS || isExporter || isEcommerce);
    },
    evaluateRule: (invoice, profile, system) => {
      if (system.electronic_transmission_capability || system.structured_export_capability) {
        return {
          state: 'PASS',
          message: 'System capability to format and transmit standardized JSON payloads to BIR EIS within 3 calendar days established.',
          evidence_fields: ['system.electronic_transmission_capability'],
          recommended_action: 'Conduct regular batch audits to ensure transmission occurs within the 3-day window.',
          why_it_matters: 'Transmissions beyond 3 days are recorded as late submissions in BIR EIS.',
          implementation_steps: ['Schedule automated daily batch transmission.'],
        };
      }

      return {
        state: 'FAIL',
        message: 'No automated JSON export or API transmission channel configured. Mandated taxpayers must report to BIR EIS within 3 calendar days.',
        evidence_fields: ['system.electronic_transmission_capability', 'system.structured_export_capability'],
        recommended_action: 'Implement BIR EIS JSON middleware conforming to RR 8-2022 Annex A.',
        why_it_matters: 'Non-transmission carries statutory penalties for covered taxpayers.',
        implementation_steps: ['Deploy API integration with the BIR EIS portal.'],
      };
    },
  },
];
