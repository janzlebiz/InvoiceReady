/**
 * InvoiceReady v1.0 - UAE Regulatory Rule Pack (AE-2026.1)
 * Authoritative Regulatory Hierarchy:
 * - UAE Cabinet Decision No. 91/2023 (E-Invoicing System)
 * - UAE Federal Decree-Law No. 8/2017 (VAT)
 * - MoF E-Invoicing Program Phase 1 & 2 Guidelines
 * - OpenPeppol PINT AE Data Dictionary
 */

import { RegulatoryRule, RuleState } from '../../engine/types';

export const UAE_RULE_PACK_VERSION = 'AE-2026.1';

export const UAE_RULES: RegulatoryRule[] = [
  // -------------------------------------------------------------------------
  // 1. APPLICABILITY & PHASE TIMELINE (PRD-020, PRD-021)
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-APPLICABILITY-PHASE',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_VERSION,
    title: 'UAE E-Invoicing Phase 1 Mandate Determination (Turnover > AED 50M)',
    description:
      'Under Cabinet Decision No. 91/2023 and MoF rollout circulars, businesses with annual taxable turnover exceeding AED 50,000,000 are subject to mandatory Phase 1 e-invoicing rollout in July 2026.',
    category: 'TRANSMISSION_SYSTEM_READINESS',
    severity: 'CRITICAL',
    effective_from: '2026-07-01',
    source_id: 'AE-SRC-MOF-EINVOICING-PHASE1',
    source_locator: 'Section 3.1 & MoF Bulletin 2024/02',
    is_critical_gate: false,
    points_allocated: 5,
    evaluateApplicability: (profile) => profile.country === 'AE',
    evaluateRule: (invoice, profile) => {
      const isPhase1 = profile.revenue_band === 'ABOVE_50M_AED';
      if (isPhase1) {
        return {
          state: 'PASS',
          message:
            'Business classified under UAE Phase 1 mandate (Turnover > AED 50M). Mandatory live transmission effective July 2026.',
          evidence_fields: ['profile.revenue_band'],
          recommended_action:
            'Finalize Accredited Service Provider (ASP) selection and ERP Peppol PINT integration before Q2 2026.',
          why_it_matters:
            'Phase 1 taxpayers must transmit structured e-invoices via certified ASPs to the central tax clearance platform.',
          implementation_steps: [
            'Audit ERP export capability for Peppol PINT AE schema.',
            'Engage an accredited MoF ASP transmission partner.',
            'Conduct end-to-end sandbox connectivity testing with tax authority router.',
          ],
        };
      }
      return {
        state: 'PASS',
        message:
          'Business classified under UAE Phase 2 (Turnover < AED 50M). Upcoming requirement scheduled for 2027; early adoption recommended.',
        evidence_fields: ['profile.revenue_band'],
        recommended_action:
          'Prepare invoicing software and master data now to ensure seamless transition when Phase 2 commences.',
        why_it_matters:
          'While currently in transition, all VAT-registered UAE businesses will eventually be mandated under the DCTCE decentralized model.',
        implementation_steps: [
          'Verify your accounting system supports structured XML/JSON invoice export.',
          'Standardize seller and buyer 15-digit TRN records.',
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
    pack_version: UAE_RULE_PACK_VERSION,
    title: 'Valid 15-Digit Seller Tax Registration Number (TRN)',
    description:
      'Article 59 of Cabinet Decision No. 52/2017 requires all UAE Tax Invoices to clearly state the 15-digit Tax Registration Number (TRN) of the supplier, typically formatted starting with "100".',
    category: 'SELLER_IDENTITY',
    severity: 'CRITICAL',
    effective_from: '2018-01-01',
    source_id: 'AE-SRC-VAT-DECREE-8-2017',
    source_locator: 'Article 59(1)(b) & FTA Public Clarification VATP006',
    is_critical_gate: true,
    failure_score_cap: 60, // Cannot achieve ready status without valid seller TRN
    points_allocated: 15,
    evaluateApplicability: (profile) => profile.country === 'AE' && profile.vat_registered,
    evaluateRule: (invoice, profile, system, evidenceMap) => {
      const sellerTrn = invoice.seller.tax_id ? invoice.seller.tax_id.replace(/\s|-/g, '') : null;
      if (!sellerTrn) {
        return {
          state: 'FAIL',
          message: 'Missing Seller Tax Registration Number (TRN) on the invoice.',
          evidence_fields: ['seller.tax_id'],
          recommended_action: 'Add your 15-digit FTA-issued TRN prominently to the invoice header.',
          why_it_matters:
            'An invoice missing the supplier TRN is legally invalid under UAE VAT law and will be rejected by the e-invoicing clearance router.',
          implementation_steps: [
            'Update your billing template to display your official FTA 15-digit TRN.',
            'Verify TRN in the FTA portal (tax.gov.ae).',
          ],
        };
      }

      // Check 15 digits numeric
      const isValidFormat = /^100\d{12}$/.test(sellerTrn);
      if (!isValidFormat) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.5,
          message: `Seller TRN "${sellerTrn}" is invalid: must be exactly 15 digits starting with 100.`,
          evidence_fields: ['seller.tax_id'],
          recommended_action: 'Correct the seller TRN format to the official 15-digit numeric FTA standard.',
          why_it_matters: 'Validation schemas in Peppol PINT strictly enforce regex ^100\\d{12}$ on supplier party TRN.',
          implementation_steps: ['Rectify TRN entry in ERP master business settings.'],
        };
      }

      return {
        state: 'PASS',
        message: `Valid 15-digit Seller TRN detected (${sellerTrn}).`,
        evidence_fields: ['seller.tax_id'],
        recommended_action: 'Maintain seller master data integrity.',
        why_it_matters: 'Valid seller TRN ensures full legal input-tax recovery for buyers and clearance compliance.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 3. BUYER TRN IDENTIFICATION FOR B2B / B2G
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-BUYER-TRN',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_VERSION,
    title: 'Buyer Tax Registration Number (TRN) for B2B/B2G Invoices',
    description:
      'Where the recipient is a registered tax person in a B2B or B2G transaction, Article 59 requires the invoice to state the name, address, and 15-digit TRN of the recipient.',
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
      const buyerTrn = invoice.buyer.tax_id ? invoice.buyer.tax_id.replace(/\s|-/g, '') : null;
      if (!buyerTrn) {
        return {
          state: 'FAIL',
          message: 'Missing Buyer TRN on B2B transaction.',
          evidence_fields: ['buyer.tax_id'],
          recommended_action: 'Collect and record buyer 15-digit TRN in your customer master database.',
          why_it_matters:
            'Without the customer TRN, the buyer cannot claim VAT input tax credit, and B2B Peppol PINT routing will fail.',
          implementation_steps: [
            'Enforce mandatory buyer TRN collection for all corporate accounts.',
            'Include buyer TRN field in invoice template.',
          ],
        };
      }

      if (!/^100\d{12}$/.test(buyerTrn)) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.5,
          message: `Buyer TRN "${buyerTrn}" does not match the standard 15-digit format.`,
          evidence_fields: ['buyer.tax_id'],
          recommended_action: 'Validate buyer TRN format against the FTA registry.',
          why_it_matters: 'E-invoicing network requires valid receiver identifiers for endpoint lookup.',
          implementation_steps: ['Validate customer TRN during customer onboarding.'],
        };
      }

      return {
        state: 'PASS',
        message: `Valid Buyer TRN detected (${buyerTrn}).`,
        evidence_fields: ['buyer.tax_id'],
        recommended_action: 'Keep customer tax records up to date.',
        why_it_matters: 'Ensures seamless B2B Peppol delivery and input tax deduction.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 4. STRUCTURED DATA & PEPPOL PINT CAPABILITY (CRITICAL GATE)
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-STRUCTURED-XML',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_VERSION,
    title: 'Machine-Readable Structured E-Invoice Capability (Peppol PINT AE / UBL XML)',
    description:
      'Cabinet Decision No. 91/2023 establishes that e-invoicing must be issued, transmitted, and received in a structured electronic format (Peppol PINT AE XML / UBL 2.1). PDF alone or scanned image is non-compliant.',
    category: 'STRUCTURED_DATA_CAPABILITY',
    severity: 'CRITICAL',
    effective_from: '2026-07-01',
    source_id: 'AE-SRC-CABINET-91-2023',
    source_locator: 'Article 2 & Article 4(1)',
    is_critical_gate: true,
    failure_score_cap: 69, // Mandatory critical gate per Specification Section 19!
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
            'Critical Gap: Invoicing workflow produces unstructured document (PDF/paper/image) without machine-readable XML/JSON generation capability.',
          evidence_fields: ['metadata.format', 'system.structured_export_capability'],
          recommended_action:
            'Upgrade invoicing software or implement an e-invoicing adapter to generate Peppol PINT AE XML.',
          why_it_matters:
            'Under UAE E-Invoicing law, unstructured PDFs and paper invoices will no longer be legally recognized for B2B transactions once effective. Non-compliance caps readiness score at 69.',
          implementation_steps: [
            'Configure your ERP/accounting system to export XML according to Peppol PINT AE data model.',
            'Alternatively, connect an API gateway with your chosen ASP that transforms invoice payloads into UBL 2.1.',
          ],
        };
      }

      if (systemHasCapability && !isNativeStructured) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.7,
          message:
            'System has structured export capability reported, but uploaded document is human-readable PDF without attached XML.',
          evidence_fields: ['metadata.format', 'system.structured_export_capability'],
          recommended_action: 'Test structured XML export file directly in next readiness scan.',
          why_it_matters:
            'Transmission mandates require validating the actual XML payload against Peppol Schematron rules.',
          implementation_steps: ['Export XML invoice file from ERP and run validation.'],
        };
      }

      return {
        state: 'PASS',
        message: 'Structured e-invoice data capability verified.',
        evidence_fields: ['metadata.format', 'system.structured_export_capability'],
        recommended_action: 'Maintain Schematron validation pipelines.',
        why_it_matters: 'Enables direct STP (Straight-Through Processing) and automated tax clearance.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 5. INVOICE TITLE & CLASSIFICATION (Article 59)
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-INVOICE-TITLE',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_VERSION,
    title: 'Explicit "Tax Invoice" Designation',
    description:
      'Article 59(1)(a) requires the document to prominently display the title "Tax Invoice" (or "Simplified Tax Invoice" where total consideration is under AED 10,000).',
    category: 'INVOICE_STRUCTURE',
    severity: 'MEDIUM',
    effective_from: '2018-01-01',
    source_id: 'AE-SRC-VAT-DECREE-8-2017',
    source_locator: 'Article 59(1)(a)',
    is_critical_gate: false,
    points_allocated: 5,
    evaluateApplicability: (profile) => profile.country === 'AE',
    evaluateRule: (invoice) => {
      const type = invoice.metadata.document_type;
      if (type === 'TAX_INVOICE' || type === 'SIMPLIFIED_TAX_INVOICE') {
        return {
          state: 'PASS',
          message: `Document prominently designated as "${type.replace(/_/g, ' ')}".`,
          evidence_fields: ['metadata.document_type'],
          recommended_action: 'Maintain clear invoice type heading.',
          why_it_matters: 'Prevents commercial disputes and meets FTA statutory heading requirement.',
          implementation_steps: [],
        };
      }

      return {
        state: 'FAIL',
        message: `Invoice title "${type}" does not meet FTA requirement. Must state "Tax Invoice" or "Simplified Tax Invoice".`,
        evidence_fields: ['metadata.document_type'],
        recommended_action: 'Update invoice template heading to explicitly state "Tax Invoice".',
        why_it_matters: 'Invoices titled merely "Invoice" or "Proforma" do not qualify for VAT deduction in audits.',
        implementation_steps: ['Modify header template in invoicing software.'],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 6. LINE-ITEM TAX BREAKDOWN & 5% STANDARD VAT
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-LINE-TAX-BREAKDOWN',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_VERSION,
    title: 'Line Item Specification, Tax Rate (5%/0%), and Net Amount',
    description:
      'Article 59(1)(g) requires for each goods/services line: description, unit price, quantity/volume, rate of tax, and amount payable in AED.',
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
          why_it_matters: 'Line-level itemization is mandatory under both FTA VAT and Peppol PINT standards.',
          implementation_steps: ['Ensure line details are populated from ERP sales orders.'],
        };
      }

      const hasMissingPrices = invoice.lines.some((l) => l.unit_price === null || l.line_total === null);
      const hasMissingRates = invoice.lines.some((l) => l.tax_rate === null);

      if (hasMissingPrices || hasMissingRates) {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.5,
          message: 'Line items are present but some lack unit prices or explicit tax rate indications.',
          evidence_fields: ['lines[].unit_price', 'lines[].tax_rate'],
          recommended_action: 'Ensure each line explicitly specifies quantity, unit price, and VAT rate (5% or 0%).',
          why_it_matters: 'Peppol PINT AE validation rejects documents with missing line item financial tags.',
          implementation_steps: ['Review ERP invoice template column mapping.'],
        };
      }

      return {
        state: 'PASS',
        message: `All ${invoice.lines.length} line items contain valid descriptions, prices, and tax rates.`,
        evidence_fields: ['lines'],
        recommended_action: 'Maintain master data product codes and tax categories.',
        why_it_matters: 'Facilitates automated reconciliation and buyer ERP ingestion.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 7. TAX SUMMARY & AED CURRENCY SPECIFICATION
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-TOTAL-CURRENCY',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_VERSION,
    title: 'Total VAT Payable Displayed in UAE Dirham (AED)',
    description:
      'Article 59(1)(i) and Article 60 state that where prices are in foreign currency, the total gross amount and the VAT amount payable must be converted to UAE Dirhams (AED) using the UAE Central Bank exchange rate.',
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

      if (!invoice.totals.tax_total && invoice.totals.tax_total !== 0) {
        return {
          state: 'FAIL',
          message: 'Missing total VAT amount payable summary.',
          evidence_fields: ['totals.tax_total'],
          recommended_action: 'Display distinct VAT total line in the invoice summary box.',
          why_it_matters: 'FTA requires clear separation of net subtotal, VAT total, and grand total.',
          implementation_steps: ['Configure tax total summary block in invoicing template.'],
        };
      }

      if (invCurr !== 'AED' && taxCurr !== 'AED') {
        return {
          state: 'PARTIAL',
          partial_score_ratio: 0.6,
          message: `Invoice is denominated in ${invCurr}, but missing statutory conversion of VAT payable to AED.`,
          evidence_fields: ['currency.invoice_currency', 'currency.tax_currency'],
          recommended_action: 'State the UAE Central Bank exchange rate and equivalent VAT amount in AED.',
          why_it_matters: 'Foreign currency invoices must legally declare VAT in AED for FTA accounting.',
          implementation_steps: ['Add Central Bank rate lookup and secondary AED VAT line.'],
        };
      }

      return {
        state: 'PASS',
        message: 'Tax calculation, currency, and VAT totals are compliant.',
        evidence_fields: ['totals.tax_total', 'currency.tax_currency'],
        recommended_action: 'Maintain automated arithmetic reconciliation.',
        why_it_matters: 'Arithmetic consistency prevents penalties during tax audits.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 8. UNIQUE SEQUENTIAL INVOICE NUMBERING
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-INVOICE-NUMBER',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_VERSION,
    title: 'Unique Sequential Invoice Identification Number',
    description:
      'Article 59(1)(e) requires a sequential Tax Invoice number or a unique number which identifies the Tax Invoice and its order in the series.',
    category: 'NUMBERING_DATES',
    severity: 'HIGH',
    effective_from: '2018-01-01',
    source_id: 'AE-SRC-VAT-DECREE-8-2017',
    source_locator: 'Article 59(1)(e)',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) => profile.country === 'AE',
    evaluateRule: (invoice) => {
      const invNum = invoice.identifiers.invoice_number;
      if (!invNum || invNum.trim() === '') {
        return {
          state: 'FAIL',
          message: 'Missing invoice number or identifier.',
          evidence_fields: ['identifiers.invoice_number'],
          recommended_action: 'Ensure every invoice is assigned a unique, sequential number.',
          why_it_matters: 'Invoice deduplication is a primary control in tax clearance routers.',
          implementation_steps: ['Implement uninterrupted sequence numbering in billing engine.'],
        };
      }

      return {
        state: 'PASS',
        message: `Valid sequential invoice identifier detected: "${invNum}".`,
        evidence_fields: ['identifiers.invoice_number'],
        recommended_action: 'Ensure no gaps or duplicates occur across billing cycles.',
        why_it_matters: 'Essential for audit trail integrity.',
        implementation_steps: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 9. ACCREDITED SERVICE PROVIDER (ASP) INTEGRATION READINESS
  // -------------------------------------------------------------------------
  {
    rule_id: 'AE-RULE-ASP-READINESS',
    jurisdiction: 'AE',
    pack_version: UAE_RULE_PACK_VERSION,
    title: 'Accredited Service Provider (ASP) Connectivity Capability',
    description:
      'Under the UAE DCTCE e-invoicing model, businesses must transmit e-invoices to tax clearance through a certified Accredited Service Provider (ASP) operating on the Peppol network.',
    category: 'TRANSMISSION_SYSTEM_READINESS',
    severity: 'HIGH',
    effective_from: '2026-07-01',
    source_id: 'AE-SRC-MOF-EINVOICING-PHASE1',
    source_locator: 'Section 4 (ASP Accreditation Framework)',
    is_critical_gate: false,
    points_allocated: 10,
    evaluateApplicability: (profile) => profile.country === 'AE',
    evaluateRule: (invoice, profile, system) => {
      if (system.asp_partner_selected || system.electronic_transmission_capability) {
        return {
          state: 'PASS',
          message: 'Accredited Service Provider (ASP) / Electronic transmission capability established.',
          evidence_fields: ['system.asp_partner_selected', 'system.electronic_transmission_capability'],
          recommended_action: 'Complete staging environment transmission tests with your selected ASP.',
          why_it_matters: 'ASPs handle cryptographic signing, Peppol lookup (SMP), and tax platform reporting.',
          implementation_steps: ['Validate invoice payload against ASP API specs.'],
        };
      }

      return {
        state: 'FAIL',
        message:
          'No Accredited Service Provider (ASP) or automated transmission channel configured in invoicing workflow.',
        evidence_fields: ['system.asp_partner_selected', 'system.electronic_transmission_capability'],
        recommended_action:
          'Evaluate and contract with a certified UAE Ministry of Finance ASP provider before 2026.',
        why_it_matters:
          'Direct government portal manual entry is not supported for high-volume B2B under Phase 1/2.',
        implementation_steps: [
          'Review the official MoF list of accredited ASPs.',
          'Schedule integration between your accounting software and ASP connector.',
        ],
      };
    },
  },
];
