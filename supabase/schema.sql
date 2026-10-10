-- ==============================================================================
-- InvoiceReady - Authoritative Supabase Production Schema, Security & RLS
-- Target: Supabase PostgreSQL (Compatible with GitHub + Vercel + Supabase)
-- Consolidated from: 202610100001_authoritative_schema.sql & 202610100002_security_and_storage.sql
-- ==============================================================================

-- 0. Extensions & Schemas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

-- Ensure auth.uid() and storage.foldername helper functions exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uid' AND pronamespace = 'auth'::regnamespace) THEN
        CREATE OR REPLACE FUNCTION auth.uid()
        RETURNS uuid AS $func$
            SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $func$ LANGUAGE sql STABLE;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[] AS $$
  SELECT string_to_array(name, '/');
$$ LANGUAGE sql IMMUTABLE;

-- Ensure storage buckets table exists
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT,
  owner UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- 1. Organizations Table (Multi-Tenant Scoping)
CREATE TABLE IF NOT EXISTS public.organizations (
    organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL DEFAULT 'My Organization',
    country_code VARCHAR(2) NOT NULL DEFAULT 'AE',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. User Profiles (Mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL DEFAULT '',
    avatar_url TEXT,
    role VARCHAR(32) NOT NULL DEFAULT 'ANALYST',
    default_organization_id UUID REFERENCES public.organizations(organization_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Organization Membership (RBAC Mapping)
CREATE TABLE IF NOT EXISTS public.organization_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'ANALYST',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(organization_id, user_id)
);

-- 4. Business Assessment Profiles
CREATE TABLE IF NOT EXISTS public.business_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- 5. System Assessment Profiles
CREATE TABLE IF NOT EXISTS public.system_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- 6. Authoritative Scan Sessions
CREATE TABLE IF NOT EXISTS public.scan_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID,
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- 7. Scan Documents
CREATE TABLE IF NOT EXISTS public.scan_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    scan_id UUID REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    retention_expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SECURITY_PASSED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Scan Reports
CREATE TABLE IF NOT EXISTS public.scan_reports (
    report_id VARCHAR(64) PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    scan_id UUID REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    rule_pack_version VARCHAR(32) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    retention_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Findings
CREATE TABLE IF NOT EXISTS public.findings (
    finding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    scan_id UUID REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
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

-- 10. Remediations
CREATE TABLE IF NOT EXISTS public.remediations (
    remediation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    scan_id UUID REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(16) NOT NULL DEFAULT 'HIGH',
    category VARCHAR(32) NOT NULL DEFAULT 'TECHNICAL',
    estimated_effort VARCHAR(32) DEFAULT '1-2 weeks',
    technical_steps JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Durable Job Queue (Adaptive foreign-key typing)
DO $$ 
DECLARE
    session_id_type text;
    org_id_type text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_queue') THEN
        SELECT data_type INTO session_id_type
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'scan_sessions' AND column_name = 'session_id';

        SELECT data_type INTO org_id_type
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'organization_id';

        IF session_id_type = 'uuid' THEN
            EXECUTE 'CREATE TABLE public.job_queue (
                operation_id VARCHAR(128) PRIMARY KEY,
                scan_id UUID NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
                organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
                status VARCHAR(32) NOT NULL DEFAULT ''QUEUED'',
                attempt_count INT NOT NULL DEFAULT 0,
                max_attempts INT NOT NULL DEFAULT 3,
                locked_at TIMESTAMPTZ,
                locked_by VARCHAR(128),
                lease_expires_at TIMESTAMPTZ,
                next_retry_at TIMESTAMPTZ,
                payload JSONB,
                result JSONB,
                error_message TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT timezone(''utc''::text, now()),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone(''utc''::text, now())
            )';
        ELSE
            EXECUTE 'CREATE TABLE public.job_queue (
                operation_id VARCHAR(128) PRIMARY KEY,
                scan_id VARCHAR(64) NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
                organization_id VARCHAR(64) NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
                status VARCHAR(32) NOT NULL DEFAULT ''QUEUED'',
                attempt_count INT NOT NULL DEFAULT 0,
                max_attempts INT NOT NULL DEFAULT 3,
                locked_at TIMESTAMPTZ,
                locked_by VARCHAR(128),
                lease_expires_at TIMESTAMPTZ,
                next_retry_at TIMESTAMPTZ,
                payload JSONB,
                result JSONB,
                error_message TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT timezone(''utc''::text, now()),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone(''utc''::text, now())
            )';
        END IF;
    END IF;
END $$;

-- 12. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    actor_id VARCHAR(128) NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64),
    resource_id VARCHAR(128) NOT NULL,
    result VARCHAR(16) NOT NULL,
    client_ip TEXT,
    ip_address VARCHAR(45),
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. Privacy Consents
CREATE TABLE IF NOT EXISTS public.privacy_consents (
    consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

-- 14. Privacy Requests
CREATE TABLE IF NOT EXISTS public.privacy_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    requester_email VARCHAR(255) NOT NULL,
    request_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. Compatibility Views
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

-- 16. Indexes
CREATE INDEX IF NOT EXISTS idx_scan_sessions_org ON public.scan_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_documents_retention ON public.scan_documents(retention_expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_time ON public.audit_logs(organization_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON public.job_queue(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_org_users_lookup ON public.organization_users(organization_id, user_id);

-- 17. Storage Buckets Setup
INSERT INTO storage.buckets (id, name, public) 
VALUES ('quarantine', 'quarantine', false),
       ('invoices', 'invoices', false),
       ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 18. Enable Row Level Security (RLS) on all tenant tables
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.privacy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.privacy_requests ENABLE ROW LEVEL SECURITY;

-- 19. Database RLS Policies

-- Organizations
DROP POLICY IF EXISTS "Tenant members can view organizations" ON public.organizations;
CREATE POLICY "Tenant members can view organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE (user_id)::text = (auth.uid())::text
  ) OR (created_by)::text = (auth.uid())::text
);

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING ((id)::text = (auth.uid())::text);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING ((id)::text = (auth.uid())::text);

-- Organization Users
DROP POLICY IF EXISTS "Members can view organization memberships" ON public.organization_users;
CREATE POLICY "Members can view organization memberships"
ON public.organization_users FOR SELECT
TO authenticated
USING (  (user_id)::text = (auth.uid())::text);

-- Scan Sessions
DROP POLICY IF EXISTS "Tenant members can view scan sessions" ON public.scan_sessions;
CREATE POLICY "Tenant members can view scan sessions"
ON public.scan_sessions FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE (user_id)::text = (auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can insert scan sessions" ON public.scan_sessions;
CREATE POLICY "Tenant analysts and owners can insert scan sessions"
ON public.scan_sessions FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE (user_id)::text = (auth.uid())::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can update scan sessions" ON public.scan_sessions;
CREATE POLICY "Tenant analysts and owners can update scan sessions"
ON public.scan_sessions FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE (user_id)::text = (auth.uid())::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS "Tenant admins and owners can delete scan sessions" ON public.scan_sessions;
CREATE POLICY "Tenant admins and owners can delete scan sessions"
ON public.scan_sessions FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE (user_id)::text = (auth.uid())::text AND role IN ('ADMIN', 'OWNER')
  )
);

-- Scan Documents
DROP POLICY IF EXISTS "Tenant members can view scan documents" ON public.scan_documents;
CREATE POLICY "Tenant members can view scan documents"
ON public.scan_documents FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE (user_id)::text = (auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can insert scan documents" ON public.scan_documents;
CREATE POLICY "Tenant analysts and owners can insert scan documents"
ON public.scan_documents FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE (user_id)::text = (auth.uid())::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS "Tenant admins and owners can delete scan documents" ON public.scan_documents;
CREATE POLICY "Tenant admins and owners can delete scan documents"
ON public.scan_documents FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE (user_id)::text = (auth.uid())::text AND role IN ('ADMIN', 'OWNER')
  )
);

-- Scan Reports
DROP POLICY IF EXISTS "Tenant members can view scan reports" ON public.scan_reports;
CREATE POLICY "Tenant members can view scan reports"
ON public.scan_reports FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE (user_id)::text = (auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can insert scan reports" ON public.scan_reports;
CREATE POLICY "Tenant analysts and owners can insert scan reports"
ON public.scan_reports FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE (user_id)::text = (auth.uid())::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

-- Findings & Remediations
DROP POLICY IF EXISTS "Tenant members can view findings" ON public.findings;
CREATE POLICY "Tenant members can view findings"
ON public.findings FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE (user_id)::text = (auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Tenant members can view remediations" ON public.remediations;
CREATE POLICY "Tenant members can view remediations"
ON public.remediations FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE (user_id)::text = (auth.uid())::text
  )
);

-- Job Queue Policies
DROP POLICY IF EXISTS "Tenant members can view job queue" ON public.job_queue;
CREATE POLICY "Tenant members can view job queue"
ON public.job_queue FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE (user_id)::text = (auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Tenant members can manage job queue" ON public.job_queue;
CREATE POLICY "Tenant members can manage job queue"
ON public.job_queue FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE (user_id)::text = (auth.uid())::text
  )
);

-- Audit Logs Policies
DROP POLICY IF EXISTS "Tenant members can insert audit logs" ON public.audit_logs;
CREATE POLICY "Tenant members can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE (user_id)::text = (auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Admins and owners can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins and owners can read audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users 
    WHERE (user_id)::text = (auth.uid())::text AND role IN ('ADMIN', 'OWNER')
  )
);

