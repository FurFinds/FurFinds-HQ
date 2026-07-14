-- Fix: the live project never granted the `anon` role table-level access
-- needed by the public FurFinds website — even with RLS policies that
-- allow public access (businesses_read, reviews_read, reports_insert),
-- Postgres checks the base GRANT first, so every anon request was hitting
-- "permission denied" before RLS was even evaluated.
--
-- Confirmed still broken via direct testing: the site's dev server log
-- shows every business listing request falling back to static mock data
-- ("Falling back to static business data: permission denied for table
-- businesses"), invisible in casual browsing only because the live seed
-- data mirrors the static fallback's names/slugs 1:1 — any NEW business
-- approved through HQ would never actually appear on the public site.
--
-- Also adds public.users, which wasn't in the original version of this
-- file: signup's client-side `.from("users").upsert(...)` call runs
-- against a not-yet-confirmed session (no JWT yet), so it executes as
-- anon and needs INSERT; SELECT is needed for the review-author name
-- join on business pages, which also runs as anon in server-rendered
-- pages regardless of visitor login state.
--
-- Safe to re-run.

grant select on public.businesses to anon;
grant select on public.reviews to anon;
grant select on public.users to anon;
grant insert on public.users to anon;
grant insert on public.reports to anon;
