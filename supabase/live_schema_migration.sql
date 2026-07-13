-- FurFinds — live schema migration
--
-- This project's live Supabase database already has its own schema
-- (users/businesses/verification/reviews/leads/reports/subscriptions/
-- waitlist/profiles), independent of and different from the earlier
-- speculative supabase/schema.sql files in this repo and in FurFinds. This
-- migration is written specifically against the REAL live schema: it fixes
-- two privilege-escalation bugs, wires up JWT role claims so the existing
-- `auth.jwt() ->> 'user_role'` RLS policies actually work, adds a handful of
-- purely additive columns the app needs, and creates genuinely new tables
-- for HQ features that have no existing equivalent (blog, calendar, email
-- log, etc.) — it does not rename or restructure anything that already
-- exists. Safe to re-run.
--
-- Run this in the Supabase SQL editor against project bzshixxakzdsinsvdole.
--
-- ============================================================================
-- MANUAL STEP REQUIRED AFTER RUNNING THIS FILE (cannot be done via SQL):
-- Supabase Dashboard → Authentication → Hooks → "Customize Access Token
-- (JWT) Claims hook" → enable it → select
-- public.custom_access_token_hook. Without this, profiles.role still won't
-- reach auth.jwt(), and every `auth.jwt() ->> 'user_role' = 'admin'` RLS policy
-- (already defined on businesses/profiles/reviews/reports/users/waitlist)
-- stays permanently unsatisfiable, including for your own admin account.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Security fix — handle_new_user() no longer grants every signup an HQ
--    'support' profile. It previously did this unconditionally for ANY new
--    auth.users row (including a pet-owner/business signup from the public
--    FurFinds website, since it shares this project) — a real privilege
--    escalation path into HQ. It now only provisions a profiles row when
--    app_metadata (server-set only, via the access-code-gated
--    /api/auth/signup route — never client-settable through a plain
--    supabase.auth.signUp() call) carries a valid HQ role.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text := new.raw_app_meta_data ->> 'role';
begin
  if requested_role in ('admin', 'verification_manager', 'support', 'content_editor', 'developer') then
    insert into public.profiles (id, email, name, role)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email), requested_role)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Security fix — a signed-in user could previously grant themselves any
--    role, including 'admin', two different ways:
--      a) "profiles_insert_self" let any authenticated user insert their
--         own profiles row with an arbitrary `role` value.
--      b) "Users can update their own profile" let any authenticated user
--         (including an existing 'support' staff member) update their own
--         `role` column directly, with no restriction on which columns
--         could change.
--    (a) is removed outright — profile creation is now trigger-only.
--    (b) is fixed with a trigger that blocks a user from changing their
--    OWN role via their own session, while leaving admin-driven changes to
--    OTHER users' rows (e.g. from /hq/team) unaffected.
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_insert_self" on public.profiles;

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() = old.id then
    raise exception 'You cannot change your own role. Ask another admin to change it for you.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_self_role_change_trigger on public.profiles;
create trigger prevent_self_role_change_trigger
  before update on public.profiles
  for each row execute procedure public.prevent_self_role_change();

-- Optional but cheap: formalize the role vocabulary now that it's
-- meaningfully enforced (your existing admin row already satisfies this).
do $$ begin
  alter table public.profiles add constraint profiles_role_check
    check (role in ('admin', 'verification_manager', 'support', 'content_editor', 'developer'));
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 3. JWT role claim — makes the existing `auth.jwt() ->> 'user_role' = 'admin'`
--    RLS policies on businesses/profiles/reviews/reports/users/waitlist
--    actually work. Requires the manual Dashboard step noted at the top of
--    this file; the function alone does nothing until that's enabled.
-- ----------------------------------------------------------------------------
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

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- The hook above selects from public.profiles as supabase_auth_admin, but
-- that role has no base table privilege and profiles has RLS enabled with
-- no policy covering it — without both of the grants below every login
-- fails with "Error running hook" (permission denied for table profiles).
grant select on public.profiles to supabase_auth_admin;
drop policy if exists "auth_admin_read_profiles" on public.profiles;
create policy "auth_admin_read_profiles" on public.profiles
  as permissive for select
  to supabase_auth_admin
  using (true);

-- ----------------------------------------------------------------------------
-- 4. Safe additive columns on existing tables — nothing renamed, nothing
--    dropped, nothing already there is touched.
-- ----------------------------------------------------------------------------

-- businesses: slug powers pretty /business/<slug> URLs on the public site.
alter table public.businesses add column if not exists slug text;
do $$ begin
  alter table public.businesses add constraint businesses_slug_key unique (slug);
