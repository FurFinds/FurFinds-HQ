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

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce((new.raw_user_meta_data ->> 'role')::hq_role, 'support')
  )
  on conflict (id) do nothing;
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
  updated_at timestamptz not null default now()
);

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
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_notes text
);

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
  assigned_to uuid references public.profiles (id),
  customer_name text,
  customer_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

drop policy if exists "staff_read_alerts" on public.department_alerts;
create policy "staff_read_alerts" on public.department_alerts
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_alerts" on public.department_alerts;
create policy "staff_write_alerts" on public.department_alerts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "staff_read_site_settings" on public.site_settings;
create policy "staff_read_site_settings" on public.site_settings
  for select using (auth.uid() is not null);

drop policy if exists "staff_write_site_settings" on public.site_settings;
create policy "staff_write_site_settings" on public.site_settings
  for all using (
    public.current_role_name() in ('admin', 'content_editor')
  ) with check (
    public.current_role_name() in ('admin', 'content_editor')
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
