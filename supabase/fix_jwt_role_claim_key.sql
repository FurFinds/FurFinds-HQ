-- ============================================================================
-- CRITICAL FIX: the JWT hook was overwriting the standard "role" claim.
--
-- PostgREST/GoTrue use the JWT's top-level "role" claim to `SET ROLE` on the
-- Postgres session for every authenticated request (that's how it switches
-- between the "anon" and "authenticated" Postgres roles). The hook added in
-- live_schema_migration.sql overwrote that same claim with the staff's
-- application-level role (e.g. "admin", "support") — which is NOT a real
-- Postgres role. The result: PostgREST tries `SET ROLE admin` on every
-- authenticated request from ANY staff account and fails with
-- `role "admin" does not exist`, breaking every single authenticated
-- REST/RLS-backed query HQ makes — including for existing admin accounts.
-- This was silent until now because SQL Editor queries run as the postgres
-- superuser and never go through PostgREST.
--
-- Fix: move the staff role into its own claim key, "user_role", which never
-- collides with PostgREST's role-switching. All RLS policies that read the
-- staff role must switch from `auth.jwt() ->> 'role'` to
-- `auth.jwt() ->> 'user_role'` accordingly.
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  staff_role text;
begin
  select role into staff_role from public.profiles where id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  if staff_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(staff_role));
  end if;
  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;

-- ----------------------------------------------------------------------------
-- Policies added by live_schema_migration.sql — rewritten to key off
-- "user_role" instead of "role". Same names, same logic, just the claim key.
-- ----------------------------------------------------------------------------

drop policy if exists "staff_read_reports" on public.reports;
create policy "staff_read_reports" on public.reports for select using (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_write_reports" on public.reports;
create policy "staff_write_reports" on public.reports for update
  using (auth.jwt() ->> 'user_role' in ('admin', 'support'));

drop policy if exists "staff_write_businesses" on public.businesses;
create policy "staff_write_businesses" on public.businesses for all
  using (auth.jwt() ->> 'user_role' in ('admin', 'verification_manager', 'support'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'verification_manager', 'support'));

drop policy if exists "staff_all_verification" on public.verification;
create policy "staff_all_verification" on public.verification for all
  using (auth.jwt() ->> 'user_role' in ('admin', 'verification_manager'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'verification_manager'));
drop policy if exists "staff_read_verification" on public.verification;
create policy "staff_read_verification" on public.verification for select using (auth.jwt() ->> 'user_role' is not null);

drop policy if exists "staff_read_blog_posts" on public.blog_posts;
create policy "staff_read_blog_posts" on public.blog_posts for select using (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_write_blog_posts" on public.blog_posts;
create policy "staff_write_blog_posts" on public.blog_posts for all
  using (auth.jwt() ->> 'user_role' in ('admin', 'content_editor'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'content_editor'));

drop policy if exists "staff_all_calendar_events" on public.calendar_events;
create policy "staff_all_calendar_events" on public.calendar_events for all
  using (auth.jwt() ->> 'user_role' is not null) with check (auth.jwt() ->> 'user_role' is not null);

drop policy if exists "staff_read_content_posts" on public.content_posts;
create policy "staff_read_content_posts" on public.content_posts for select using (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_write_content_posts" on public.content_posts;
create policy "staff_write_content_posts" on public.content_posts for all
  using (auth.jwt() ->> 'user_role' in ('admin', 'content_editor'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'content_editor'));

drop policy if exists "staff_read_email_log" on public.email_log;
create policy "staff_read_email_log" on public.email_log for select using (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_write_email_log" on public.email_log;
create policy "staff_write_email_log" on public.email_log for insert with check (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_update_email_log" on public.email_log;
create policy "staff_update_email_log" on public.email_log for update using (auth.jwt() ->> 'user_role' is not null);

drop policy if exists "staff_read_compliance" on public.compliance_records;
create policy "staff_read_compliance" on public.compliance_records for select using (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_write_compliance" on public.compliance_records;
create policy "staff_write_compliance" on public.compliance_records for all
  using (auth.jwt() ->> 'user_role' = 'admin') with check (auth.jwt() ->> 'user_role' = 'admin');

drop policy if exists "staff_read_expenses" on public.expenses;
create policy "staff_read_expenses" on public.expenses for select using (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_write_expenses" on public.expenses;
create policy "staff_write_expenses" on public.expenses for all
  using (auth.jwt() ->> 'user_role' = 'admin') with check (auth.jwt() ->> 'user_role' = 'admin');

drop policy if exists "staff_all_meetings" on public.meetings;
create policy "staff_all_meetings" on public.meetings for all
  using (auth.jwt() ->> 'user_role' is not null) with check (auth.jwt() ->> 'user_role' is not null);

drop policy if exists "staff_all_department_alerts" on public.department_alerts;
create policy "staff_all_department_alerts" on public.department_alerts for all
  using (auth.jwt() ->> 'user_role' is not null) with check (auth.jwt() ->> 'user_role' is not null);

drop policy if exists "staff_write_site_settings" on public.site_settings;
create policy "staff_write_site_settings" on public.site_settings for all
  using (auth.jwt() ->> 'user_role' in ('admin', 'content_editor'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'content_editor'));

drop policy if exists "staff_read_revenue_snapshots" on public.revenue_snapshots;
create policy "staff_read_revenue_snapshots" on public.revenue_snapshots for select using (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_write_revenue_snapshots" on public.revenue_snapshots;
create policy "staff_write_revenue_snapshots" on public.revenue_snapshots for all
  using (auth.jwt() ->> 'user_role' = 'admin') with check (auth.jwt() ->> 'user_role' = 'admin');

drop policy if exists "staff_read_discount_codes" on public.discount_codes;
create policy "staff_read_discount_codes" on public.discount_codes for select using (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_write_discount_codes" on public.discount_codes;
create policy "staff_write_discount_codes" on public.discount_codes for all
  using (auth.jwt() ->> 'user_role' = 'admin') with check (auth.jwt() ->> 'user_role' = 'admin');

-- ----------------------------------------------------------------------------
-- IMPORTANT: run this SELECT afterward and paste me the result. It finds any
-- OTHER pre-existing policies (e.g. on businesses/profiles/reviews/users/
-- waitlist, which predate my migration and whose exact text I don't have)
-- that still reference the broken `auth.jwt() ->> 'role'` claim and were
-- therefore also silently broken. Anything it returns still needs fixing.
-- ----------------------------------------------------------------------------
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual ilike '%auth.jwt()%''role''%' or with_check ilike '%auth.jwt()%''role''%');
