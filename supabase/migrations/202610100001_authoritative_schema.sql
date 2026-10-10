-- ==============================================================================
-- InvoiceReady v1.0 - Migration 0001: Authoritative Database Schema
-- Consolidates all tables, foreign keys, views, and indexes.
-- Target: Supabase PostgreSQL & Authoritative Engine
-- ==============================================================================

DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Ensure roles exist for Supabase RLS compatibility
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
END $$;

-- Ensure auth and storage schemas exist for compatibility
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

-- Ensure auth.uid() and storage.foldername helper functions exist
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claim.sub', true);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[] AS $$
  SELECT string_to_array(name, '/');
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id VARCHAR(64) PRIMARY KEY,
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT,
  owner VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- 1. Organizations Table (Multi-Tenant Scoping)
CREATE TABLE IF NOT EXISTS public.organizations (
    organization_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT 'My Organization',
    country_code VARCHAR(2) NOT NULL DEFAULT 'AE',
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Profiles Table (Mirrors auth.users and maps user identities)
CREATE TABLE IF NOT EXISTS public.profiles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL DEFAULT '',
    avatar_url TEXT,
    role VARCHAR(32) NOT NULL DEFAULT 'ANALYST',
    default_organization_id VARCHAR(64) REFERENCES public.organizations(organization_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Organization Membership (RBAC Mapping)
CREATE TABLE IF NOT EXISTS public.organization_users (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'ANALYST',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(organization_id, user_id)
);

-- 4. Business Profiles
CREATE TABLE IF NOT EXISTS public.business_profiles (
    profile_id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    country VARCHAR(2) NOT NULL DEFAULT 'AE',
    business_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    tax_identifier VARCHAR(64) NOT NULL,
    vat_registered BOOLEAN NOT NULL DEFAULT true,
    revenue_band VARCHAR(64) NOT NULL DEFAULT 'BELOW_50M_AED',
    annual_turnover_amount NUMERIC(15, 2),
    transaction_types TEXT[] NOT NULL DEFAULT '{"B2B"}',
    taxpayer_category VARCHAR(64),
    branch_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. System Profiles
CREATE TABLE IF NOT EXISTS public.system_profiles (
    profile_id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    accounting_system VARCHAR(64) NOT NULL,
    invoicing_system VARCHAR(64) NOT NULL,
    pos_erp_name VARCHAR(128),
    current_invoice_format VARCHAR(32) NOT NULL DEFAULT 'PDF',
    structured_export_capability BOOLEAN NOT NULL DEFAULT false,
    electronic_transmission_capability BOOLEAN NOT NULL DEFAULT false,
    erp_customizable BOOLEAN NOT NULL DEFAULT true,
    daily_invoice_volume INT NOT NULL DEFAULT 10,
    has_existing_integration BOOLEAN NOT NULL DEFAULT false,
    integration_type VARCHAR(64),
    asp_partner_selected BOOLEAN NOT NULL DEFAULT false,
    cas_permit_active BOOLEAN NOT NULL DEFAULT false,
    number_of_invoice_templates INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Authoritative Scan Sessions Table
CREATE TABLE IF NOT EXISTS public.scan_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    scan_id VARCHAR(64),
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    jurisdiction VARCHAR(2) NOT NULL DEFAULT 'AE',
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    business_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    system_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    rule_pack_version VARCHAR(32) NOT NULL DEFAULT 'AE-2026.2',
    document_name VARCHAR(255),
    document_mime_type VARCHAR(128),
    document_size_bytes BIGINT,
    document_hash VARCHAR(128),
    file_name VARCHAR(255),
    file_size_bytes BIGINT,
    file_sha256 TEXT,
    storage_path VARCHAR(512),
    security_scan_result JSONB,
    extraction_result JSONB,
    extraction_json JSONB,
    applicable_rules JSONB,
    validation_results JSONB,
    scorecard JSONB,
    scorecard_json JSONB,
    overall_score NUMERIC(5,2),
    readiness_status VARCHAR(32) DEFAULT 'ASSESSED',
    findings JSONB,
    remediation_plan JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    uploaded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Scan Documents Table
CREATE TABLE IF NOT EXISTS public.scan_documents (
    document_id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    scan_id VARCHAR(64) REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    session_id VARCHAR(64) REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    retention_expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SECURITY_PASSED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Scan Reports Table
CREATE TABLE IF NOT EXISTS public.scan_reports (
    report_id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    scan_id VARCHAR(64) REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    session_id VARCHAR(64) REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    rule_pack_version VARCHAR(32) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    retention_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Findings Table
CREATE TABLE IF NOT EXISTS public.findings (
    finding_id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    scan_id VARCHAR(64) REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    rule_id VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    legal_reference TEXT,
    field_name TEXT,
    expected_value TEXT,
    actual_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Remediations Table
CREATE TABLE IF NOT EXISTS public.remediations (
    remediation_id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    scan_id VARCHAR(64) REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(16) NOT NULL DEFAULT 'HIGH',
    category VARCHAR(32) NOT NULL DEFAULT 'TECHNICAL',
    estimated_effort VARCHAR(32) DEFAULT '1-2 weeks',
    technical_steps JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Durable Job Queue Table
CREATE TABLE IF NOT EXISTS public.job_queue (
    operation_id VARCHAR(64) PRIMARY KEY,
    scan_id VARCHAR(64) NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(128),
    lease_expires_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    payload JSONB,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    log_id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    actor_id VARCHAR(128) NOT NULL,
    user_id VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64),
    resource_id VARCHAR(128) NOT NULL,
    result VARCHAR(16) NOT NULL,
    client_ip TEXT,
    ip_address VARCHAR(45) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. Privacy Consents Table
CREATE TABLE IF NOT EXISTS public.privacy_consents (
    consent_id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    policy_version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0',
    necessary BOOLEAN NOT NULL DEFAULT true,
    preferences BOOLEAN NOT NULL DEFAULT false,
    analytics BOOLEAN NOT NULL DEFAULT false,
    marketing BOOLEAN NOT NULL DEFAULT false,
    jurisdiction_context VARCHAR(4) NOT NULL DEFAULT 'AE',
    consent_type TEXT,
    consented BOOLEAN DEFAULT true,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. Privacy Requests Table
CREATE TABLE IF NOT EXISTS public.privacy_requests (
    request_id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    requester_email VARCHAR(255) NOT NULL,
    request_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. Backward-Compatible Compatibility Views
CREATE OR REPLACE VIEW public.users AS
    SELECT id AS user_id, email, full_name, role, default_organization_id, created_at, updated_at
    FROM public.profiles;

CREATE OR REPLACE VIEW public.scans AS
    SELECT session_id AS scan_id, session_id, organization_id, jurisdiction, status,
           created_by, user_id, business_profile, system_profile, rule_pack_version,
           document_name, document_mime_type, document_size_bytes, document_hash,
           storage_path, security_scan_result, extraction_result, applicable_rules,
           validation_results, scorecard, findings, remediation_plan, error_message,
           created_at, uploaded_at, completed_at, updated_at
    FROM public.scan_sessions;

CREATE OR REPLACE VIEW public.documents AS
    SELECT document_id, organization_id, session_id AS scan_id, session_id, file_name,
           storage_path, file_size_bytes, mime_type, sha256_hash, retention_expires_at,
           status, created_at
    FROM public.scan_documents;

CREATE OR REPLACE VIEW public.reports AS
    SELECT report_id, organization_id, session_id AS scan_id, session_id, rule_pack_version,
           storage_path, retention_expires_at, created_at
    FROM public.scan_reports;

CREATE OR REPLACE VIEW public.consents AS
    SELECT consent_id, organization_id, user_id, policy_version, necessary, preferences,
           analytics, marketing, jurisdiction_context, timestamp, created_at
    FROM public.privacy_consents;

-- 16. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_scan_sessions_org ON public.scan_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_documents_retention ON public.scan_documents(retention_expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_time ON public.audit_logs(organization_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON public.job_queue(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_org_users_lookup ON public.organization_users(organization_id, user_id);
