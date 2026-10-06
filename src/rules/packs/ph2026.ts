/**
 * InvoiceReady v1.0 - Philippines Regulatory Rule Pack (PH-2026.1)
 * Authoritative Regulatory Hierarchy:
 * - Tax Reform for Acceleration and Inclusion (TRAIN) Law (RA 10963, Sec. 237 & 237-A)
 * - BIR Revenue Regulations (RR) No. 8-2022 (Electronic Invoicing / EIS Guidelines)
 * - BIR Revenue Memorandum Order (RMO) No. 24-2022 (EIS Pilot & JSON Specifications)
 * - Ease of Paying Taxes (EOPT) Act (RA 11976) & RR No. 7-2024
 */

import { RegulatoryRule } from '../../engine/types';

export const PH_RULE_PACK_VERSION = 'PH-2026.1';

export const PH_RULES: RegulatoryRule[] = [
  // -------------------------------------------------------------------------
  // 1. APPLICABILITY & COVERED TAXPAYER CATEGORY (PRD-030, PRD-031)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-APPLICABILITY-EIS',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_VERSION,
    title: 'BIR Electronic Invoicing / Receipting System (EIS) Coverage Classification',
    description:
      'Under Section 237-A of the Tax Code (TRAIN Act) and RR No. 8-2022, mandatory transmission to BIR EIS applies to: (1) Large Taxpayers under LTS; (2) Exporters of goods and services; and (3) E-commerce merchants / digital marketplace sellers.',
    category: 'TRANSMISSION_SYSTEM_READINESS',
    severity: 'CRITICAL',
    effective_from: '2022-07-01',
    source_id: 'PH-SRC-BIR-RR-8-2022',
    source_locator: 'Section 2 (Coverage) & RMO 24-2022',
    is_critical_gate: false,
    points_allocated: 5,
    evaluateApplicability: (profile) => profile.country === 'PH',
    evaluateRule: (invoice, profile) => {
      const isLTS = profile.taxpayer_category === 'LTS' || profile.revenue_band === 'ABOVE_1B_PHP';
      const isExporter = profile.taxpayer_category === 'EXPORTER' || profile.transaction_types.includes('EXPORT');
      const isEcommerce = profile.taxpayer_category === 'ECOMMERCE';

      if (isLTS || isExporter || isEcommerce) {
        return {
          state: 'PASS',
          message: `Taxpayer falls under BIR EIS Mandatory Category (${
            isLTS ? 'Large Taxpayer Service' : isExporter ? 'Exporter' : 'E-Commerce Merchant'
          }). Mandated to issue e-invoices and transmit real-time data to BIR EIS.`,
          evidence_fields: ['profile.taxpayer_category', 'profile.revenue_band'],
          recommended_action:
            'Maintain API connection to BIR EIS and ensure 3-day transmission window is strictly observed.',
          why_it_matters:
            'Non-transmission of required sales records to BIR EIS carries statutory penalties under Section 264 of the Tax Code.',
          implementation_steps: [
            'Obtain EIS developer credentials and API token from BIR Large Taxpayers Assistance Division.',
            'Integrate automated JSON payload transmission into daily billing batch.',
          ],
        };
      }

      return {
        state: 'PASS',
        message:
          'Standard SME taxpayer: Currently under transition phase. Voluntary EIS participation available; mandatory compliance under EOPT Act requires standardized invoicing format.',
        evidence_fields: ['profile.taxpayer_category'],
        recommended_action:
          'Ensure invoices comply with EOPT Act format and prepare CAS / accounting software for upcoming EIS phases.',
        why_it_matters:
          'Standardizing now prevents costly retrofitting when BIR extends EIS to general VAT taxpayers.',
        implementation_steps: ['Update invoice layouts to include statutory 4-way VAT breakdown.'],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 2. SELLER TIN & BRANCH CODE (9/12 digits + branch code)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-SELLER-TIN',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_VERSION,
    title: 'Valid Seller TIN with 3 to 5 Digit Branch Code',
    description:
      'RR No. 8-2022 Section 6 requires the seller Taxpayer Identification Number (TIN) to be displayed with the registered 3-to-5 digit Branch Code (e.g. 123-456-789-000 for Head Office or 001 for Branch). TIN alone without branch code is rejected by EIS.',
    category: 'SELLER_IDENTITY',
    severity: 'CRITICAL',
    effective_from: '2022-07-01',
    source_id: 'PH-SRC-BIR-RR-8-2022',
    source_locator: 'Section 6(1)(b) & EIS Data Dictionary',
    is_critical_gate: true,
    failure_score_cap: 60,
    points_allocated: 15,
    evaluateApplicability: (profile) => profile.country === 'PH',
    evaluateRule: (invoice) => {
      const sellerTin = invoice.seller.tax_id ? invoice.seller.tax_id.replace(/\s|-/g, '') : null;
      const branchCode = invoice.seller.branch_code;

      if (!sellerTin) {
        return {
          state: 'FAIL',
          message: 'Missing Seller Taxpayer Identification Number (TIN).',
          evidence_fields: ['seller.tax_id'],
          recommended_action: 'Display your official BIR-registered 9 or 12 digit TIN with branch code on invoice.',
          why_it_matters: 'Invoices without registered TIN are void under Philippine Tax Code Section 237.',
          implementation_steps: ['Update invoice header with registered BIR Certificate of Registration (Form 2303) TIN.'],
        };
      }

      // Check format: 9 to 12 digits, plus branch code
      const hasBranch = branchCode || sellerTin.length >= 12;
      const cleanDigits = sellerTin.replace(/\D/g, '');

      if (cleanDigits.length < 9) {
        return {
          state: 'FAIL',
          message: `Seller TIN "${sellerTin}" is invalid: must be at least 9 numeric digits.`,
          evidence_fields: ['seller.tax_id'],
          recommended_action: 'Enter full 9 or 12 digit BIR TIN.',
          why_it_matters: 'TIN verification is mandatory in BIR EIS JSON schema.',
          implementation_steps: ['Check Form 2303.'],
        };
      }

      if (!hasBranch) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.6,
          message: `Seller TIN (${cleanDigits.slice(0, 9)}) is present, but missing explicit 3-to-5 digit Branch Code (e.g., -00000).`,
          evidence_fields: ['seller.tax_id', 'seller.branch_code'],
          recommended_action: 'Add branch code suffix (e.g., -000 for Head Office) to the TIN string.',
          why_it_matters:
            'BIR EIS rejects API transmissions where the seller TIN does not contain the registered branch designation.',
          implementation_steps: ['Append branch code to seller TIN setting.'],
        };
      }

      return {
        state: 'PASS',
        message: `Valid Seller TIN and Branch Code detected (${cleanDigits.slice(0, 9)}-${branchCode || cleanDigits.slice(9)}).`,
        evidence_fields: ['seller.tax_id', 'seller.branch_code'],
        recommended_action: 'Ensure branch code matches BIR Form 2303 registration.',
        why_it_matters: 'Ensures correct tax allocation across revenue district offices (RDO).',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 3. EOPT ACT: INVOICE AS PRIMARY PROOF (RR 7-2024 / RA 11976)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-INVOICE-VERSUS-OR',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_VERSION,
    title: 'EOPT Act Compliance: Primary Document Titled "Invoice" (Replacing Official Receipt)',
    description:
      'Under the Ease of Paying Taxes (EOPT) Act (RA 11976) and BIR RR No. 7-2024, the "Invoice" (Sales Invoice / Commercial Invoice) is now the sole primary proof of sale of both goods AND services. "Official Receipts" (OR) are relegated to mere supplementary documents and can no longer substantiate VAT input tax.',
    category: 'INVOICE_STRUCTURE',
    severity: 'HIGH',
    effective_from: '2024-04-27',
    source_id: 'PH-SRC-EOPT-ACT-11976',
    source_locator: 'Section 8 (Amending Section 237) & RR 7-2024',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) => profile.country === 'PH',
    evaluateRule: (invoice) => {
      const docType = invoice.metadata.document_type;
      if (docType === 'OFFICIAL_RECEIPT') {
        return {
          state: 'FAIL',
          message:
            'Critical EOPT Gap: Document is titled "Official Receipt". Under RA 11976 and RR 7-2024, service providers must issue an "Invoice" (e.g. "Billing Invoice" or "Service Invoice") to claim input VAT.',
          evidence_fields: ['metadata.document_type'],
          recommended_action:
            'Re-title document template from "Official Receipt" to "Service Invoice" or "Billing Invoice". Existing unused ORs may be stamped "Invoice" during the BIR transition period.',
          why_it_matters:
            'Claiming input VAT using an Official Receipt is disallowed under audit under the new EOPT provisions.',
          implementation_steps: [
            'Submit inventory of unused Official Receipts to your RDO.',
            'Stamp unused ORs with "Invoice" or print new compliant Service Invoices.',
          ],
        };
      }

      return {
        state: 'PASS',
        message: 'Document correctly designated as an Invoice compliant with EOPT Act.',
        evidence_fields: ['metadata.document_type'],
        recommended_action: 'Maintain Invoice naming conventions across all billing channels.',
        why_it_matters: 'Ensures buyer input VAT deductibility.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 4. STATUTORY 4-WAY VAT BREAKDOWN (CRITICAL GATE)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-VAT-BREAKDOWN',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_VERSION,
    title: 'Statutory 4-Way VAT Breakdown (Vatable, 12% VAT, Exempt, Zero-Rated)',
    description:
      'Section 113 of the Tax Code and RR 8-2022 require VAT-registered sellers to explicitly break down sales into: (1) Vatable Sales, (2) VAT Amount (12%), (3) VAT-Exempt Sales, and (4) Zero-Rated Sales. Lumping all into one gross sum is non-compliant.',
    category: 'TAX_VAT_CALCULATION',
    severity: 'CRITICAL',
    effective_from: '2018-01-01',
    source_id: 'PH-SRC-BIR-RR-8-2022',
    source_locator: 'Section 6(1)(f) & Tax Code Sec. 113',
    is_critical_gate: true,
    failure_score_cap: 65, // Critical gate per Section 19!
    points_allocated: 20,
    evaluateApplicability: (profile) => profile.country === 'PH' && profile.vat_registered,
    evaluateRule: (invoice) => {
      const totals = invoice.totals;
      const hasTaxTotal = totals.tax_total !== null && totals.tax_total !== undefined;
      const hasVatable = totals.vatable_sales !== null && totals.vatable_sales !== undefined;
      const hasExemptOrZero =
        totals.vat_exempt_sales !== null || totals.zero_rated_sales !== null;

      if (!hasTaxTotal || totals.tax_total === null) {
        return {
          state: 'FAIL',
          message: 'Missing explicit 12% VAT amount breakdown.',
          evidence_fields: ['totals.tax_total'],
          recommended_action: 'Display separate line for Value Added Tax (12%).',
          why_it_matters:
            'VAT must be billed as a separate item under Section 113. Failure caps readiness score at 65.',
          implementation_steps: ['Update invoice summary block in accounting system.'],
        };
      }

      if (!hasVatable) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.6,
          message:
            'VAT amount is shown, but distinct "Vatable Sales" net base is not explicitly separated from Exempt or Zero-Rated sales.',
          evidence_fields: ['totals.vatable_sales', 'totals.tax_total'],
          recommended_action:
            'Separate invoice summary into Vatable Sales, VAT Amount, VAT-Exempt Sales, and Zero-Rated Sales.',
          why_it_matters:
            'BIR EIS JSON transmission schema requires distinct numerical elements for each sales category.',
          implementation_steps: ['Configure accounting software summary report layout.'],
        };
      }

      return {
        state: 'PASS',
        message: 'Statutory 4-way VAT breakdown is fully compliant.',
        evidence_fields: ['totals.vatable_sales', 'totals.tax_total'],
        recommended_action: 'Maintain automated subtotal calculations.',
        why_it_matters: 'Enables straight-through JSON parsing by BIR EIS validator.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 5. BUYER REGISTERED INFORMATION FOR B2B >= PHP 1,000
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-BUYER-INFO',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_VERSION,
    title: 'Buyer Registered Name, TIN, and Address (B2B >= PHP 1,000)',
    description:
      'Under BIR regulations, for commercial/B2B sales or sales exceeding PHP 1,000 to registered taxpayers, the invoice must state the buyer Registered Name, Business Style (optional under EOPT), TIN with branch code, and Registered Address.',
    category: 'BUYER_IDENTITY',
    severity: 'HIGH',
    effective_from: '2018-01-01',
    source_id: 'PH-SRC-BIR-RR-8-2022',
    source_locator: 'Section 6(1)(c)',
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
          recommended_action: 'Record Buyer 9/12 digit TIN with branch code on all corporate invoices.',
          why_it_matters:
            'Without buyer TIN, the transaction is treated as B2C and the purchasing company cannot claim input tax.',
          implementation_steps: ['Require customer TIN entry during corporate checkout / quotation.'],
        };
      }

      if (!buyerName || !buyerAddress) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.6,
          message: 'Buyer TIN present, but Buyer registered legal name or address is incomplete.',
          evidence_fields: ['buyer.legal_name', 'buyer.address'],
          recommended_action: 'Ensure full registered corporate name and address are printed.',
          why_it_matters: 'BIR auditor cross-referencing (SLSP) requires matching name and TIN.',
          implementation_steps: ['Standardize client master records.'],
        };
      }

      return {
        state: 'PASS',
        message: `Valid Buyer information detected (${buyerName}, TIN: ${buyerTin}).`,
        evidence_fields: ['buyer.tax_id', 'buyer.legal_name'],
        recommended_action: 'Maintain verified client master records.',
        why_it_matters: 'Ensures buyer VAT deductibility and smooth reconciliation.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 6. SERIAL NUMBERING & BIR PERMIT (PTU / ATP / CAS)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-SERIAL-NUMBER',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_VERSION,
    title: 'Sequential Serial Number & BIR Accreditation / PTU / CAS Reference',
    description:
      'Invoices must display a sequential serial number and the BIR Permit to Use (PTU), Authority to Print (ATP), or CAS Accreditation acknowledgment number.',
    category: 'NUMBERING_DATES',
    severity: 'HIGH',
    effective_from: '2018-01-01',
    source_id: 'PH-SRC-BIR-RR-8-2022',
    source_locator: 'Section 6(1)(d)',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) => profile.country === 'PH',
    evaluateRule: (invoice) => {
      const invNum = invoice.identifiers.invoice_number;
      const casNum = invoice.identifiers.cas_accreditation_number || invoice.identifiers.ptu_atp_number;

      if (!invNum) {
        return {
          state: 'FAIL',
          message: 'Missing serial invoice number.',
          evidence_fields: ['identifiers.invoice_number'],
          recommended_action: 'Ensure all invoices have consecutive serial numbering.',
          why_it_matters: 'Required by BIR for sequential audit tracking.',
          implementation_steps: ['Check sequential series settings in invoicing tool.'],
        };
      }

      return {
        state: 'PASS',
        message: `Valid serial invoice number: "${invNum}".${casNum ? ` (BIR Permit: ${casNum})` : ''}`,
        evidence_fields: ['identifiers.invoice_number'],
        recommended_action: 'Maintain permit and series control logs.',
        why_it_matters: 'Prevents duplicate receipt penalties.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 7. BIR EIS REAL-TIME JSON TRANSMISSION (3-DAY WINDOW)
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-EIS-TRANSMISSION',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_VERSION,
    title: 'BIR EIS JSON API Transmission Readiness (Within 3 Calendar Days)',
    description:
      'Section 4 of RR No. 8-2022 prescribes that e-invoices issued by covered taxpayers must be transmitted in standardized JSON format to the BIR EIS within three (3) calendar days from the date of issuance.',
    category: 'TRANSMISSION_SYSTEM_READINESS',
    severity: 'HIGH',
    effective_from: '2022-07-01',
    source_id: 'PH-SRC-BIR-RMO-24-2022',
    source_locator: 'Section 4 & Annex A (JSON Payload Specs)',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) => profile.country === 'PH',
    evaluateRule: (invoice, profile, system) => {
      if (system.electronic_transmission_capability || system.structured_export_capability) {
        return {
          state: 'PASS',
          message: 'System capability to generate/transmit BIR EIS JSON payloads established.',
          evidence_fields: ['system.electronic_transmission_capability'],
          recommended_action:
            'Conduct quarterly latency audits to ensure invoices are submitted to EIS within the 3-day limit.',
          why_it_matters:
            'Transmissions beyond 3 days from the invoice issue date are logged as late submissions by BIR EIS.',
          implementation_steps: ['Automate daily cron job for pending invoice batch upload.'],
        };
      }

      return {
        state: 'FAIL',
        message:
          'No automated JSON generation or electronic transmission capability detected in current invoicing system.',
        evidence_fields: ['system.electronic_transmission_capability', 'system.structured_export_capability'],
        recommended_action:
          'Implement a BIR EIS connector or middleware that formats sales data into the Annex A JSON payload.',
        why_it_matters:
          'Manual entry into the BIR EIS portal is restricted to pilot and micro participants; automated API transmission is required for scaled operations.',
        implementation_steps: [
          'Review BIR RMO 24-2022 Annex A schema documentation.',
          'Connect your ERP database to an EIS middleware service.',
        ],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 8. COMPUTERIZED ACCOUNTING SYSTEM (CAS) STATUS
  // -------------------------------------------------------------------------
  {
    rule_id: 'PH-RULE-CAS-REGISTRATION',
    jurisdiction: 'PH',
    pack_version: PH_RULE_PACK_VERSION,
    title: 'Computerized Accounting System (CAS) / Software Compliance Status',
    description:
      'Large Taxpayers and automated enterprises generating computerized invoices must operate under a registered Computerized Accounting System (CAS) with Acknowledgement Certificate (AC) pursuant to RMO 9-2021.',
    category: 'STRUCTURED_DATA_CAPABILITY',
    severity: 'MEDIUM',
    effective_from: '2021-01-01',
    source_id: 'PH-SRC-BIR-RMO-24-2022',
    source_locator: 'Section 5 (System Architecture)',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) => profile.country === 'PH',
    evaluateRule: (invoice, profile, system) => {
      if (system.cas_permit_active || system.accounting_system === 'CUSTOM_ERP' || system.accounting_system === 'ODOO') {
        return {
          state: 'PASS',
          message: 'System is registered or compatible with BIR CAS guidelines.',
          evidence_fields: ['system.cas_permit_active', 'system.accounting_system'],
          recommended_action: 'Ensure system audit logs meet BIR standard requirements.',
          why_it_matters: 'Unregistered computerized billing systems risk BIR confiscation and non-deductibility.',
          implementation_steps: [],
        };
      }

      return {
        state: 'PARTIAL',
        partial_score_ratio: 0.5,
        message:
          'Using off-the-shelf software or spreadsheets (e.g., Excel/Sheets) without BIR CAS Acknowledgement Certificate.',
        evidence_fields: ['system.accounting_system', 'system.cas_permit_active'],
        recommended_action:
          'Transition to a CAS-compliant accounting system or register custom software with your RDO.',
        why_it_matters: 'Manual spreadsheets cannot guarantee tamper-proof audit trails for BIR EIS.',
        implementation_steps: ['Evaluate CAS-ready solutions.'],
      };
    },
  },
];
