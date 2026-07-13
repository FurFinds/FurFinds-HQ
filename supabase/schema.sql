-- FurFinds HQ database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a
-- fresh project. Safe to re-run: every statement is guarded.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$ begin
  create type hq_role as enum (
    'admin',
    'verification_manager',
    'support',
    'content_editor',
    'developer'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- profiles — extends auth.users with HQ-specific fields
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role hq_role not null default 'support',
  department text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created — but ONLY
-- when the user was provisioned with an explicit, valid HQ role in
-- `app_metadata`. app_metadata (raw_app_meta_data) can only be set
-- server-side via the service-role admin API (see /api/auth/signup, which
-- is gated behind HQ_SIGNUP_CODE) — unlike user_metadata, it is never
-- settable by the client through a public signUp() call. If this trigger
-- trusted user_metadata instead, anyone calling supabase.auth.signUp()
-- directly (e.g. the public FurFinds website sharing this Supabase
-- project, or a raw API request) could set `data: { role: 'admin' }` and
-- grant themselves HQ access. Deny-by-default: a signup with no valid
-- app_metadata role gets no HQ profile at all, not a 'support' default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text := new.raw_app_meta_data ->> 'role';
begin
  if requested_role in ('admin', 'verification_manager', 'support', 'content_editor', 'developer') then
    insert into public.profiles (id, email, full_name, role)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', requested_role::hq_role)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper used inside RLS policies to read the caller's HQ role.
create or replace function public.current_role_name()
returns hq_role
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  tier text not null default 'basic' check (tier in ('basic', 'verified', 'premium')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'rejected')),
  city text,
  state text,
  owner_name text,
  owner_email text,
  phone text,
  website text,
  image_url text,
  rating numeric(2, 1) default 0,
  review_count int default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Public-site profile fields (search, business detail page). Nullable
  -- since HQ-created/pending businesses won't have these until a full
  -- profile is filled in.
  slug text unique,
  long_description text,
  address text,
  hours text,
  pet_policy text,
  service_animal_policy text,
  esa_policy text,
  amenities text[] not null default '{}',
  images text[] not null default '{}',
  lat double precision,
  lng double precision
);

-- `create table if not exists` above won't add these to a businesses table
-- that already existed before they were introduced.
alter table public.businesses add column if not exists slug text;
do $$ begin
  alter table public.businesses add constraint businesses_slug_key unique (slug);
exception when duplicate_object then null;
end $$;
alter table public.businesses add column if not exists long_description text;
alter table public.businesses add column if not exists address text;
alter table public.businesses add column if not exists hours text;
alter table public.businesses add column if not exists pet_policy text;
alter table public.businesses add column if not exists service_animal_policy text;
alter table public.businesses add column if not exists esa_policy text;
alter table public.businesses add column if not exists amenities text[] not null default '{}';
alter table public.businesses add column if not exists images text[] not null default '{}';
alter table public.businesses add column if not exists lat double precision;
alter table public.businesses add column if not exists lng double precision;

-- ---------------------------------------------------------------------------
-- customers — end-users of the FurFinds consumer app (pet owners).
-- HQ reads this table; it is owned/written by the consumer product.
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  city text,
  state text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  favorites_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- revenue_snapshots — monthly rollups powering the Command Center chart
-- and Finance reporting.
-- ---------------------------------------------------------------------------
create table if not exists public.revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,
  revenue_cents int not null default 0,
  mrr_cents int not null default 0,
  new_customers int not null default 0,
  churned_customers int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- verification_applications
-- ---------------------------------------------------------------------------
create table if not exists public.verification_applications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  applicant_name text not null,
  applicant_email text,
  tier_requested text not null default 'basic' check (tier_requested in ('basic', 'verified', 'premium')),
  category text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_info')),
  documents jsonb not null default '[]',
  ai_score int check (ai_score between 0 and 100),
  ai_summary text,
  ai_flags jsonb not null default '[]',
  -- Full payload from the public site's multi-step application wizard
  -- (category answers, self-assessed tier, service/ESA/breed policy
  -- answers, referral source, etc.) — feeds the AI verification analysis.
  application_data jsonb not null default '{}',
  contract_accepted boolean not null default false,
  contract_accepted_at timestamptz,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_notes text
);