exception when duplicate_object then null;
end $$;

-- users: pet parent profile extras (My Pets, notification prefs) used by
-- the public site's /dashboard.
alter table public.users add column if not exists pets jsonb not null default '[]';
alter table public.users add column if not exists notification_prefs jsonb not null default '{"email_updates": true, "review_replies": true}';

-- businesses: coordinates for the search page's distance filter.
alter table public.businesses add column if not exists lat double precision;
alter table public.businesses add column if not exists lng double precision;

-- businesses: full application-wizard payload (category answers,
-- self-assessed tier, referral source, service/ESA/breed policy answers)
-- and the Verified Business Agreement acceptance.
alter table public.businesses add column if not exists application_data jsonb not null default '{}';
alter table public.businesses add column if not exists contract_accepted boolean not null default false;
alter table public.businesses add column if not exists contract_accepted_at timestamptz;

-- verification: review audit trail (who/when decided), alongside the
-- existing ai_* / human_decision / final_tier columns.
alter table public.verification add column if not exists reviewed_by uuid references public.profiles (id);
alter table public.verification add column if not exists decided_at timestamptz;

-- reports: assignment for the Customer Success board (no equivalent
-- column existed).
alter table public.reports add column if not exists assigned_to uuid references public.profiles (id);

-- ----------------------------------------------------------------------------
-- 4b. New RLS policy — the live schema has businesses_owner (UPDATE only),
--     businesses_admin (admin, all commands), and businesses_read (SELECT,
--     everyone) but no INSERT policy for a plain signed-in user at all, so
--     the public site's "Apply for Verification" wizard — a core feature —
--     currently cannot create a business row for anyone but an admin. This
--     adds exactly that, scoped to a signed-in user creating their OWN
--     pending, inactive listing (never someone else's, never pre-approved).
-- ----------------------------------------------------------------------------
drop policy if exists "businesses_owner_insert" on public.businesses;
create policy "businesses_owner_insert" on public.businesses
  for insert with check (
    auth.uid() = owner_id and verification_status = 'pending' and is_active = false
  );

-- reports: only `reports_admin` (admin-only) and `reports_insert` (public,
-- insert-only) exist live, so Customer Success staff with the 'support'
-- role — the department's actual intended users — couldn't read or triage
-- reports at all. Same for businesses/verification: 'support' staff need
-- read access there too for Customer Success context, and
-- verification_manager/admin need write access to businesses/verification
-- for the verification queue.
drop policy if exists "staff_read_reports" on public.reports;
create policy "staff_read_reports" on public.reports for select using (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_write_reports" on public.reports;
create policy "staff_write_reports" on public.reports for update
  using (auth.jwt() ->> 'user_role' in ('admin', 'support'));

-- (businesses_read, live, using true, already covers staff SELECT — no
-- separate staff read policy needed here.)
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

-- ----------------------------------------------------------------------------
-- 5. New tables — HQ features with no existing equivalent in the live
--    schema. RLS follows the same auth.jwt() ->> 'user_role' convention already
--    used on businesses/profiles/reviews/reports/users.
-- ----------------------------------------------------------------------------

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null default '',
  featured_image text,
  category text not null default 'Industry News' check (
    category in ('Pet-Friendly Travel', 'Business Spotlights', 'Pet Care Tips', 'Industry News')
  ),
  author text not null default 'FurFinds Editorial',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  time time,
  description text,
  type text not null default 'other' check (type in ('social_post', 'meeting', 'deadline', 'other')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists calendar_events_date_idx on public.calendar_events (date);

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null default 'instagram' check (channel in ('instagram', 'facebook', 'tiktok', 'email', 'blog')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  scheduled_at timestamptz,
  body text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  subject text not null,
  body text not null,
  template text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error text,
  sent_by uuid references public.profiles (id),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete set null,
  type text not null default 'contract' check (type in ('contract', 'insurance', 'compliance_check')),
  title text not null,
  status text not null default 'pending' check (status in ('valid', 'expiring', 'expired', 'pending')),
  expires_at date,
  document_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount_cents int not null,
  expense_date date not null default current_date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  department text,
  created_at timestamptz not null default now()
);

create table if not exists public.department_alerts (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create table if not exists public.revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,
  revenue_cents int not null default 0,
  mrr_cents int not null default 0,
  new_customers int not null default 0,
  churned_customers int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null default 'percentage' check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10, 2) not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  max_uses int,
  used_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Grants + RLS for the new tables.
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on
  public.blog_posts, public.calendar_events, public.content_posts, public.email_log,
  public.compliance_records, public.expenses, public.meetings, public.department_alerts,
  public.site_settings, public.revenue_snapshots, public.discount_codes
to authenticated;
grant select on public.blog_posts to anon;

alter table public.blog_posts enable row level security;
alter table public.calendar_events enable row level security;
alter table public.content_posts enable row level security;
alter table public.email_log enable row level security;
alter table public.compliance_records enable row level security;
alter table public.expenses enable row level security;
alter table public.meetings enable row level security;
alter table public.department_alerts enable row level security;
alter table public.site_settings enable row level security;
alter table public.revenue_snapshots enable row level security;
alter table public.discount_codes enable row level security;

drop policy if exists "staff_read_blog_posts" on public.blog_posts;
create policy "staff_read_blog_posts" on public.blog_posts for select using (auth.jwt() ->> 'user_role' is not null);
drop policy if exists "staff_write_blog_posts" on public.blog_posts;
create policy "staff_write_blog_posts" on public.blog_posts for all
  using (auth.jwt() ->> 'user_role' in ('admin', 'content_editor'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'content_editor'));
drop policy if exists "public_read_published_blog_posts" on public.blog_posts;
create policy "public_read_published_blog_posts" on public.blog_posts for select using (status = 'published');

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

drop policy if exists "staff_read_site_settings" on public.site_settings;
create policy "staff_read_site_settings" on public.site_settings for select using (true);
drop policy if exists "staff_write_site_settings" on public.site_settings;
create policy "staff_write_site_settings" on public.site_settings for all
  using (auth.jwt() ->> 'user_role' in ('admin', 'content_editor'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'content_editor'));
grant select on public.site_settings to anon;

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
-- 6. Storage buckets (site-content, avatars) — unchanged from the earlier
--    plan; nothing here conflicts with the live schema.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('site-content', 'site-content', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

drop policy if exists "public_read_site_content" on storage.objects;
create policy "public_read_site_content" on storage.objects for select using (bucket_id = 'site-content');
drop policy if exists "staff_write_site_content" on storage.objects;
create policy "staff_write_site_content" on storage.objects for insert with check (bucket_id = 'site-content' and auth.uid() is not null);
drop policy if exists "staff_update_site_content" on storage.objects;
create policy "staff_update_site_content" on storage.objects for update using (bucket_id = 'site-content' and auth.uid() is not null);

drop policy if exists "public_read_avatars" on storage.objects;
create policy "public_read_avatars" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "user_write_own_avatar" on storage.objects;
create policy "user_write_own_avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "user_update_own_avatar" on storage.objects;
create policy "user_update_own_avatar" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- 7. Seed: first blog post (Atlanta pet-friendly guide), published.
-- ----------------------------------------------------------------------------
insert into public.blog_posts (title, slug, excerpt, content, category, author, status, published_at)
values (
  'Atlanta''s Best Pet-Friendly Spots: A FurFinds Guide',
  'atlanta-pet-friendly-guide',
  'From Piedmont Park''s off-leash trails to patio cafes in the Old Fourth Ward, here''s where Atlanta pet parents can actually trust the "pet-friendly" sign.',
  E'Atlanta has no shortage of restaurants, parks, and shops that claim to welcome pets — but "pet-friendly" can mean anything from a water bowl by the door to a fully pet-inclusive experience. We went looking for the real thing.\n\nPiedmont Park remains the city''s anchor for dog owners, with a dedicated off-leash dog park (Piedmont Dog Park) split into small- and large-dog sections, plus miles of paved trails that stay busy with pets on leash from sunrise to sunset.\n\nIn the Old Fourth Ward and around the Beltline, patio seating has become the norm rather than the exception. Look for water bowls set out without being asked, staff who know their own pet policy off the top of their head, and clearly posted rules — all signs FurFinds looks for when verifying a business.\n\nFor road trips out of the city, several boutique hotels near Midtown and Buckhead have moved beyond "pets allowed" to genuinely pet-inclusive amenities: in-room beds, no weight limits, and staff trained in pet first aid.\n\nAs FurFinds verifies more Atlanta businesses, this guide will grow. If you know a spot that goes above and beyond for pets, submit it through our business application flow and we''ll take a look.',
  'Pet-Friendly Travel',
  'FurFinds Editorial',
  'published',
  now()
)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 8. Seed: curated launch business listings + reviews, so search/homepage
--    aren't empty at launch. Fixed ids make this safe to re-run.
-- ----------------------------------------------------------------------------
insert into public.businesses (
  id, slug, name, category, tier, address, city, state, zip, phone, website,
  description, business_hours, pet_policy, service_animals_allowed, esa_policy,
  photos, verification_status, verification_score, verification_date, is_active, lat, lng
) values
  (
    '10000000-0000-4000-8000-000000000001', 'the-hound-house-cafe', 'The Hound House Cafe', 'restaurants', 'pet_inclusive',
    '1420 S Congress Ave', 'Austin', 'TX', '78704', '(512) 555-0142', 'https://example.com',
    'The Hound House Cafe was built from the ground up for pet parents. Alongside its espresso bar and all-day brunch menu, it offers a dedicated pup menu, water and treat stations at every table, and a fenced outdoor patio where dogs can safely roam off-leash while you enjoy your coffee.',
    'Mon–Sun: 7:00 AM – 6:00 PM', 'Pets welcome throughout the patio and designated indoor pet-friendly zone.', true,
    'Emotional support animals welcome on the patio.',
    array['https://picsum.photos/seed/hound-house-0/900/650','https://picsum.photos/seed/hound-house-1/900/650','https://picsum.photos/seed/hound-house-2/900/650','https://picsum.photos/seed/hound-house-3/900/650'],
    'approved', 92, now(), true, 30.2504, -97.7495
  ),
  (
    '10000000-0000-4000-8000-000000000002', 'wagging-tail-inn', 'Wagging Tail Inn', 'hotels', 'pet_inclusive',
    '220 Biltmore Ave', 'Asheville', 'NC', '28801', '(828) 555-0199', 'https://example.com',
    'Wagging Tail Inn is a boutique hotel designed around traveling with pets. Every room comes with a pet bed, bowls, and a welcome treat. The property includes a fenced dog run, an on-call pet sitting service, and staff trained in pet first aid.',
    'Front desk: 24/7', 'No weight limit, no breed restrictions, no additional pet fee.', true,
    'ESAs welcome with prior notice to front desk.',
    array['https://picsum.photos/seed/wagging-tail-0/900/650','https://picsum.photos/seed/wagging-tail-1/900/650','https://picsum.photos/seed/wagging-tail-2/900/650','https://picsum.photos/seed/wagging-tail-3/900/650'],
    'approved', 95, now(), true, 35.5951, -82.5515
  ),
  (
    '10000000-0000-4000-8000-000000000003', 'riverside-bark-park', 'Riverside Bark Park', 'parks', 'pets_allowed',
    '1800 Riverfront Pkwy', 'Denver', 'CO', '80202', '(303) 555-0110', 'https://example.com',
    'Riverside Bark Park spans five acres along the river with separate areas for large and small dogs, agility equipment, and shaded seating for owners. Waste stations are maintained daily by the city parks department.',
    'Daily: 6:00 AM – 10:00 PM', 'Dogs must be leashed except in designated off-leash zones. Owners must clean up after pets.', true,
    'Treated as standard pets; leash rules apply.',
    array['https://picsum.photos/seed/bark-park-0/900/650','https://picsum.photos/seed/bark-park-1/900/650','https://picsum.photos/seed/bark-park-2/900/650','https://picsum.photos/seed/bark-park-3/900/650'],
    'approved', 78, now(), true, 39.7565, -104.9987
  ),
  (
    '10000000-0000-4000-8000-000000000004', 'paws-and-claws-boutique', 'Paws & Claws Boutique', 'retail', 'pet_friendly',
    '980 NW 23rd Ave', 'Portland', 'OR', '97210', '(503) 555-0176', 'https://example.com',
    'Paws & Claws Boutique carries a curated selection of pet food, toys, and accessories. Leashed, well-behaved pets are welcome to browse the store with their owners, and staff are happy to answer questions about the store''s pet policy.',
    'Mon–Sat: 10:00 AM – 7:00 PM, Sun: 11:00 AM – 5:00 PM', 'Leashed pets welcome throughout the store.', true,
    'ESAs welcome, leash required.',
    array['https://picsum.photos/seed/paws-boutique-0/900/650','https://picsum.photos/seed/paws-boutique-1/900/650','https://picsum.photos/seed/paws-boutique-2/900/650','https://picsum.photos/seed/paws-boutique-3/900/650'],
    'approved', 84, now(), true, 45.5301, -122.6976
  ),
  (
    '10000000-0000-4000-8000-000000000005', 'furry-friends-grooming-studio', 'Furry Friends Grooming Studio', 'groomers', 'pet_inclusive',
    '3312 N Southport Ave', 'Chicago', 'IL', '60657', '(773) 555-0134', 'https://example.com',
    'Furry Friends Grooming Studio offers grooming, daycare, and boarding from a team trained in low-stress handling techniques. The studio maintains detailed emergency protocols and works closely with a nearby veterinary partner.',
    'Mon–Sat: 8:00 AM – 6:00 PM', 'By appointment; all pets must have current vaccination records on file.', true,
    'ESAs accepted for grooming and boarding services.',
    array['https://picsum.photos/seed/grooming-studio-0/900/650','https://picsum.photos/seed/grooming-studio-1/900/650','https://picsum.photos/seed/grooming-studio-2/900/650','https://picsum.photos/seed/grooming-studio-3/900/650'],
    'approved', 96, now(), true, 41.9403, -87.6638
  ),
  (
    '10000000-0000-4000-8000-000000000006', 'cornerstone-veterinary-clinic', 'Cornerstone Veterinary Clinic', 'vets', 'pet_inclusive',
    '615 Church St', 'Nashville', 'TN', '37219', '(615) 555-0188', 'https://example.com',
    'Cornerstone Veterinary Clinic provides preventive care, surgery, dental, and round-the-clock emergency services. The clinic''s fear-free certified staff focus on reducing stress for both pets and their people.',
    '24/7 Emergency Care', 'Open to all species; walk-ins accepted for emergencies.', true,
    'ESAs treated as standard patients.',
    array['https://picsum.photos/seed/vet-clinic-0/900/650','https://picsum.photos/seed/vet-clinic-1/900/650','https://picsum.photos/seed/vet-clinic-2/900/650','https://picsum.photos/seed/vet-clinic-3/900/650'],
    'approved', 90, now(), true, 36.1657, -86.7844
  ),
  (
    '10000000-0000-4000-8000-000000000007', 'yappy-hour-pet-events', 'Yappy Hour Pet Events', 'events', 'pet_friendly',
    'Liberty Station', 'San Diego', 'CA', '92106', '(619) 555-0155', 'https://example.com',
    'Yappy Hour Pet Events hosts monthly community meetups including adoption fairs, pet-friendly outdoor movie nights, and seasonal festivals, all held at partner venues with clear pet policies posted in advance.',
    'Events posted monthly', 'Leashed pets welcome at all events; policies vary slightly by venue.', true,
    'ESAs welcome, leash required.',
    array['https://picsum.photos/seed/yappy-hour-0/900/650','https://picsum.photos/seed/yappy-hour-1/900/650','https://picsum.photos/seed/yappy-hour-2/900/650','https://picsum.photos/seed/yappy-hour-3/900/650'],
    'approved', 81, now(), true, 32.7492, -117.2151
  ),
  (
    '10000000-0000-4000-8000-000000000008', 'petcab-rides', 'PetCab Rides', 'transportation', 'pets_allowed',
    'Citywide service', 'Seattle', 'WA', '98101', '(206) 555-0121', 'https://example.com',
    'PetCab Rides offers on-demand transportation with seat covers, safety harnesses, and loaner carriers for pet parents without a car. Drivers complete a pet-handling orientation before joining the platform.',
    'Daily: 6:00 AM – 11:00 PM', 'All pets must be leashed or carriered during the ride.', true,
    'ESAs accepted with standard carrier policy.',
    array['https://picsum.photos/seed/petcab-0/900/650','https://picsum.photos/seed/petcab-1/900/650','https://picsum.photos/seed/petcab-2/900/650','https://picsum.photos/seed/petcab-3/900/650'],
    'approved', 74, now(), true, 47.6062, -122.3321
  )
on conflict (id) do nothing;

insert into public.reviews (id, business_id, user_id, rating, comment, is_verified_purchase)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', null, 5, 'My golden retriever has his own regular seat here. Staff know him by name!', false),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', null, 5, 'Best patio in the city for a coffee date with your dog.', false),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', null, 5, 'They treated our senior dog like royalty. Will always book here.', false),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', null, 4, 'Great space, gets crowded on weekends but well maintained.', false),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', null, 5, 'Staff let my cat sniff every toy before we bought it. So sweet.', false),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000005', null, 5, 'The only groomer my anxious rescue dog has ever been calm with.', false),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000006', null, 5, 'They saved our cat''s life on a Sunday night. Forever grateful.', false),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000007', null, 5, 'Adopted our second dog at one of their events. Wonderful community.', false),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000008', null, 4, 'Great for vet trips when I don''t have my own car.', false)
on conflict (id) do nothing;
