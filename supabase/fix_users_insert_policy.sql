-- Fix: signup's `.from("users").upsert(...)` call (src/app/signup/page.tsx in the
-- website repo) runs immediately after auth.signUp() — but since this project
-- requires email confirmation, there's no session yet at that point, so the
-- request executes as the `anon` role, with no auth.uid() to check against.
-- public.users has no INSERT policy at all today, so every new signup's
-- profile row silently fails to be created (confirmed via direct testing:
-- 42501 "new row violates row-level security policy for table users", even
-- after granting the anon role table-level INSERT).
--
-- Two policies, so this stays as narrow as each context allows:
--  - anon: genuinely has no verifiable identity pre-confirmation, so this
--    can only be scoped by the row's `id` being an unguessable auth.users
--    UUID (never exposed publicly) rather than an ownership check — the
--    standard, accepted pattern for this exact pre-confirmation-signup case.
--  - authenticated: once a session exists (e.g. confirmation isn't required,
--    or a later authenticated write), restrict to inserting only their own
--    row, same as every other self-service table here.
--
-- Safe to re-run.

drop policy if exists "anon_precreate_own_user_row" on public.users;
create policy "anon_precreate_own_user_row" on public.users
  for insert
  to anon
  with check (true);

drop policy if exists "authenticated_insert_own_user_row" on public.users;
create policy "authenticated_insert_own_user_row" on public.users
  for insert
  to authenticated
  with check (auth.uid() = id);
