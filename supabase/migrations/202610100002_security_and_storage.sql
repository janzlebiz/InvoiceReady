-- ==============================================================================
-- InvoiceReady v1.0 - Migration 0002: Security, RLS & Storage Hardening
-- Enforces strict Row Level Security (RLS) on all tenant tables and storage.objects
-- ==============================================================================

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

-- Ensure auth and storage schemas exist
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

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

-- 1. Enable RLS on all sensitive tenant-owned tables
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

-- 2. Organizations Policies
DROP POLICY IF EXISTS "Tenant members can view organizations" ON public.organizations;
CREATE POLICY "Tenant members can view organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()::text
  ) OR created_by = auth.uid()::text
);

-- 3. Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid()::text);

-- 4. Organization Users Policies
DROP POLICY IF EXISTS "Members can view organization memberships" ON public.organization_users;
CREATE POLICY "Members can view organization memberships"
ON public.organization_users FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()::text
  )
);

-- 5. Scan Sessions Restrictive Policies
DROP POLICY IF EXISTS "Tenant members can view scan sessions" ON public.scan_sessions;
CREATE POLICY "Tenant members can view scan sessions"
ON public.scan_sessions FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can insert scan sessions" ON public.scan_sessions;
CREATE POLICY "Tenant analysts and owners can insert scan sessions"
ON public.scan_sessions FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid()::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can update scan sessions" ON public.scan_sessions;
CREATE POLICY "Tenant analysts and owners can update scan sessions"
ON public.scan_sessions FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid()::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS "Tenant admins and owners can delete scan sessions" ON public.scan_sessions;
CREATE POLICY "Tenant admins and owners can delete scan sessions"
ON public.scan_sessions FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid()::text AND role IN ('ADMIN', 'OWNER')
  )
);

-- 6. Scan Documents Policies
DROP POLICY IF EXISTS "Tenant members can view scan documents" ON public.scan_documents;
CREATE POLICY "Tenant members can view scan documents"
ON public.scan_documents FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can insert scan documents" ON public.scan_documents;
CREATE POLICY "Tenant analysts and owners can insert scan documents"
ON public.scan_documents FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid()::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS "Tenant admins and owners can delete scan documents" ON public.scan_documents;
CREATE POLICY "Tenant admins and owners can delete scan documents"
ON public.scan_documents FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid()::text AND role IN ('ADMIN', 'OWNER')
  )
);

-- 7. Scan Reports Policies
DROP POLICY IF EXISTS "Tenant members can view scan reports" ON public.scan_reports;
CREATE POLICY "Tenant members can view scan reports"
ON public.scan_reports FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can insert scan reports" ON public.scan_reports;
CREATE POLICY "Tenant analysts and owners can insert scan reports"
ON public.scan_reports FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid()::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

-- 8. Findings & Remediations Policies
DROP POLICY IF EXISTS "Tenant members can view findings" ON public.findings;
CREATE POLICY "Tenant members can view findings"
ON public.findings FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Tenant members can view remediations" ON public.remediations;
CREATE POLICY "Tenant members can view remediations"
ON public.remediations FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()::text
  )
);

-- 9. Durable Job Queue Policies
DROP POLICY IF EXISTS "Tenant members can view job queue" ON public.job_queue;
CREATE POLICY "Tenant members can view job queue"
ON public.job_queue FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Tenant members can manage job queue" ON public.job_queue;
CREATE POLICY "Tenant members can manage job queue"
ON public.job_queue FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()::text
  )
);

-- 10. Audit Logs Policies (Append-Only)
DROP POLICY IF EXISTS "Tenant members can insert audit logs" ON public.audit_logs;
CREATE POLICY "Tenant members can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Admins and owners can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins and owners can read audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users 
    WHERE user_id = auth.uid()::text AND role IN ('ADMIN', 'OWNER')
  )
);

-- 11. Storage Buckets Setup
INSERT INTO storage.buckets (id, name, public) 
VALUES ('quarantine', 'quarantine', false),
       ('invoices', 'invoices', false),
       ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 12. Storage RLS Policies (Tenant Prefix Scoped: <org_id>/<scan_id>/<file>)
DROP POLICY IF EXISTS "Tenant scoped read on storage objects" ON storage.objects;
CREATE POLICY "Tenant scoped read on storage objects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('quarantine', 'invoices', 'reports')
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_users WHERE user_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can upload storage objects" ON storage.objects;
CREATE POLICY "Tenant analysts and owners can upload storage objects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('quarantine', 'invoices', 'reports')
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_users 
    WHERE user_id = auth.uid()::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS "Tenant analysts and owners can update storage objects" ON storage.objects;
CREATE POLICY "Tenant analysts and owners can update storage objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('quarantine', 'invoices', 'reports')
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_users 
    WHERE user_id = auth.uid()::text AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS "Tenant admins and owners can delete storage objects" ON storage.objects;
CREATE POLICY "Tenant admins and owners can delete storage objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('quarantine', 'invoices', 'reports')
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_users 
    WHERE user_id = auth.uid()::text AND role IN ('ADMIN', 'OWNER')
  )
);