-- `create table if not exists` above won't add these columns to a
-- verification_applications table that already existed before they were
-- introduced, so add them explicitly too.
alter table public.verification_applications add column if not exists application_data jsonb not null default '{}';
alter table public.verification_applications add column if not exists contract_accepted boolean not null default false;
alter table public.verification_applications add column if not exists contract_accepted_at timestamptz;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  author_name text,
  rating int not null check (rating between 1 and 5),
  comment text,
  status text not null default 'published' check (status in ('published', 'flagged', 'removed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  plan text not null default 'basic' check (plan in ('basic', 'pro', 'premium')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  mrr_cents int not null default 0,
  current_period_end date,
  created_at timestamptz not null default now(),
  canceled_at timestamptz
);

-- ---------------------------------------------------------------------------
-- support_tickets — Customer Success
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete set null,
  subject text not null,
  message text,
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  -- Distinguishes a pet-owner inquiry from a business inquiry so Customer
  -- Success can filter the queue by who's asking.
  type text not null default 'customer' check (type in ('customer', 'business')),
  assigned_to uuid references public.profiles (id),
  customer_name text,
  customer_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_tickets add column if not exists type text not null default 'customer';
do $$ begin
  alter table public.support_tickets add constraint support_tickets_type_check check (type in ('customer', 'business'));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- email_log — outbound emails sent from HQ (Customer Success / Marketing)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- blog_posts — long-form articles published to the public site's /blog
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- content_posts — Marketing
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- compliance_records — Legal & Compliance
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- expenses — Finance
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount_cents int not null,
  expense_date date not null default current_date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- calendar_events — full content/ops calendar (Marketing department), more
-- general than `meetings` (which only backs the Command Center widget).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- meetings — Command Center calendar
-- ---------------------------------------------------------------------------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  department text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- department_alerts — Command Center alerts feed
-- ---------------------------------------------------------------------------
create table if not exists public.department_alerts (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- leads — contact/inquiry events generated for a business from the public
-- site (e.g. "Get Directions" / "Call Now" clicks, contact form submits).
-- Powers the "Leads Generated" metric on the business dashboard.
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  source text not null default 'website' check (source in ('website', 'search', 'referral')),
  contact_name text,
  contact_email text,
  message text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- discount_codes — checkout discount codes (applied once Stripe billing is
-- fully wired up; table exists now so the schema is ready ahead of that).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- site_settings — small key/value store for HQ-managed content, e.g. the
-- founder photo shown on the public site. Create a public Storage bucket
-- named "site-content" to hold the uploaded files this table points to.
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

-- ---------------------------------------------------------------------------
-- Base grants
-- ---------------------------------------------------------------------------
-- RLS policies only narrow down access a role already has at the SQL grant
-- level — they don't substitute for it. Fresh Supabase projects normally
-- provision these automatically, but a table created some other way (e.g.
-- directly in the Table Editor before this script ran) can end up without
-- them, which surfaces as "permission denied for table X" (Postgres error
-- 42501) even once RLS policies exist and look correct.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- The public marketing site (FurFinds, not HQ) reads a narrow set of tables
-- with the anon key: site_settings (founder photo, etc.) and anything else
-- explicitly granted below as those features are added.
grant usage on schema public to anon;
grant select on public.site_settings to anon;
-- The public site's business verification wizard (apply flow) submits
-- directly into these tables, often before the applicant has an account.
grant insert on public.businesses to anon, authenticated;
grant insert on public.verification_applications to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.revenue_snapshots enable row level security;
alter table public.businesses enable row level security;
alter table public.verification_applications enable row level security;
alter table public.reviews enable row level security;
alter table public.subscriptions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.content_posts enable row level security;
alter table public.compliance_records enable row level security;
alter table public.expenses enable row level security;
alter table public.meetings enable row level security;
alter table public.department_alerts enable row level security;
alter table public.site_settings enable row level security;
alter table public.leads enable row level security;
alter table public.discount_codes enable row level security;
alter table public.blog_posts enable row level security;
alter table public.email_log enable row level security;
alter table public.calendar_events enable row level security;

-- Any signed-in HQ staff member (i.e. has a profiles row) can read
-- operational data. Only admins/relevant department roles can mutate
-- the sensitive tables; everything else is read/write for all staff.
drop policy if exists "profiles_select_self_or_staff" on public.profiles;
create policy "profiles_select_self_or_staff" on public.profiles
  for select using (auth.uid() is not null);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

-- Lets a signed-in user create their own profile row if one doesn't exist
-- yet (self-heal path in requireProfile() for accounts created outside the
-- normal signup flow, e.g. directly in the Supabase dashboard).
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "staff_read_customers" on public.customers;
create policy "staff_read_customers" on public.customers
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_customers" on public.customers;
create policy "staff_write_customers" on public.customers
  for all using (
    public.current_role_name() in ('admin', 'support')
  ) with check (
    public.current_role_name() in ('admin', 'support')
  );

drop policy if exists "staff_read_revenue_snapshots" on public.revenue_snapshots;
create policy "staff_read_revenue_snapshots" on public.revenue_snapshots
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_revenue_snapshots" on public.revenue_snapshots;
create policy "staff_write_revenue_snapshots" on public.revenue_snapshots
  for all using (
    public.current_role_name() in ('admin')
  ) with check (
    public.current_role_name() in ('admin')
  );

drop policy if exists "staff_read_businesses" on public.businesses;
create policy "staff_read_businesses" on public.businesses
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_businesses" on public.businesses;
create policy "staff_write_businesses" on public.businesses
  for all using (
    public.current_role_name() in ('admin', 'verification_manager')
  ) with check (
    public.current_role_name() in ('admin', 'verification_manager')
  );

-- Public site: the business verification wizard creates a new pending
-- business record before an application exists to attach it to. Insert-only
-- and restricted to the 'pending' status, so this can't be used to create
-- (or overwrite) an active/verified listing directly.
drop policy if exists "public_apply_insert_businesses" on public.businesses;
create policy "public_apply_insert_businesses" on public.businesses
  for insert with check (status = 'pending');

-- Public site: anyone (including anon/unauthenticated visitors) can browse
-- active, verified business listings — that's the whole point of the
-- directory. Pending/suspended/rejected businesses stay staff-only via the
-- policy above.
drop policy if exists "public_read_active_businesses" on public.businesses;
create policy "public_read_active_businesses" on public.businesses
  for select using (status = 'active');

grant select on public.businesses to anon;

drop policy if exists "staff_read_verification" on public.verification_applications;
create policy "staff_read_verification" on public.verification_applications
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_verification" on public.verification_applications;
create policy "staff_write_verification" on public.verification_applications
  for all using (
    public.current_role_name() in ('admin', 'verification_manager')
  ) with check (
    public.current_role_name() in ('admin', 'verification_manager')
  );

-- Public site: the business verification wizard submits its own
-- application. Insert-only and restricted to 'pending' with no reviewer
-- fields set, so applicants can't self-approve or edit past submissions.
drop policy if exists "public_apply_insert_verification" on public.verification_applications;
create policy "public_apply_insert_verification" on public.verification_applications
  for insert with check (
    status = 'pending' and reviewed_by is null and reviewed_at is null
  );

drop policy if exists "staff_read_reviews" on public.reviews;
create policy "staff_read_reviews" on public.reviews
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_reviews" on public.reviews;
create policy "staff_write_reviews" on public.reviews
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "staff_read_subscriptions" on public.subscriptions;
create policy "staff_read_subscriptions" on public.subscriptions
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_subscriptions" on public.subscriptions;
create policy "staff_write_subscriptions" on public.subscriptions
  for all using (
    public.current_role_name() in ('admin')
  ) with check (
    public.current_role_name() in ('admin')
  );

drop policy if exists "staff_read_tickets" on public.support_tickets;
create policy "staff_read_tickets" on public.support_tickets
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_tickets" on public.support_tickets;
create policy "staff_write_tickets" on public.support_tickets
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "staff_read_email_log" on public.email_log;
create policy "staff_read_email_log" on public.email_log
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_email_log" on public.email_log;
create policy "staff_write_email_log" on public.email_log
  for insert with check (auth.uid() is not null);

drop policy if exists "staff_update_email_log" on public.email_log;
create policy "staff_update_email_log" on public.email_log
  for update using (auth.uid() is not null);

drop policy if exists "staff_read_content" on public.content_posts;
create policy "staff_read_content" on public.content_posts
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_content" on public.content_posts;
create policy "staff_write_content" on public.content_posts
  for all using (
    public.current_role_name() in ('admin', 'content_editor')
  ) with check (
    public.current_role_name() in ('admin', 'content_editor')
  );

drop policy if exists "staff_read_blog_posts" on public.blog_posts;
create policy "staff_read_blog_posts" on public.blog_posts
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_blog_posts" on public.blog_posts;
create policy "staff_write_blog_posts" on public.blog_posts
  for all using (
    public.current_role_name() in ('admin', 'content_editor')
  ) with check (
    public.current_role_name() in ('admin', 'content_editor')
  );

-- Public site: anyone can read published posts for the /blog feed.
drop policy if exists "public_read_published_blog_posts" on public.blog_posts;
create policy "public_read_published_blog_posts" on public.blog_posts
  for select using (status = 'published');

grant select on public.blog_posts to anon;

drop policy if exists "staff_read_compliance" on public.compliance_records;
create policy "staff_read_compliance" on public.compliance_records
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_compliance" on public.compliance_records;
create policy "staff_write_compliance" on public.compliance_records
  for all using (
    public.current_role_name() in ('admin')
  ) with check (
    public.current_role_name() in ('admin')
  );

drop policy if exists "staff_read_expenses" on public.expenses;
create policy "staff_read_expenses" on public.expenses
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_expenses" on public.expenses;
create policy "staff_write_expenses" on public.expenses
  for all using (
    public.current_role_name() in ('admin')
  ) with check (
    public.current_role_name() in ('admin')
  );

drop policy if exists "staff_read_meetings" on public.meetings;
create policy "staff_read_meetings" on public.meetings
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_meetings" on public.meetings;
create policy "staff_write_meetings" on public.meetings
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "staff_read_calendar_events" on public.calendar_events;
create policy "staff_read_calendar_events" on public.calendar_events
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_calendar_events" on public.calendar_events;
create policy "staff_write_calendar_events" on public.calendar_events
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "staff_read_alerts" on public.department_alerts;
create policy "staff_read_alerts" on public.department_alerts
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_alerts" on public.department_alerts;
create policy "staff_write_alerts" on public.department_alerts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- site_settings backs public-facing content (e.g. the founder photo shown on
-- the marketing site), so it needs to be readable by the anon key too, not
-- just signed-in HQ staff.
drop policy if exists "staff_read_site_settings" on public.site_settings;
create policy "staff_read_site_settings" on public.site_settings
  for select using (true);

drop policy if exists "staff_write_site_settings" on public.site_settings;
create policy "staff_write_site_settings" on public.site_settings
  for all using (
    public.current_role_name() in ('admin', 'content_editor')
  ) with check (
    public.current_role_name() in ('admin', 'content_editor')
  );

-- Leads are readable by any authenticated user (matches the existing
-- businesses/reviews posture in this schema) and insertable by anyone with
-- an authenticated session, since the public site's business owners create
-- them indirectly via contact actions.
drop policy if exists "staff_read_leads" on public.leads;
create policy "staff_read_leads" on public.leads
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_leads" on public.leads;
create policy "staff_write_leads" on public.leads
  for insert with check (auth.uid() is not null);

drop policy if exists "staff_read_discount_codes" on public.discount_codes;
create policy "staff_read_discount_codes" on public.discount_codes
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_discount_codes" on public.discount_codes;
create policy "staff_write_discount_codes" on public.discount_codes
  for all using (
    public.current_role_name() in ('admin')
  ) with check (
    public.current_role_name() in ('admin')
  );

-- ---------------------------------------------------------------------------
-- Storage buckets — public, since founder photos, blog images, and avatars
-- are all displayed on the public website. Uploads are still write-gated by
-- the policies below (any authenticated HQ user can upload/replace their
-- own avatar or site content; only the object owner can delete it).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('site-content', 'site-content', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "public_read_site_content" on storage.objects;
create policy "public_read_site_content" on storage.objects
  for select using (bucket_id = 'site-content');

drop policy if exists "staff_write_site_content" on storage.objects;
create policy "staff_write_site_content" on storage.objects
  for insert with check (bucket_id = 'site-content' and auth.uid() is not null);

drop policy if exists "staff_update_site_content" on storage.objects;
create policy "staff_update_site_content" on storage.objects
  for update using (bucket_id = 'site-content' and auth.uid() is not null);

drop policy if exists "public_read_avatars" on storage.objects;
create policy "public_read_avatars" on storage.objects
  for select using (bucket_id = 'avatars');

-- Avatar uploads are scoped by path convention: `${user_id}/...`, so a
-- signed-in user can only write inside their own folder.
drop policy if exists "user_write_own_avatar" on storage.objects;
create policy "user_write_own_avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user_update_own_avatar" on storage.objects;
create policy "user_update_own_avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Seed data — safe to skip in production, useful for local development
-- ---------------------------------------------------------------------------
insert into public.businesses (name, category, description, tier, status, city, state, owner_name, owner_email, rating, review_count, featured)
values
  ('Bark & Brew Cafe', 'Cafe', 'Dog-friendly coffee shop with an off-leash patio.', 'premium', 'active', 'Austin', 'TX', 'Maria Chen', 'maria@barkandbrew.com', 4.8, 212, true),
  ('Whisker Wanderlust Hotel', 'Lodging', 'Boutique hotel with in-room pet amenities.', 'verified', 'active', 'Denver', 'CO', 'Sam Okafor', 'sam@whiskerwanderlust.com', 4.6, 98, false),
  ('Paws Plaza Retail', 'Retail', 'Pet-friendly shopping center.', 'basic', 'pending', 'Portland', 'OR', 'Jess Rivera', 'jess@pawsplaza.com', 0, 0, false)
on conflict do nothing;

-- Backfill slugs for the businesses above so they're reachable at
-- /business/<slug> on the public site now that listings are live-sourced.
update public.businesses set slug = 'bark-and-brew-cafe' where name = 'Bark & Brew Cafe' and slug is null;
update public.businesses set slug = 'whisker-wanderlust-hotel' where name = 'Whisker Wanderlust Hotel' and slug is null;
update public.businesses set slug = 'paws-plaza-retail' where name = 'Paws Plaza Retail' and slug is null;

-- Curated launch listings — the public site's search/homepage/detail pages
-- read live from this table, so these give the beta launch real content
-- instead of an empty directory. Swap in real verified businesses as they
-- come through the application flow.
insert into public.businesses (
  slug, name, category, description, long_description, tier, status, city, state,
  address, phone, website, hours, pet_policy, service_animal_policy, esa_policy,
  amenities, images, rating, review_count, featured, lat, lng
) values
  (
    'the-hound-house-cafe', 'The Hound House Cafe', 'Restaurants & Cafes',
    'A dog-loving cafe with a full pup menu and a fenced patio to play in.',
    'The Hound House Cafe was built from the ground up for pet parents. Alongside its espresso bar and all-day brunch menu, it offers a dedicated pup menu, water and treat stations at every table, and a fenced outdoor patio where dogs can safely roam off-leash while you enjoy your coffee.',
    'premium', 'active', 'Austin', 'TX', '1420 S Congress Ave, Austin, TX 78704', '(512) 555-0142', 'https://example.com',
    'Mon–Sun: 7:00 AM – 6:00 PM', 'Pets welcome throughout the patio and designated indoor pet-friendly zone.',
    'Service animals welcome everywhere, no restrictions.', 'Emotional support animals welcome on the patio.',
    array['Water bowls', 'Pet menu', 'Fenced patio', 'Waste bags provided', 'Treat station'],
    array['https://picsum.photos/seed/hound-house-0/900/650', 'https://picsum.photos/seed/hound-house-1/900/650', 'https://picsum.photos/seed/hound-house-2/900/650', 'https://picsum.photos/seed/hound-house-3/900/650'],
    4.8, 214, true, 30.2504, -97.7495
  ),
  (
    'wagging-tail-inn', 'Wagging Tail Inn', 'Hotels & Accommodations',
    'Boutique pet-inclusive hotel with in-room pet beds and a dog run.',
    'Wagging Tail Inn is a boutique hotel designed around traveling with pets. Every room comes with a pet bed, bowls, and a welcome treat. The property includes a fenced dog run, an on-call pet sitting service, and staff trained in pet first aid.',
    'premium', 'active', 'Asheville', 'NC', '220 Biltmore Ave, Asheville, NC 28801', '(828) 555-0199', 'https://example.com',
    'Front desk: 24/7', 'No weight limit, no breed restrictions, no additional pet fee.',
    'Service animals welcome in all areas, no documentation required.', 'ESAs welcome with prior notice to front desk.',
    array['In-room pet beds', 'Fenced dog run', 'Pet sitting', 'Pet first aid trained staff', 'Walking trails nearby'],
    array['https://picsum.photos/seed/wagging-tail-0/900/650', 'https://picsum.photos/seed/wagging-tail-1/900/650', 'https://picsum.photos/seed/wagging-tail-2/900/650', 'https://picsum.photos/seed/wagging-tail-3/900/650'],
    4.9, 331, true, 35.5951, -82.5515
  ),
  (
    'riverside-bark-park', 'Riverside Bark Park', 'Parks & Outdoor Spaces',
    'Open riverside dog park with agility equipment and shaded seating.',
    'Riverside Bark Park spans five acres along the river with separate areas for large and small dogs, agility equipment, and shaded seating for owners. Waste stations are maintained daily by the city parks department.',
    'basic', 'active', 'Denver', 'CO', '1800 Riverfront Pkwy, Denver, CO 80202', '(303) 555-0110', 'https://example.com',
    'Daily: 6:00 AM – 10:00 PM', 'Dogs must be leashed except in designated off-leash zones. Owners must clean up after pets.',
    'Service animals permitted throughout the park.', 'Treated as standard pets; leash rules apply.',
    array['Off-leash zone', 'Agility equipment', 'Waste stations', 'Shaded seating', 'Water fountains'],
    array['https://picsum.photos/seed/bark-park-0/900/650', 'https://picsum.photos/seed/bark-park-1/900/650', 'https://picsum.photos/seed/bark-park-2/900/650', 'https://picsum.photos/seed/bark-park-3/900/650'],
    4.5, 128, true, 39.7565, -104.9987
  ),
  (
    'paws-and-claws-boutique', 'Paws & Claws Boutique', 'Retail & Shopping',
    'Pet supply boutique that welcomes leashed pets to shop with you.',
    'Paws & Claws Boutique carries a curated selection of pet food, toys, and accessories. Leashed, well-behaved pets are welcome to browse the store with their owners, and staff are happy to answer questions about the store''s pet policy.',
    'verified', 'active', 'Portland', 'OR', '980 NW 23rd Ave, Portland, OR 97210', '(503) 555-0176', 'https://example.com',
    'Mon–Sat: 10:00 AM – 7:00 PM, Sun: 11:00 AM – 5:00 PM', 'Leashed pets welcome throughout the store.',
    'Service animals always welcome.', 'ESAs welcome, leash required.',
    array['Designated pet area', 'Water bowls', 'Treat samples', 'Staff trained on policy'],
    array['https://picsum.photos/seed/paws-boutique-0/900/650', 'https://picsum.photos/seed/paws-boutique-1/900/650', 'https://picsum.photos/seed/paws-boutique-2/900/650', 'https://picsum.photos/seed/paws-boutique-3/900/650'],
    4.6, 89, true, 45.5301, -122.6976
  ),
  (
    'furry-friends-grooming-studio', 'Furry Friends Grooming Studio', 'Groomers & Pet Services',
    'Full-service grooming, daycare, and boarding with pet-trained staff.',
    'Furry Friends Grooming Studio offers grooming, daycare, and boarding from a team trained in low-stress handling techniques. The studio maintains detailed emergency protocols and works closely with a nearby veterinary partner.',
    'premium', 'active', 'Chicago', 'IL', '3312 N Southport Ave, Chicago, IL 60657', '(773) 555-0134', 'https://example.com',
    'Mon–Sat: 8:00 AM – 6:00 PM', 'By appointment; all pets must have current vaccination records on file.',
    'Service animals accommodated with staff trained on ADA regulations.', 'ESAs accepted for grooming and boarding services.',
    array['Low-stress handling', 'Emergency protocols', 'Daycare webcams', 'Climate-controlled boarding'],
    array['https://picsum.photos/seed/grooming-studio-0/900/650', 'https://picsum.photos/seed/grooming-studio-1/900/650', 'https://picsum.photos/seed/grooming-studio-2/900/650', 'https://picsum.photos/seed/grooming-studio-3/900/650'],
    4.9, 176, false, 41.9403, -87.6638
  ),
  (
    'cornerstone-veterinary-clinic', 'Cornerstone Veterinary Clinic', 'Veterinary & Healthcare',
    'Full-service animal hospital with 24/7 emergency care.',
    'Cornerstone Veterinary Clinic provides preventive care, surgery, dental, and round-the-clock emergency services. The clinic''s fear-free certified staff focus on reducing stress for both pets and their people.',
    'premium', 'active', 'Nashville', 'TN', '615 Church St, Nashville, TN 37219', '(615) 555-0188', 'https://example.com',
    '24/7 Emergency Care', 'Open to all species; walk-ins accepted for emergencies.',
    'Service animals prioritized for same-day scheduling when needed.', 'ESAs treated as standard patients.',
    array['24/7 emergency care', 'Fear-free certified', 'On-site pharmacy', 'Digital imaging'],
    array['https://picsum.photos/seed/vet-clinic-0/900/650', 'https://picsum.photos/seed/vet-clinic-1/900/650', 'https://picsum.photos/seed/vet-clinic-2/900/650', 'https://picsum.photos/seed/vet-clinic-3/900/650'],
    4.7, 402, false, 36.1657, -86.7844
  ),
  (
    'yappy-hour-pet-events', 'Yappy Hour Pet Events', 'Events & Activities',
    'Monthly pet meetups, adoption fairs, and outdoor movie nights.',
    'Yappy Hour Pet Events hosts monthly community meetups including adoption fairs, pet-friendly outdoor movie nights, and seasonal festivals, all held at partner venues with clear pet policies posted in advance.',
    'verified', 'active', 'San Diego', 'CA', 'Liberty Station, San Diego, CA 92106', '(619) 555-0155', 'https://example.com',
    'Events posted monthly', 'Leashed pets welcome at all events; policies vary slightly by venue.',
    'Service animals welcome at every event.', 'ESAs welcome, leash required.',
    array['Water stations', 'Waste bags', 'Vet volunteers on-site', 'Adoption partners'],
    array['https://picsum.photos/seed/yappy-hour-0/900/650', 'https://picsum.photos/seed/yappy-hour-1/900/650', 'https://picsum.photos/seed/yappy-hour-2/900/650', 'https://picsum.photos/seed/yappy-hour-3/900/650'],
    4.6, 71, false, 32.7492, -117.2151
  ),
  (
    'petcab-rides', 'PetCab Rides', 'Transportation',
    'On-demand rideshare service with pet-safe vehicles and carriers.',
    'PetCab Rides offers on-demand transportation with seat covers, safety harnesses, and loaner carriers for pet parents without a car. Drivers complete a pet-handling orientation before joining the platform.',
    'basic', 'active', 'Seattle', 'WA', 'Citywide service', '(206) 555-0121', 'https://example.com',
    'Daily: 6:00 AM – 11:00 PM', 'All pets must be leashed or carriered during the ride.',
    'Service animals ride free of additional fees.', 'ESAs accepted with standard carrier policy.',
    array['Seat covers', 'Safety harnesses', 'Loaner carriers', 'Pet-trained drivers'],
    array['https://picsum.photos/seed/petcab-0/900/650', 'https://picsum.photos/seed/petcab-1/900/650', 'https://picsum.photos/seed/petcab-2/900/650', 'https://picsum.photos/seed/petcab-3/900/650'],
    4.4, 58, false, 47.6062, -122.3321
  )
on conflict (slug) do nothing;

insert into public.department_alerts (department, message, severity)
values
  ('Verification', '14 applications pending review, 3 over SLA', 'warning'),
  ('Finance', 'April invoices reconciled', 'info'),
  ('Customer Success', '2 urgent tickets unassigned', 'critical')
on conflict do nothing;

insert into public.customers (full_name, email, city, state, status, favorites_count)
values
  ('Alex Nguyen', 'alex.nguyen@example.com', 'Austin', 'TX', 'active', 12),
  ('Priya Shah', 'priya.shah@example.com', 'Denver', 'CO', 'active', 4),
  ('Marcus Lee', 'marcus.lee@example.com', 'Portland', 'OR', 'active', 7)
on conflict do nothing;

insert into public.subscriptions (business_id, plan, status, mrr_cents, current_period_end)
select id, 'premium', 'active', 9900, (current_date + interval '20 days')::date
from public.businesses where name = 'Bark & Brew Cafe'
on conflict do nothing;

insert into public.subscriptions (business_id, plan, status, mrr_cents, current_period_end)
select id, 'pro', 'active', 4900, (current_date + interval '12 days')::date
from public.businesses where name = 'Whisker Wanderlust Hotel'
on conflict do nothing;

insert into public.verification_applications
  (business_id, applicant_name, applicant_email, tier_requested, category, status, ai_score, ai_summary, ai_flags, submitted_at)
select id, 'Jess Rivera', 'jess@pawsplaza.com', 'basic', 'Retail', 'pending', 82,
  'Business license and address verified against public records. Photos appear authentic. No red flags found.',
  '["missing_insurance_doc"]', now() - interval '2 days'
from public.businesses where name = 'Paws Plaza Retail'
on conflict do nothing;

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

insert into public.meetings (title, starts_at, department)
values
  ('Verification sync', now() + interval '1 day', 'Verification'),
  ('Founder + Finance monthly close', now() + interval '3 days', 'Finance'),
  ('Marketing content review', now() + interval '5 days', 'Marketing')
on conflict do nothing;

insert into public.revenue_snapshots (month, revenue_cents, mrr_cents, new_customers, churned_customers)
select
  (date_trunc('month', current_date) - (n || ' months')::interval)::date as month,
  120000 + (n * 8500),
  95000 + (n * 6000),
  8 + (n % 4),
  1 + (n % 2)
from generate_series(5, 0, -1) as n
on conflict (month) do nothing;
