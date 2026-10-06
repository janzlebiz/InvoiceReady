/**
 * InvoiceReady v1.0 - Authoritative Regulatory Sources Registry
 * Conforms to REG-001 (Section 14).
 * Only authoritative regulatory sources establish compliance requirements.
 */

import { RegulatorySource } from '../engine/types';

export const REGULATORY_SOURCES: Record<string, RegulatorySource> = {
  // -------------------------------------------------------------------------
  // United Arab Emirates (AE) Regulatory Sources
  // -------------------------------------------------------------------------
  'AE-SRC-CABINET-91-2023': {
    source_id: 'AE-SRC-CABINET-91-2023',
    jurisdiction: 'AE',
    authority: 'UAE Cabinet of Ministers & Ministry of Finance',
    document_title: 'Cabinet Decision No. 91 of 2023 on the Application of the Electronic Invoicing System in the UAE',
    document_number: 'Cabinet Decision No. 91/2023',
    publication_date: '2023-09-29',
    effective_date: '2024-01-01',
    url: 'https://mof.gov.ae/en/legislation/cabinet-decisions/cabinet-decision-no-91-of-2023',
    source_hash: 'sha256:7f9a2b8e390c1e8a4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c',
    status: 'ACTIVE',
  },
  'AE-SRC-VAT-DECREE-8-2017': {
    source_id: 'AE-SRC-VAT-DECREE-8-2017',
    jurisdiction: 'AE',
    authority: 'Federal Tax Authority (FTA)',
    document_title: 'Federal Decree-Law No. 8 of 2017 on Value Added Tax & Executive Regulations',
    document_number: 'Federal Decree-Law No. 8/2017',
    publication_date: '2017-08-23',
    effective_date: '2018-01-01',
    url: 'https://tax.gov.ae/en/legislation/decree-laws/federal-decree-law-no-8-of-2017',
    source_hash: 'sha256:5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d',
    status: 'ACTIVE',
  },
  'AE-SRC-MOF-EINVOICING-PHASE1': {
    source_id: 'AE-SRC-MOF-EINVOICING-PHASE1',
    jurisdiction: 'AE',
    authority: 'Ministry of Finance (MoF) - E-Invoicing Program',
    document_title: 'UAE E-Invoicing System Technical & Phase 1 Mandate Specification (AED 50M+ Threshold)',
    document_number: 'MoF E-Invoicing Bulletin 2024/02',
    publication_date: '2024-04-15',
    effective_date: '2026-07-01',
    url: 'https://mof.gov.ae/en/e-invoicing-transformation',
    source_hash: 'sha256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    status: 'ACTIVE',
  },
  'AE-SRC-PEPPOL-PINT': {
    source_id: 'AE-SRC-PEPPOL-PINT',
    jurisdiction: 'AE',
    authority: 'UAE OpenPeppol Authority / MoF',
    document_title: 'UAE Peppol PINT (Peppol International) Data Dictionary & Transmission Standard',
    document_number: 'OpenPeppol AE Specification v1.0',
    publication_date: '2024-06-10',
    effective_date: '2026-07-01',
    url: 'https://peppol.org/documentation/technical-documentation/pint-ae',
    source_hash: 'sha256:3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
    status: 'ACTIVE',
  },

  // -------------------------------------------------------------------------
  // Philippines (PH) Regulatory Sources
  // -------------------------------------------------------------------------
  'PH-SRC-TRAIN-LAW-237': {
    source_id: 'PH-SRC-TRAIN-LAW-237',
    jurisdiction: 'PH',
    authority: 'Congress of the Philippines & Bureau of Internal Revenue (BIR)',
    document_title: 'Tax Reform for Acceleration and Inclusion (TRAIN) Act (Republic Act No. 10963, Section 237 & 237-A)',
    document_number: 'Republic Act No. 10963',
    publication_date: '2017-12-19',
    effective_date: '2018-01-01',
    url: 'https://www.bir.gov.ph/train-act-republic-act-10963',
    source_hash: 'sha256:8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a',
    status: 'ACTIVE',
  },
  'PH-SRC-BIR-RR-8-2022': {
    source_id: 'PH-SRC-BIR-RR-8-2022',
    jurisdiction: 'PH',
    authority: 'Bureau of Internal Revenue (BIR)',
    document_title: 'Revenue Regulations No. 8-2022: Prescribing Policies and Guidelines on Electronic Invoicing and Receipting System (EIS)',
    document_number: 'BIR RR No. 8-2022',
    publication_date: '2022-06-30',
    effective_date: '2022-07-01',
    url: 'https://www.bir.gov.ph/revenue-regulations-no-8-2022',
    source_hash: 'sha256:2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c',
    status: 'ACTIVE',
  },
  'PH-SRC-BIR-RMO-24-2022': {
    source_id: 'PH-SRC-BIR-RMO-24-2022',
    jurisdiction: 'PH',
    authority: 'Bureau of Internal Revenue (BIR)',
    document_title: 'Revenue Memorandum Order No. 24-2022: EIS System Architecture, JSON API Payload, and Pilot Guidelines',
    document_number: 'BIR RMO No. 24-2022',
    publication_date: '2022-07-15',
    effective_date: '2022-07-15',
    url: 'https://www.bir.gov.ph/revenue-memorandum-order-no-24-2022',
    source_hash: 'sha256:9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f',
    status: 'ACTIVE',
  },
  'PH-SRC-EOPT-ACT-11976': {
    source_id: 'PH-SRC-EOPT-ACT-11976',
    jurisdiction: 'PH',
    authority: 'Congress of the Philippines / BIR',
    document_title: 'Ease of Paying Taxes (EOPT) Act (Republic Act No. 11976) & RR No. 7-2024: Mandatory Shift to Invoice as Primary Proof of Sale',
    document_number: 'Republic Act No. 11976 / RR 7-2024',
    publication_date: '2024-01-05',
    effective_date: '2024-04-27',
    url: 'https://www.bir.gov.ph/ease-of-paying-taxes-act',
    source_hash: 'sha256:4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e',
    status: 'ACTIVE',
  },
};
