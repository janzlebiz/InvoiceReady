-- ==============================================================================
-- InvoiceReady v1.1 - Explicit RLS Enabling
-- ==============================================================================

-- 1. Ensure RLS is explicitly enabled on all tables
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
