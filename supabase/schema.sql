-- ==============================================================================
-- InvoiceReady - Supabase Production Schema & Row Level Security (RLS)
-- Target: Supabase PostgreSQL (Compatible with GitHub + Vercel + Supabase)
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Organizations Table (Multi-Tenant Scoping)
CREATE TABLE IF NOT EXISTS public.organizations (
    organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'My Organization',
    country_code VARCHAR(2) NOT NULL DEFAULT 'AE', -- 'AE' or 'PH'
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. User Profiles (Mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'ANALYST' CHECK (role IN ('OWNER', 'ADMIN', 'ANALYST', 'VIEWER')),
    default_organization_id UUID REFERENCES public.organizations(organization_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Organization Membership (RBAC Mapping)
CREATE TABLE IF NOT EXISTS public.organization_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'ANALYST' CHECK (role IN ('OWNER', 'ADMIN', 'ANALYST', 'VIEWER')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(organization_id, user_id)
);

-- 5. Business Assessment Profiles
CREATE TABLE IF NOT EXISTS public.business_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    country VARCHAR(2) NOT NULL DEFAULT 'AE',
    business_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    tax_identifier VARCHAR(64) NOT NULL,
    vat_registered BOOLEAN NOT NULL DEFAULT true,
    revenue_band VARCHAR(64) NOT NULL DEFAULT '10M-50M',
    transaction_types TEXT[] NOT NULL DEFAULT '{"B2B"}',
    taxpayer_category VARCHAR(64),
    branch_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. System Assessment Profiles
CREATE TABLE IF NOT EXISTS public.system_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    accounting_system VARCHAR(64) NOT NULL,
    invoicing_system VARCHAR(64) NOT NULL,
    pos_erp_name VARCHAR(128),
    current_invoice_format VARCHAR(32) NOT NULL DEFAULT 'PDF',
    structured_export_capability BOOLEAN NOT NULL DEFAULT false,
    erp_customizable BOOLEAN NOT NULL DEFAULT true,
    daily_invoice_volume INT NOT NULL DEFAULT 10,
    has_existing_integration BOOLEAN NOT NULL DEFAULT false,
    integration_type VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Scan & Assessment Sessions
CREATE TABLE IF NOT EXISTS public.scan_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    jurisdiction VARCHAR(2) NOT NULL DEFAULT 'AE',
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    storage_path TEXT,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    file_sha256 TEXT,
    overall_score NUMERIC(5,2) DEFAULT 0,
    readiness_status VARCHAR(32) DEFAULT 'ASSESSED',
    extraction_json JSONB,
    scorecard_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Compliance Findings
CREATE TABLE IF NOT EXISTS public.findings (
    finding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    rule_id VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'PASS')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    legal_reference TEXT,
    field_name TEXT,
    expected_value TEXT,
    actual_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Remediation Plans
CREATE TABLE IF NOT EXISTS public.remediations (
    remediation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(16) NOT NULL DEFAULT 'HIGH',
    category VARCHAR(32) NOT NULL DEFAULT 'TECHNICAL',
    estimated_effort VARCHAR(32) DEFAULT '1-2 weeks',
    technical_steps JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(organization_id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128),
    client_ip TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- Triggers: Automatic User Profile Creation on Supabase Auth Sign Up
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Create default organization for new user
  INSERT INTO public.organizations (name, country_code, created_by)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'organization_name', 'My Organization'),
    'AE',
    new.id
  )
  RETURNING organization_id INTO default_org_id;

  -- Create public profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, default_organization_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'OWNER',
    default_org_id
  );

  -- Link user as OWNER of their default organization
  INSERT INTO public.organization_users (organization_id, user_id, role)
  VALUES (default_org_id, new.id, 'OWNER');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: check if authenticated user belongs to organization
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles Policies
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Organizations Policies
CREATE POLICY "Users can view organizations they belong to"
  ON public.organizations FOR SELECT
  USING (public.user_belongs_to_org(organization_id) OR created_by = auth.uid());

CREATE POLICY "Users can update organizations they are ADMIN/OWNER of"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = organizations.organization_id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
    )
  );

-- Assessment & Scan Policies
-- Assessment & Scan Policies (Strict Tenant Isolation)
CREATE POLICY "Users can view scan sessions in their orgs"
  ON public.scan_sessions FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(organization_id));

CREATE POLICY "Analysts and owners can create scan sessions in their org"
  ON public.scan_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = scan_sessions.organization_id
        AND user_id = auth.uid()
        AND role IN ('ANALYST', 'ADMIN', 'OWNER')
    )
  );

CREATE POLICY "Analysts and owners can update scan sessions in their org"
  ON public.scan_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = scan_sessions.organization_id
        AND user_id = auth.uid()
        AND role IN ('ANALYST', 'ADMIN', 'OWNER')
    )
  );

CREATE POLICY "Admins and owners can delete scan sessions in their org"
  ON public.scan_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = scan_sessions.organization_id
        AND user_id = auth.uid()
        AND role IN ('ADMIN', 'OWNER')
    )
  );

-- Findings Policies (Tenant-Scoped)
CREATE POLICY "Users can view findings for their scan sessions"
  ON public.findings FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(organization_id));

CREATE POLICY "Analysts and owners can insert findings"
  ON public.findings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = findings.organization_id
        AND user_id = auth.uid()
        AND role IN ('ANALYST', 'ADMIN', 'OWNER')
    )
  );

-- Remediations Policies (Tenant-Scoped)
CREATE POLICY "Users can view remediations for their scan sessions"
  ON public.remediations FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(organization_id));

CREATE POLICY "Analysts and owners can insert remediations"
  ON public.remediations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = remediations.organization_id
        AND user_id = auth.uid()
        AND role IN ('ANALYST', 'ADMIN', 'OWNER')
    )
  );

-- Business & System Profiles Policies (Tenant-Scoped)
CREATE POLICY "Users can view their organization business profiles"
  ON public.business_profiles FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(organization_id));

CREATE POLICY "Analysts and owners can manage business profiles"
  ON public.business_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = business_profiles.organization_id
        AND user_id = auth.uid()
        AND role IN ('ANALYST', 'ADMIN', 'OWNER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = business_profiles.organization_id
        AND user_id = auth.uid()
        AND role IN ('ANALYST', 'ADMIN', 'OWNER')
    )
  );

CREATE POLICY "Users can view their organization system profiles"
  ON public.system_profiles FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(organization_id));

CREATE POLICY "Analysts and owners can manage system profiles"
  ON public.system_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = system_profiles.organization_id
        AND user_id = auth.uid()
        AND role IN ('ANALYST', 'ADMIN', 'OWNER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = system_profiles.organization_id
        AND user_id = auth.uid()
        AND role IN ('ANALYST', 'ADMIN', 'OWNER')
    )
  );

-- Audit Logs Policies (Append-Only Tenant-Scoped)
CREATE POLICY "Tenant members can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_org(organization_id));

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_id = audit_logs.organization_id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
    )
  );

-- ------------------------------------------------------------------------------
-- 11. Supabase Storage Buckets Setup & Restrictive Policies
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('quarantine', 'quarantine', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS: Restrictive tenant-scoped access by path prefix (<org_id>/<scan_id>/<object_id>)
CREATE POLICY "Tenant scoped read on storage objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('quarantine', 'invoices', 'reports')
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant analysts and owners can upload storage objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('quarantine', 'invoices', 'reports')
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_users
      WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
    )
  );

CREATE POLICY "Tenant admins and owners can delete storage objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('quarantine', 'invoices', 'reports')
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_users
      WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER')
    )
  );
