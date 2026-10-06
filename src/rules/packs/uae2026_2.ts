/**
 * InvoiceReady v1.0 - Remediated UAE Regulatory Rule Pack (AE-2026.2)
 * Reconciled against:
 * - UAE Cabinet Decision No. 91 of 2023
 * - UAE Ministerial Decision No. 145 of 2024 (Updated MoF Implementation Timeline)
 * - UAE Federal Decree-Law No. 8 of 2017 & Executive Regs Cabinet Decision No. 52/2017
 * - OpenPeppol PINT AE Billing Specification v1.1
 *
 * Specific Timeline Corrections (Requirements 23, 24, 25):
 * - Taxpayers with turnover >= AED 50M:
 *     ASP Onboarding Deadline: October 30, 2026
 *     Mandatory Live Implementation: January 1, 2027
 * - Taxpayers with turnover < AED 50M (Phase 2):
 *     ASP Onboarding Deadline: May 31, 2027
 *     Mandatory Live Implementation: July 1, 2027
 */

import { RegulatoryRule, RulePackConfiguration, RuleState } from '../../engine/types';

export const UAE_RULE_PACK_2_VERSION = 'AE-2026.2';

export const UAE_PACK_2_CONFIG: RulePackConfiguration = {
  pack_id: 'AE-2026.2',
  jurisdiction: 'AE',
  version: '2.0.0',
  release_date: '2026-10-01',
  description: 'Reconciled UAE eInvoicing rules under Cabinet Decision 91/2023 & Ministerial Decision 145/2024.',
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
    'AE-RULE-STRUCTURED-XML': 69,
    'AE-RULE-SELLER-TRN': 60,
  },
  mandatory_effective_dates: {
    phase_1_asp_selection: '2026-10-30',
    phase_1_live_mandate: '2027-01-01',
    phase_2_asp_selection: '2027-05-31',
    phase_2_live_mandate: '2027-07-01',
  },
};

