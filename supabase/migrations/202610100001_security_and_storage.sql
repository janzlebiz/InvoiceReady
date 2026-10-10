-- ==============================================================================
-- InvoiceReady v1.0 - Security & Storage RLS Migration
-- Conforms to SEC-004 and SEC-005.
-- Replaces all permissive policies with complete, restrictive organization-level
-- policies for every tenant-owned table and storage.objects.
-- ==============================================================================

-- 1. Ensure table schema completeness
CREATE TABLE IF NOT EXISTS public.scan_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SECURITY_PASSED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.scan_reports (
    report_id TEXT PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.scan_sessions(session_id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    rule_pack_version TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    retention_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.privacy_consents (
    consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL,
    consented BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.privacy_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Enable RLS on all sensitive tenant-owned tables
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.privacy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.privacy_requests ENABLE ROW LEVEL SECURITY;

-- 3. Drop all permissive and legacy policies across all tables
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.scan_sessions;
DROP POLICY IF EXISTS "Allow public read" ON public.scan_sessions;
DROP POLICY IF EXISTS "Users can view scan sessions in their orgs or created by them" ON public.scan_sessions;
DROP POLICY IF EXISTS "Authenticated users can create scan sessions" ON public.scan_sessions;
DROP POLICY IF EXISTS "Users can update their scan sessions" ON public.scan_sessions;
DROP POLICY IF EXISTS "Users can delete their scan sessions" ON public.scan_sessions;

DROP POLICY IF EXISTS "Users can view findings for their scan sessions" ON public.findings;
DROP POLICY IF EXISTS "Users can insert findings" ON public.findings;
DROP POLICY IF EXISTS "Users can view remediations for their scan sessions" ON public.remediations;
DROP POLICY IF EXISTS "Users can insert remediations" ON public.remediations;

DROP POLICY IF EXISTS "Users can view their business profiles" ON public.business_profiles;
DROP POLICY IF EXISTS "Users can manage their business profiles" ON public.business_profiles;
DROP POLICY IF EXISTS "Users can view their system profiles" ON public.system_profiles;
DROP POLICY IF EXISTS "Users can manage their system profiles" ON public.system_profiles;

DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- Drop legacy storage policies
DROP POLICY IF EXISTS "Authenticated users can upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can download invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can download reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow all" ON storage.objects;

-- 4. Restrictive Tenant-Scoped Policies for scan_sessions
CREATE POLICY "Tenant members can view scan sessions"
ON public.scan_sessions FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant analysts and owners can insert scan sessions"
ON public.scan_sessions FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

CREATE POLICY "Tenant analysts and owners can update scan sessions"
ON public.scan_sessions FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

CREATE POLICY "Tenant admins and owners can delete scan sessions"
ON public.scan_sessions FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER')
  )
);

-- 5. Restrictive Policies for scan_documents
CREATE POLICY "Tenant members can view scan documents"
ON public.scan_documents FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant analysts and owners can insert scan documents"
ON public.scan_documents FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

CREATE POLICY "Tenant admins and owners can delete scan documents"
ON public.scan_documents FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER')
  )
);

-- 6. Restrictive Policies for findings
CREATE POLICY "Tenant members can view findings"
ON public.findings FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant analysts and owners can insert findings"
ON public.findings FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

CREATE POLICY "Tenant admins and owners can delete findings"
ON public.findings FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER')
  )
);

-- 7. Restrictive Policies for remediations
CREATE POLICY "Tenant members can view remediations"
ON public.remediations FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant analysts and owners can insert remediations"
ON public.remediations FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

CREATE POLICY "Tenant admins and owners can delete remediations"
ON public.remediations FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER')
  )
);

-- 8. Restrictive Policies for scan_reports
CREATE POLICY "Tenant members can view scan reports"
ON public.scan_reports FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant analysts and owners can insert scan reports"
ON public.scan_reports FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

CREATE POLICY "Tenant admins and owners can delete scan reports"
ON public.scan_reports FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER')
  )
);

-- 9. Restrictive Policies for business_profiles & system_profiles
CREATE POLICY "Tenant members can view business profiles"
ON public.business_profiles FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant analysts and owners can manage business profiles"
ON public.business_profiles FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

CREATE POLICY "Tenant members can view system profiles"
ON public.system_profiles FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant analysts and owners can manage system profiles"
ON public.system_profiles FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

-- 10. Audit Logs: append-only by authenticated tenant members, read by admin/owner
CREATE POLICY "Tenant members can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins and owners can read audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users 
    WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER')
  )
);

-- 11. Private Buckets Configuration
INSERT INTO storage.buckets (id, name, public) 
VALUES ('quarantine', 'quarantine', false),
       ('invoices', 'invoices', false),
       ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 12. Restrictive Organization-Scoped Policies on storage.objects
-- Strictly enforces path prefix (<organization_id>/<scan_id>/<object_id>)
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
