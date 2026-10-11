-- ==============================================================================
-- InvoiceReady v1.2 - Hardening: Drop rogue policies
-- ==============================================================================

-- 1. Drop extraneous policies on public tables
DO $$
DECLARE
    r RECORD;
BEGIN
    -- For public.scan_sessions
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'scan_sessions' AND schemaname = 'public' AND policyname NOT IN ('Tenant members can view scan sessions', 'Tenant analysts and owners can insert scan sessions', 'Tenant analysts and owners can update scan sessions', 'Tenant admins and owners can delete scan sessions'))
    LOOP
        EXECUTE 'DROP POLICY "' || r.policyname || '" ON public.scan_sessions';
    END LOOP;

    -- For storage.objects
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname NOT IN ('Tenant scoped read on storage objects', 'Tenant analysts and owners can upload storage objects', 'Tenant analysts and owners can update storage objects', 'Tenant admins and owners can delete storage objects'))
    LOOP
        EXECUTE 'DROP POLICY "' || r.policyname || '" ON storage.objects';
    END LOOP;
END $$;
