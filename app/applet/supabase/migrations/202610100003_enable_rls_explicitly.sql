-- ==============================================================================
-- InvoiceReady v1.1 - Explicit RLS Enabling
-- ==============================================================================

-- 1. Ensure RLS is explicitly enabled on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: storage.objects RLS is usually enabled by Supabase, 
-- but let's be safe if possible. (ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; 
-- might not be allowed for non-admin, so we rely on the policies already being created).
