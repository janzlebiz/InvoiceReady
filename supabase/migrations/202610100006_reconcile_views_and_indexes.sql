-- InvoiceReady v1.0 - Reconciliation migration for missing table columns, views, and performance indexes
-- Idempotent DDL ensuring schema compatibility across legacy and current environments.

BEGIN;

-- =========================================================================
-- 1. Ensure Missing Columns Exist on Base Tables Before Dependent Views/Indexes
-- =========================================================================

-- 1a. scan_documents columns
ALTER TABLE public.scan_documents 
    ADD COLUMN IF NOT EXISTS scan_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now() + interval '30 days');

-- Backfill scan_documents columns for any existing rows (explicit cast for UUID safety)
UPDATE public.scan_documents
SET scan_id = session_id::text
WHERE scan_id IS NULL AND session_id IS NOT NULL;

UPDATE public.scan_documents
SET retention_expires_at = COALESCE(created_at + interval '30 days', timezone('utc'::text, now() + interval '30 days'))
WHERE retention_expires_at IS NULL;

-- 1b. scan_reports columns
ALTER TABLE public.scan_reports 
    ADD COLUMN IF NOT EXISTS scan_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now() + interval '30 days');

-- Backfill scan_reports columns for any existing rows (explicit cast for UUID safety)
UPDATE public.scan_reports
SET scan_id = session_id::text
WHERE scan_id IS NULL AND session_id IS NOT NULL;

UPDATE public.scan_reports
SET retention_expires_at = COALESCE(created_at + interval '30 days', timezone('utc'::text, now() + interval '30 days'))
WHERE retention_expires_at IS NULL;

-- 1c. privacy_consents columns
ALTER TABLE public.privacy_consents 
    ADD COLUMN IF NOT EXISTS policy_version VARCHAR(32) DEFAULT 'v1.0.0',
    ADD COLUMN IF NOT EXISTS necessary BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS preferences BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS analytics BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS marketing BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS jurisdiction_context VARCHAR(4) DEFAULT 'AE',
    ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Backfill privacy_consents columns for any existing rows
UPDATE public.privacy_consents
SET policy_version = 'v1.0.0'
WHERE policy_version IS NULL;

UPDATE public.privacy_consents
SET necessary = true
WHERE necessary IS NULL;

UPDATE public.privacy_consents
SET preferences = false
WHERE preferences IS NULL;

UPDATE public.privacy_consents
SET analytics = false
WHERE analytics IS NULL;

UPDATE public.privacy_consents
SET marketing = false
WHERE marketing IS NULL;

UPDATE public.privacy_consents
SET jurisdiction_context = 'AE'
WHERE jurisdiction_context IS NULL;

UPDATE public.privacy_consents
SET timestamp = COALESCE(created_at, timezone('utc'::text, now()))
WHERE timestamp IS NULL;

-- 1d. audit_logs columns
ALTER TABLE public.audit_logs 
    ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS actor_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) DEFAULT '127.0.0.1',
    ADD COLUMN IF NOT EXISTS result VARCHAR(16) DEFAULT 'SUCCESS';

-- Backfill audit_logs columns for any existing rows
UPDATE public.audit_logs
SET timestamp = COALESCE(created_at, timezone('utc'::text, now()))
WHERE timestamp IS NULL;

-- Cast user_id to text explicitly so UUID columns do not collide with string literal 'SYSTEM'
UPDATE public.audit_logs
SET actor_id = COALESCE(user_id::text, 'SYSTEM')
WHERE actor_id IS NULL;

UPDATE public.audit_logs
SET ip_address = COALESCE(client_ip, '127.0.0.1')
WHERE ip_address IS NULL;

UPDATE public.audit_logs
SET result = 'SUCCESS'
WHERE result IS NULL;

-- =========================================================================
-- 2. Create Required Views & Grants
-- =========================================================================

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

-- Grant permissions on views to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consents TO authenticated;
GRANT ALL ON public.consents TO service_role;

-- =========================================================================
-- 3. Create Required Performance Indexes
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_scan_sessions_org ON public.scan_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_documents_retention ON public.scan_documents(retention_expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_time ON public.audit_logs(organization_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON public.job_queue(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_org_users_lookup ON public.organization_users(organization_id, user_id);

COMMIT;