export const UAE_RULES_V2: RegulatoryRule[] = [
  // -------------------------------------------------------------------------
  // 1. APPLICABILITY & MANDATE TIMELINE (Ministerial Decision 145/2024)
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-APPLICABILITY-PHASE',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_2_VERSION,
    title: 'UAE E-Invoicing Phase 1 Mandate & ASP Selection Deadline (Turnover >= AED 50M)',
    description:
      'Pursuant to Ministerial Decision No. 145 of 2024 and Cabinet Decision No. 91/2023, businesses with annual taxable turnover >= AED 50,000,000 must appoint an Accredited Service Provider (ASP) by October 30, 2026, with mandatory live e-invoicing commencing January 1, 2027.',
    category: 'TRANSMISSION_SYSTEM_READINESS',
    severity: 'CRITICAL',
    effective_from: '2026-10-30',
    source_id: 'AE-SRC-MINISTERIAL-145-2024',
    source_locator: 'Article 2(1) & Article 3(1)',
    is_critical_gate: false,
    points_allocated: 5,
    evaluateApplicability: (profile) => profile.country === 'AE',
    evaluateRule: (invoice, profile) => {
      // Boundary-safe numeric evaluation (Requirement 25)
      const turnover = profile.annual_turnover_amount;
      const isPhase1 = turnover !== undefined ? turnover >= 50_000_000 : profile.revenue_band === 'ABOVE_50M_AED';

      if (isPhase1) {
        return {
          state: 'PASS',
          message:
            'Entity subject to Phase 1: Annual turnover >= AED 50,000,000. Statutory ASP selection deadline is October 30, 2026; mandatory live e-invoice transmission begins January 1, 2027.',
          evidence_fields: ['profile.revenue_band', 'profile.annual_turnover_amount'],
          recommended_action:
            'Finalize contract with an accredited MoF ASP partner prior to October 30, 2026, and conduct Schematron test transmissions for January 1, 2027 go-live.',
          why_it_matters:
            'Ministerial Decision No. 145/2024 mandates formal ASP onboarding by October 30, 2026 for all taxpayers with revenue of AED 50M or higher.',
          implementation_steps: [
            'Verify annual audited turnover meets or exceeds AED 50,000,000 threshold.',
            'Execute integration agreement with certified UAE ASP on or before October 30, 2026.',
            'Validate Peppol PINT Schematron compliance ahead of the January 1, 2027 live mandate.',
          ],
        };
      }

      return {
        state: 'PASS',
        message:
          'Entity classified under Phase 2: Annual turnover < AED 50,000,000. ASP onboarding deadline is May 31, 2027; mandatory live transmission begins July 1, 2027.',
        evidence_fields: ['profile.revenue_band', 'profile.annual_turnover_amount'],
        recommended_action:
          'Prepare ERP invoice export schemas during 2026; engage ASP partner prior to the May 31, 2027 deadline.',
        why_it_matters:
          'Phase 2 taxpayers are not subject to the October 2026 ASP selection deadline, but must prepare for the July 1, 2027 live mandate.',
        implementation_steps: [
          'Standardize seller and buyer master data TRN records.',
          'Schedule accounting software upgrade to support structured XML output by Q1 2027.',
        ],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 2. SELLER TRN IDENTIFICATION (Federal Decree-Law No. 8/2017)
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-SELLER-TRN',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_2_VERSION,
    title: 'Valid 15-Digit Seller Tax Registration Number (TRN)',
    description:
      'Article 59(1)(b) of Cabinet Decision No. 52/2017 requires all UAE Tax Invoices to display the 15-digit Tax Registration Number (TRN) of the supplier, strictly conforming to the 15-digit FTA format starting with 100.',
    category: 'SELLER_IDENTITY',
    severity: 'CRITICAL',
    effective_from: '2018-01-01',
    source_id: 'AE-SRC-VAT-DECREE-8-2017',
    source_locator: 'Article 59(1)(b)',
    is_critical_gate: true,
    failure_score_cap: 60,
    points_allocated: 15,
    evaluateApplicability: (profile) => profile.country === 'AE' && profile.vat_registered,
    evaluateRule: (invoice, profile, system, evidenceMap) => {
      const sellerTrn = invoice.seller.tax_id ? String(invoice.seller.tax_id).replace(/\s|-/g, '') : null;
      const evidence = evidenceMap['seller.tax_id'];

      // Check if evidence is uncertain (Requirement 42)
      if (evidence && evidence.confidence_level === 'LOW') {
        return {
          state: 'REVIEW_REQUIRED',
          message: 'Seller TRN extraction confidence is low. Manual verification required before compliance score can be awarded.',
          evidence_fields: ['seller.tax_id'],
          recommended_action: 'Review and confirm the seller TRN in the Extraction Review screen.',
          why_it_matters: 'Critical statutory field requires unambiguous validation.',
          implementation_steps: ['Confirm 15-digit TRN against FTA registration document.'],
        };
      }

      if (!sellerTrn) {
        return {
          state: 'FAIL',
          message: 'Missing Seller Tax Registration Number (TRN) on the invoice.',
          evidence_fields: ['seller.tax_id'],
          recommended_action: 'Display the 15-digit FTA-issued TRN prominently on the invoice header.',
          why_it_matters:
            'Under Article 59(1)(b), an invoice lacking the supplier TRN is legally deficient and cannot substantiate input tax recovery.',
          implementation_steps: [
            'Configure ERP invoice header to include the 15-digit supplier TRN.',
            'Verify registration status on the official FTA portal.',
          ],
        };
      }

      if (!/^100\d{12}$/.test(sellerTrn)) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.5,
          message: `Seller TRN "${sellerTrn}" is invalid: must consist of exactly 15 numeric digits starting with 100 pursuant to FTA format rules.`,
          evidence_fields: ['seller.tax_id'],
          recommended_action: 'Correct the seller TRN to the official 15-digit FTA format (^100\\d{12}$).',
          why_it_matters:
            'Peppol PINT AE Schematron rule strictly enforces validation regex ^100[0-9]{12}$ on the Supplier party legal tax identifier.',
          implementation_steps: ['Update master billing company profile.'],
        };
      }

      return {
        state: 'PASS',
        message: `Valid 15-digit Seller TRN detected (${sellerTrn}) meeting Article 59(1)(b) requirements.`,
        evidence_fields: ['seller.tax_id'],
        recommended_action: 'Maintain seller master data integrity.',
        why_it_matters: 'Ensures legal validity and input tax recovery by registered recipients.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 3. BUYER TRN IDENTIFICATION (B2B / B2G)
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-BUYER-TRN',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_2_VERSION,
    title: 'Buyer Tax Registration Number (TRN) for B2B/B2G Invoices',
    description:
      'Where the recipient is a registered tax person in a B2B or B2G transaction, Article 59(1)(c) mandates that the invoice state the name, address, and 15-digit TRN of the recipient.',
    category: 'BUYER_IDENTITY',
    severity: 'HIGH',
    effective_from: '2018-01-01',
    source_id: 'AE-SRC-VAT-DECREE-8-2017',
    source_locator: 'Article 59(1)(c)',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) =>
      profile.country === 'AE' && profile.transaction_types.some((t) => t === 'B2B' || t === 'B2G'),
    evaluateRule: (invoice) => {
      const buyerTrn = invoice.buyer.tax_id ? String(invoice.buyer.tax_id).replace(/\s|-/g, '') : null;

      if (!buyerTrn) {
        return {
          state: 'FAIL',
          message: 'Missing Buyer TRN on B2B/B2G transaction.',
          evidence_fields: ['buyer.tax_id'],
          recommended_action: 'Record the recipient 15-digit TRN in your customer master record.',
          why_it_matters:
            'Pursuant to Article 59(1)(c), full tax invoices issued to registered recipients must state the customer TRN.',
          implementation_steps: [
            'Enforce mandatory collection of customer TRNs during business customer onboarding.',
            'Include buyer TRN in Peppol PINT AccountingCustomerParty element.',
          ],
        };
      }

      if (!/^100\d{12}$/.test(buyerTrn)) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.5,
          message: `Buyer TRN "${buyerTrn}" does not conform to the 15-digit FTA numeric format starting with 100.`,
          evidence_fields: ['buyer.tax_id'],
          recommended_action: 'Validate and format customer TRN against the FTA registry.',
          why_it_matters: 'Peppol PINT routing will fail endpoint lookup if the recipient TRN format is malformed.',
          implementation_steps: ['Perform lookup validation on buyer TRN.'],
        };
      }

      return {
        state: 'PASS',
        message: `Valid Buyer TRN detected (${buyerTrn}) compliant with Article 59(1)(c).`,
        evidence_fields: ['buyer.tax_id'],
        recommended_action: 'Maintain customer tax master data.',
        why_it_matters: 'Enables straight-through B2B network routing.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 4. STRUCTURED DATA & PEPPOL PINT CAPABILITY (CRITICAL GATE: CAP 69)
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-STRUCTURED-XML',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_2_VERSION,
    title: 'Machine-Readable Structured Electronic Invoice Capability (Peppol PINT AE XML)',
    description:
      'Cabinet Decision No. 91 of 2023 establishes that e-invoicing must be generated, transmitted, and received in standardized structured electronic format (Peppol PINT AE XML / UBL 2.1). Unstructured PDFs and paper documents are non-compliant for mandated transactions.',
    category: 'STRUCTURED_DATA_CAPABILITY',
    severity: 'CRITICAL',
    effective_from: '2026-10-30',
    source_id: 'AE-SRC-CABINET-91-2023',
    source_locator: 'Article 2 & Article 4(1)',
    is_critical_gate: true,
    failure_score_cap: 69,
    points_allocated: 10,
    evaluateApplicability: (profile) => profile.country === 'AE',
    evaluateRule: (invoice, profile, system) => {
      const isNativeStructured =
        invoice.metadata.format === 'XML_UBL' || invoice.metadata.structured_export_available;
      const systemHasCapability = system.structured_export_capability;

      if (!isNativeStructured && !systemHasCapability) {
        return {
          state: 'FAIL',
          message:
            'Critical Gap: Invoicing process produces only unstructured documents (PDF/paper) without machine-readable XML export capability. Under Cabinet Decision No. 91/2023, unstructured documents do not fulfill e-invoicing requirements.',
          evidence_fields: ['metadata.format', 'system.structured_export_capability'],
          recommended_action:
            'Implement an ERP electronic invoicing module or middleware capable of generating Peppol PINT AE XML.',
          why_it_matters:
            'Once effective, only structured electronic invoices cleared through the decentralised continuous transaction controls (DCTCE) network are legally valid for tax purposes.',
          implementation_steps: [
            'Configure ERP billing system to generate UBL 2.1 XML invoices matching the Peppol PINT AE specification.',
            'Test syntax against the official MoF Schematron validator.',
          ],
        };
      }

      if (systemHasCapability && !isNativeStructured) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.7,
          message:
            'System possesses structured export capability, but the assessed invoice is an unstructured PDF without embedded/attached XML.',
          evidence_fields: ['metadata.format', 'system.structured_export_capability'],
          recommended_action: 'Export the structured XML file directly from your ERP for technical Schematron audit.',
          why_it_matters: 'The clearance network processes the raw XML payload rather than visual PDF rendering.',
          implementation_steps: ['Generate and upload the raw XML file in the next scan session.'],
        };
      }

      return {
        state: 'PASS',
        message: 'Structured machine-readable e-invoice capability verified compliant with Peppol PINT AE requirements.',
        evidence_fields: ['metadata.format', 'system.structured_export_capability'],
        recommended_action: 'Maintain Schematron validation routines.',
        why_it_matters: 'Ensures uninterrupted straight-through processing.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 5. INVOICE TITLE & CLASSIFICATION (Article 59 & 60)
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-INVOICE-TITLE',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_2_VERSION,
    title: 'Statutory Invoice Title ("Tax Invoice" or "Simplified Tax Invoice")',
    description:
      'Article 59(1)(a) requires documents to be prominently titled "Tax Invoice" (or "Simplified Tax Invoice" pursuant to Article 60 where total consideration is under AED 10,000).',
    category: 'INVOICE_STRUCTURE',
    severity: 'MEDIUM',
    effective_from: '2018-01-01',
    source_id: 'AE-SRC-VAT-DECREE-8-2017',
    source_locator: 'Article 59(1)(a) & Article 60',
    is_critical_gate: false,
    points_allocated: 5,
    evaluateApplicability: (profile) => profile.country === 'AE',
    evaluateRule: (invoice) => {
      const type = invoice.metadata.document_type;
      if (type === 'TAX_INVOICE' || type === 'SIMPLIFIED_TAX_INVOICE') {
        return {
          state: 'PASS',
          message: `Document designated with statutory title "${type.replace(/_/g, ' ')}" meeting Article 59/60 standards.`,
          evidence_fields: ['metadata.document_type'],
          recommended_action: 'Maintain correct invoice title.',
          why_it_matters: 'Required by UAE VAT executive regulations.',
          implementation_steps: [],
        };
      }

      return {
        state: 'FAIL',
        message: `Document title "${type}" does not meet Article 59(1)(a) requirements. Must explicitly state "Tax Invoice" or "Simplified Tax Invoice".`,
        evidence_fields: ['metadata.document_type'],
        recommended_action: 'Update invoice template heading to "Tax Invoice".',
        why_it_matters: 'Documents titled merely "Invoice" or "Proforma" are legally non-compliant under FTA audit.',
        implementation_steps: ['Update invoice header title in billing software.'],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 6. LINE-ITEM SPECIFICATION & 5% VAT RATE
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-LINE-TAX-BREAKDOWN',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_2_VERSION,
    title: 'Itemized Line Breakdown with Quantity, Unit Price, Tax Rate, and AED Total',
    description:
      'Article 59(1)(g) requires line-item details including description, unit price, quantity, rate of tax (5% standard or 0%), and gross amount payable.',
    category: 'LINE_MASTER_DATA',
    severity: 'HIGH',
    effective_from: '2018-01-01',
    source_id: 'AE-SRC-VAT-DECREE-8-2017',
    source_locator: 'Article 59(1)(g)',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) => profile.country === 'AE',
    evaluateRule: (invoice) => {
      if (!invoice.lines || invoice.lines.length === 0) {
        return {
          state: 'FAIL',
          message: 'No line items detected on invoice.',
          evidence_fields: ['lines'],
          recommended_action: 'Include itemized goods or services lines.',
          why_it_matters: 'Line-level itemization is mandatory under Article 59 and Peppol PINT.',
          implementation_steps: ['Ensure line details are mapped from billing software.'],
        };
      }

      const hasMissingPrices = invoice.lines.some((l) => l.unit_price === null || l.line_total === null);
      const hasMissingRates = invoice.lines.some((l) => l.tax_rate === null);

      if (hasMissingPrices || hasMissingRates) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.5,
          message: 'Lines are present but some lack unit prices or explicit VAT rates (5% or 0%).',
          evidence_fields: ['lines[].unit_price', 'lines[].tax_rate'],
          recommended_action: 'Ensure each line explicitly specifies quantity, unit price, and applicable VAT rate.',
          why_it_matters: 'Missing line fields cause Schematron parsing rejection.',
          implementation_steps: ['Review line-item column mappings.'],
        };
      }

      return {
        state: 'PASS',
        message: `All ${invoice.lines.length} lines specify required descriptions, prices, and VAT rates.`,
        evidence_fields: ['lines'],
        recommended_action: 'Maintain product master data standards.',
        why_it_matters: 'Ensures compliance with line-level audit rules.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 7. TAX SUMMARY & AED CURRENCY (Article 59 & 60)
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-TOTAL-CURRENCY',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_2_VERSION,
    title: 'Total VAT Payable Displayed in UAE Dirham (AED)',
    description:
      'Article 59(1)(i) and Article 60 mandate that where prices are stated in a foreign currency, the total amount payable and the VAT amount must be converted to UAE Dirhams (AED) using the UAE Central Bank exchange rate.',
    category: 'TAX_VAT_CALCULATION',
    severity: 'HIGH',
    effective_from: '2018-01-01',
    source_id: 'AE-SRC-VAT-DECREE-8-2017',
    source_locator: 'Article 59(1)(i) & Article 60',
    is_critical_gate: false,
    points_allocated: 20,
    evaluateApplicability: (profile) => profile.country === 'AE' && profile.vat_registered,
    evaluateRule: (invoice) => {
      const invCurr = invoice.currency.invoice_currency;
      const taxCurr = invoice.currency.tax_currency;

      if (invoice.totals.tax_total === null) {
        return {
          state: 'FAIL',
          message: 'Missing total VAT amount payable summary.',
          evidence_fields: ['totals.tax_total'],
          recommended_action: 'Display distinct VAT total line in the invoice summary.',
          why_it_matters: 'FTA requires clear separation of net taxable subtotal, VAT amount, and grand total.',
          implementation_steps: ['Configure tax summary block in invoice template.'],
        };
      }

      if (invCurr !== 'AED' && taxCurr !== 'AED') {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.6,
          message: `Invoice is denominated in ${invCurr}, but missing statutory conversion of VAT payable to AED using the UAE Central Bank rate.`,
          evidence_fields: ['currency.invoice_currency', 'currency.tax_currency'],
          recommended_action: 'Display the UAE Central Bank exchange rate and equivalent VAT in AED.',
          why_it_matters: 'Foreign currency invoices must declare the VAT amount in AED under Article 59.',
          implementation_steps: ['Add Central Bank rate lookup and secondary AED VAT line.'],
        };
      }

      return {
        state: 'PASS',
        message: 'VAT total and currency specifications meet Article 59 statutory standards.',
        evidence_fields: ['totals.tax_total', 'currency.tax_currency'],
        recommended_action: 'Maintain automated arithmetic checks.',
        why_it_matters: 'Prevents discrepancies in VAT return filings.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 8. ACCREDITED SERVICE PROVIDER (ASP) ONBOARDING READINESS
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-ASP-READINESS',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_2_VERSION,
    title: 'Accredited Service Provider (ASP) Connectivity Capability',
    description:
      'Under Ministerial Decision No. 145/2024 and the UAE DCTCE model, businesses must transmit e-invoices via certified Accredited Service Providers (ASPs) connected to the MoF platform.',
    category: 'TRANSMISSION_SYSTEM_READINESS',
    severity: 'HIGH',
    effective_from: '2026-10-30',
    source_id: 'AE-SRC-MINISTERIAL-145-2024',
    source_locator: 'Article 3 (Accredited Service Providers)',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) => profile.country === 'AE',
    evaluateRule: (invoice, profile, system) => {
      const turnover = profile.annual_turnover_amount;
      const isPhase1 = turnover !== undefined ? turnover >= 50_000_000 : profile.revenue_band === 'ABOVE_50M_AED';

      if (system.asp_partner_selected || system.electronic_transmission_capability) {
        return {
          state: 'PASS',
          message: `ASP integration capability established${system.asp_partner_name ? ` (Partner: ${system.asp_partner_name})` : ''}. Readiness verified for ${isPhase1 ? 'October 30, 2026' : 'May 31, 2027'} milestone.`,
          evidence_fields: ['system.asp_partner_selected', 'system.electronic_transmission_capability'],
          recommended_action: 'Complete sandbox transmission testing with selected ASP.',
          why_it_matters: 'ASPs manage digital certificates, Peppol routing, and tax clearance reporting.',
          implementation_steps: ['Validate payloads against ASP API endpoints.'],
        };
      }

      return {
        state: 'FAIL',
        message: `No Accredited Service Provider (ASP) connection configured. Taxpayers with turnover >= AED 50M must appoint an ASP by October 30, 2026; remaining taxpayers by May 31, 2027.`,
        evidence_fields: ['system.asp_partner_selected', 'system.electronic_transmission_capability'],
        recommended_action:
          'Evaluate certified UAE Ministry of Finance ASP providers and establish connectivity.',
        why_it_matters:
          'Manual entry into tax portals is prohibited for general business transactions under the UAE DCTCE model.',
        implementation_steps: [
          'Review the published list of accredited ASPs on mof.gov.ae.',
          'Execute connectivity integration before the statutory deadline.',
        ],
      };
    },
  },
];
