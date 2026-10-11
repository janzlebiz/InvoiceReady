-- InvoiceReady v1.0 - Schema Verification RPC for Live Supabase Verification
-- Provides a safe, read-only RPC function for inspecting remote database views, indexes, RLS status, and security policies.

CREATE OR REPLACE FUNCTION public.get_schema_verification()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'tables', (SELECT COALESCE(json_agg(table_name), '[]'::json) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
        'views', (SELECT COALESCE(json_agg(table_name), '[]'::json) FROM information_schema.views WHERE table_schema = 'public'),
        'indexes', (SELECT COALESCE(json_agg(indexname), '[]'::json) FROM pg_indexes WHERE schemaname = 'public'),
        'rls_tables', (SELECT COALESCE(json_agg(c.relname), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true),
        'policies', (SELECT COALESCE(json_agg(jsonb_build_object('table', tablename, 'policy', policyname)), '[]'::json) FROM pg_policies WHERE schemaname = 'public')
    ) INTO result;
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_schema_verification() TO service_role, authenticated;