-- 20. Storage RLS Policies (Tenant Prefix Scoped: <org_id>/<scan_id>/<file>)
DROP POLICY IF EXISTS "Tenant scoped read on storage objects" ON storage.objects;
CREATE POLICY "Tenant scoped read on storage objects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('quarantine', 'invoices', 'reports')
  AND (storage.foldername(name))[1] IN (
    SELECT (organization_id)::text FROM public.organization_users WHERE (user_id)::text = (auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can upload storage objects" ON storage.objects;
CREATE POLICY "Tenant analysts and owners can upload storage objects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('quarantine', 'invoices', 'reports')
  AND (storage.foldername(name))[1] IN (
    SELECT (organization_id)::text FROM public.organization_users 
    WHERE (user_id)::text = (auth.uid())::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can update storage objects" ON storage.objects;
CREATE POLICY "Tenant analysts and owners can update storage objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('quarantine', 'invoices', 'reports')
  AND (storage.foldername(name))[1] IN (
    SELECT (organization_id)::text FROM public.organization_users 
    WHERE (user_id)::text = (auth.uid())::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS "Tenant admins and owners can delete storage objects" ON storage.objects;
CREATE POLICY "Tenant admins and owners can delete storage objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('quarantine', 'invoices', 'reports')
  AND (storage.foldername(name))[1] IN (
    SELECT (organization_id)::text FROM public.organization_users 
    WHERE (user_id)::text = (auth.uid())::text AND role IN ('ADMIN', 'OWNER')
  )
);

-- 21. Profile Synchronization Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'ANALYST'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
