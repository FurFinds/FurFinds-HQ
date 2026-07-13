-- Fix: the live project never granted the `anon` role table-level SELECT on
-- businesses/reviews or INSERT on reports — even with RLS policies that
-- allow public access (businesses_read, reviews_read, reports_insert),
-- Postgres checks the base GRANT first, so every anon request was hitting
-- "permission denied" before RLS was even evaluated. This is what's
-- breaking the public site's homepage/search/business pages right now.
-- Safe to re-run.

grant select on public.businesses to anon;
grant select on public.reviews to anon;
grant insert on public.reports to anon;
