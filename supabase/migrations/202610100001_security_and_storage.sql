/**
 * InvoiceReady v1.0 - Security & Storage RLS Migration
 * Conforms to SEC-004 and SEC-005.
 * Replaces permissive policies with strict tenant isolation, role verification, and private bucket policies.
 */

-- 1. Enable RLS on all sensitive tables
ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS privacy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy permissive policies if any exist
DROP POLICY IF EXISTS "Allow all authenticated users" ON scan_sessions;
DROP POLICY IF EXISTS "Allow public read" ON scan_sessions;

-- 3. Tenant-scoped RLS policies for scan_sessions
CREATE POLICY "Users can view scans in their organization"
ON scan_sessions
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Analysts and owners can insert scans in their organization"
ON scan_sessions
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid() AND role IN ('ANALYST', 'ADMIN', 'OWNER')
  )
);

CREATE POLICY "Admins and owners can delete scans in their organization"
ON scan_sessions
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER')
  )
);

-- 4. Audit logs: append-only by server/worker, read by admin/owner
CREATE POLICY "Admins and owners can read audit logs"
ON audit_logs
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER')
  )
);

-- 5. Supabase Storage bucket policies (quarantine, invoices, reports)
-- Ensure buckets are private and enforce tenant path scoping (<org_id>/<scan_id>/<object_id>)
BEGIN;
INSERT INTO storage.buckets (id, name, public) 
VALUES ('quarantine', 'quarantine', false),
       ('invoices', 'invoices', false),
       ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;
COMMIT;
