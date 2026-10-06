-- ============================================================================
-- InvoiceReady v1.0 - Authoritative PostgreSQL Schema
-- Compliant with Master Product, Regulatory & Security Baseline
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. IDENTITY & MULTI-TENANCY (Sections 27, 28)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
    organization_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    country_code VARCHAR(2) NOT NULL DEFAULT 'AE', -- 'AE' or 'PH'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'ANALYST', 'VIEWER');

CREATE TABLE IF NOT EXISTS organization_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'ANALYST',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_users_org ON organization_users(organization_id);
CREATE INDEX idx_org_users_user ON organization_users(user_id);

-- ----------------------------------------------------------------------------
-- 2. BUSINESS & SYSTEM PROFILES (PRD-042)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    country VARCHAR(2) NOT NULL, -- 'AE' | 'PH'
    business_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    tax_identifier VARCHAR(64) NOT NULL, -- TRN or TIN
    vat_registered BOOLEAN NOT NULL DEFAULT true,
    revenue_band VARCHAR(64) NOT NULL,
    transaction_types TEXT[] NOT NULL DEFAULT '{"B2B"}',
    taxpayer_category VARCHAR(64),
    branch_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    accounting_system VARCHAR(64) NOT NULL,
    invoicing_system VARCHAR(64) NOT NULL,
    pos_erp_name VARCHAR(128),
    current_invoice_format VARCHAR(32) NOT NULL DEFAULT 'PDF',
    structured_export_capability BOOLEAN NOT NULL DEFAULT false,
    electronic_transmission_capability BOOLEAN NOT NULL DEFAULT false,
    asp_partner_selected BOOLEAN NOT NULL DEFAULT false,
    cas_permit_active BOOLEAN NOT NULL DEFAULT false,
    number_of_invoice_templates INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. SCANS & DOCUMENTS (Sections 30, 31, 34, 35)
-- ----------------------------------------------------------------------------

CREATE TYPE scan_status AS ENUM (
    'CREATED', 'UPLOAD_PENDING', 'UPLOADED', 'SECURITY_CHECK',
    'EXTRACTING', 'NORMALIZING', 'VALIDATING', 'SCORING',
    'REPORTING', 'COMPLETED', 'FAILED', 'DELETED'
);

