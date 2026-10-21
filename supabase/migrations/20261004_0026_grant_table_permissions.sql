-- ==============================================================================
-- Migration: 20261004_0026_grant_table_permissions.sql
-- Description: Grant table, sequence, and routine privileges to anon, authenticated,
--              and service_role so PostgREST API queries do not fail with 42501 permission denied.
-- ==============================================================================

-- 1. Ensure schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Grant routine/function permissions
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. Set default privileges for future tables, sequences, and routines
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
