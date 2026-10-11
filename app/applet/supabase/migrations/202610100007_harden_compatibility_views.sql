-- InvoiceReady v1.0 - Harden compatibility views with security_invoker = true
-- Ensures all 5 compatibility views enforce security_invoker = true so underlying table RLS policies apply correctly.

BEGIN;

CREATE OR REPLACE VIEW public.users WITH (security_invoker = true) AS
    SELECT id AS user_id, email, full_name, role, default_organization_id, created_at, updated_at
    FROM public.profiles;

CREATE OR REPLACE VIEW public.scans WITH (security_invoker = true) AS
    SELECT session_id AS scan_id, session_id, organization_id, jurisdiction, status,
           created_by, user_id, business_profile, system_profile, rule_pack_version,
           document_name, document_mime_type, document_size_bytes, document_hash,
           storage_path, security_scan_result, extraction_result, applicable_rules,
           validation_results, scorecard, findings, remediation_plan, error_message,
           created_at, uploaded_at, completed_at, updated_at
    FROM public.scan_sessions;

CREATE OR REPLACE VIEW public.documents WITH (security_invoker = true) AS
    SELECT document_id, organization_id, session_id AS scan_id, session_id, file_name,
           storage_path, file_size_bytes, mime_type, sha256_hash, retention_expires_at,
           status, created_at
    FROM public.scan_documents;

CREATE OR REPLACE VIEW public.reports WITH (security_invoker = true) AS
    SELECT report_id, organization_id, session_id AS scan_id, session_id, rule_pack_version,
           storage_path, retention_expires_at, created_at
    FROM public.scan_reports;

CREATE OR REPLACE VIEW public.consents WITH (security_invoker = true) AS
    SELECT consent_id, organization_id, user_id, policy_version, necessary, preferences,
           analytics, marketing, jurisdiction_context, timestamp, created_at
    FROM public.privacy_consents;

-- Re-apply grants
GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO authenticated;
GRANT ALL ON public.scans TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consents TO authenticated;
GRANT ALL ON public.consents TO service_role;

COMMIT;
