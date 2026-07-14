-- ============================================================================
-- Fix: custom_access_token_hook fails on every login with
-- "Error running hook URI: pg-functions://postgres/public/custom_access_token_hook"
--
-- Root cause: the hook (added in live_schema_migration.sql) runs as the
-- supabase_auth_admin role and selects from public.profiles, but that role
-- was only ever granted EXECUTE on the hook function itself — never SELECT
-- on public.profiles. profiles also has RLS enabled with no policy covering
-- supabase_auth_admin, so even a bare GRANT wouldn't be enough on its own.
-- This is the exact two-part fix Supabase's own Auth Hooks docs prescribe:
-- grant the base table privilege, then add a permissive RLS policy scoped
-- to just that role (nothing else changes for any other role).
-- ============================================================================

grant select on public.profiles to supabase_auth_admin;

drop policy if exists "auth_admin_read_profiles" on public.profiles;
create policy "auth_admin_read_profiles" on public.profiles
  as permissive for select
  to supabase_auth_admin
  using (true);