CREATE TABLE IF NOT EXISTS scans (
    scan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    jurisdiction VARCHAR(2) NOT NULL,
    status scan_status NOT NULL DEFAULT 'CREATED',
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    retention_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_pages (
    page_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    extracted_text TEXT,
    page_dimensions JSONB
);

-- ----------------------------------------------------------------------------
-- 4. CANONICAL INVOICE DATA (Section 10)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    invoice_number VARCHAR(128),
    document_type VARCHAR(64) NOT NULL,
    issue_date DATE,
    supply_date DATE,
    due_date DATE,
    invoice_currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    tax_currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    exchange_rate NUMERIC(12, 6),
    qr_code_data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_parties (
    party_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    party_role VARCHAR(16) NOT NULL, -- 'SELLER' or 'BUYER'
    legal_name VARCHAR(255),
    trade_name VARCHAR(255),
    tax_id VARCHAR(64),
    branch_code VARCHAR(16),
    country_code VARCHAR(2),
    address JSONB,
    contact_info JSONB
);

CREATE TABLE IF NOT EXISTS invoice_lines (
    line_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    description TEXT NOT NULL,
    product_code VARCHAR(128),
    quantity NUMERIC(14, 4),
    unit VARCHAR(32),
    unit_price NUMERIC(14, 4),
    discount NUMERIC(14, 4) DEFAULT 0,
    tax_category VARCHAR(32),
    tax_rate NUMERIC(6, 4),
    tax_amount NUMERIC(14, 4),
    line_total NUMERIC(14, 4)
);

CREATE TABLE IF NOT EXISTS invoice_taxes (
    tax_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL,
    taxable_amount NUMERIC(14, 4) NOT NULL,
    tax_rate NUMERIC(6, 4) NOT NULL,
    tax_amount NUMERIC(14, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_totals (
    total_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    subtotal NUMERIC(14, 4),
    discount_total NUMERIC(14, 4),
    charge_total NUMERIC(14, 4),
    tax_total NUMERIC(14, 4),
    grand_total NUMERIC(14, 4),
    amount_due NUMERIC(14, 4),
    vatable_sales NUMERIC(14, 4),
    vat_exempt_sales NUMERIC(14, 4),
    zero_rated_sales NUMERIC(14, 4)
);

-- ----------------------------------------------------------------------------
-- 5. REGULATORY RULES & SOURCES (Sections 12, 13, 14)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rule_sources (
    source_id VARCHAR(64) PRIMARY KEY,
    jurisdiction VARCHAR(2) NOT NULL,
    authority VARCHAR(255) NOT NULL,
    document_title VARCHAR(512) NOT NULL,
    document_number VARCHAR(128) NOT NULL,
    publication_date DATE NOT NULL,
    effective_date DATE NOT NULL,
    url TEXT NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS rule_packs (
    pack_id VARCHAR(64) PRIMARY KEY, -- e.g. 'AE-2026'
    jurisdiction VARCHAR(2) NOT NULL,
    version VARCHAR(32) NOT NULL,    -- e.g. '1.0.0'
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rules (
    rule_id VARCHAR(64) PRIMARY KEY,
    pack_id VARCHAR(64) NOT NULL REFERENCES rule_packs(pack_id),
    jurisdiction VARCHAR(2) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    effective_from DATE NOT NULL,
    effective_until DATE,
    source_id VARCHAR(64) NOT NULL REFERENCES rule_sources(source_id),
    source_locator VARCHAR(128) NOT NULL,
    is_critical_gate BOOLEAN NOT NULL DEFAULT false,
    failure_score_cap INT
);

-- ----------------------------------------------------------------------------
-- 6. VALIDATION & EVIDENCE (Section 11, 12)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS validation_runs (
    run_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
    rule_pack_version VARCHAR(32) NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_results (
    result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES validation_runs(run_id) ON DELETE CASCADE,
    rule_id VARCHAR(64) NOT NULL REFERENCES rules(rule_id),
    state VARCHAR(32) NOT NULL, -- 'PASS', 'FAIL', 'PARTIAL', 'NOT_APPLICABLE'
    score_awarded NUMERIC(6, 2) NOT NULL,
    points_possible NUMERIC(6, 2) NOT NULL,
    message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS validation_evidence (
    evidence_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES validation_results(result_id) ON DELETE CASCADE,
    field_name VARCHAR(128) NOT NULL,
    original_value TEXT,
    normalized_value TEXT,
    confidence NUMERIC(4, 3) NOT NULL,
    source_document VARCHAR(255) NOT NULL,
    page_number INT NOT NULL,
    user_modified BOOLEAN NOT NULL DEFAULT false
);

-- ----------------------------------------------------------------------------
-- 7. SCORECARDS, FINDINGS & REMEDIATION (Sections 17-23)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scorecards (
    scorecard_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
    overall_score INT NOT NULL,
    raw_calculated_score NUMERIC(5, 2) NOT NULL,
    classification VARCHAR(32) NOT NULL,
    critical_gate_triggered BOOLEAN NOT NULL DEFAULT false,
    critical_gate_cap INT,
    dimension_scores JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS findings (
    finding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
    rule_id VARCHAR(64) NOT NULL REFERENCES rules(rule_id),
    severity VARCHAR(16) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    impact TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    implementation_steps TEXT[] NOT NULL,
    evidence_snapshot JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS remediation_actions (
    action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
    finding_id UUID NOT NULL REFERENCES findings(finding_id) ON DELETE CASCADE,
    priority VARCHAR(4) NOT NULL, -- 'P0' | 'P1' | 'P2'
    effort VARCHAR(16) NOT NULL,   -- 'LOW' | 'MEDIUM' | 'HIGH'
    owner_role VARCHAR(32) NOT NULL,
    estimated_timeline_days INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
    rule_pack_version VARCHAR(32) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    storage_path VARCHAR(512),
    retention_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- ----------------------------------------------------------------------------
-- 8. PRIVACY, CONSENTS & AUDIT (Sections 35, 36, 50, 51, 59)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS consents (
    consent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    policy_version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0',
    necessary BOOLEAN NOT NULL DEFAULT true,
    preferences BOOLEAN NOT NULL DEFAULT false,
    analytics BOOLEAN NOT NULL DEFAULT false,
    marketing BOOLEAN NOT NULL DEFAULT false,
    ip_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS privacy_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    requester_email VARCHAR(255) NOT NULL,
    request_type VARCHAR(32) NOT NULL, -- 'ACCESS', 'CORRECTION', 'DELETION', 'EXPORT'
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    actor_id VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    result VARCHAR(16) NOT NULL, -- 'SUCCESS' | 'FAILURE'
    ip_address VARCHAR(45) NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_time ON audit_logs(organization_id, timestamp DESC);
