-- HomeTour AI — core schema
-- Multi-tenant: Organization → Team → Realtor (profile) → Clients.
-- Every tenant-owned row carries organization_id, defaulted from the caller's profile
-- and enforced by RLS through public.can_access_org().

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Utility: updated_at
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Organizations, teams, profiles
-- ─────────────────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  state_code text not null default 'MA',
  primary_market text,
  subscription_plan text not null default 'pro_trial'
    check (subscription_plan in ('pro_trial','pro','team','brokerage')),
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing','active','past_due','canceled','expired')),
  trial_started_at timestamptz default now(),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  first_name text,
  last_name text,
  email text,
  phone text,
  avatar_url text,
  license_number text,
  license_state text,
  brokerage_name text,
  primary_market text,
  role text not null default 'realtor'
    check (role in ('super_admin','brokerage_admin','team_leader','realtor','assistant','buyer')),
  timezone text not null default 'America/New_York',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.profiles (organization_id);

-- ─────────────────────────────────────────────────────────────
-- Auth helpers (security definer so RLS policies can call them
-- without recursing into profiles' own policies)
-- ─────────────────────────────────────────────────────────────
create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select organization_id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'super_admin' from public.profiles where user_id = auth.uid()), false)
$$;

create or replace function public.is_org_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select role in ('super_admin','brokerage_admin','team_leader','realtor','assistant')
    from public.profiles where user_id = auth.uid()
  ), false)
$$;

-- Staff of the given organization (buyers are excluded even if linked to the org).
create or replace function public.can_access_org(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.organization_id = org
      and p.role in ('super_admin','brokerage_admin','team_leader','realtor','assistant')
  )
$$;

revoke execute on function public.current_profile_id(), public.current_org_id(),
  public.is_super_admin(), public.is_org_staff(), public.can_access_org(uuid) from anon;

-- ─────────────────────────────────────────────────────────────
-- Clients (buyers) and household members
-- ─────────────────────────────────────────────────────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  agent_id uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  status text not null default 'new'
    check (status in ('new','searching','touring','offer_ready','offer_submitted','under_contract','closed','paused')),
  buying_timeline text,
  preapproval_amount numeric(12,2),
  preapproval_status text check (preapproval_status in ('none','in_progress','preapproved','expired')),
  lender_name text,
  target_price_min numeric(12,2),
  target_price_max numeric(12,2),
  target_areas text[] not null default '{}',
  min_beds numeric(3,1),
  min_baths numeric(3,1),
  property_types text[] not null default '{}',
  preferred_monthly_payment numeric(10,2),
  down_payment_amount numeric(12,2),
  loan_type text,
  offer_readiness text not null default 'low' check (offer_readiness in ('low','medium','high')),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.clients (organization_id);
create index on public.clients (agent_id);

-- Multiple buyers per client account (household disagreement feature).
create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.client_members (client_id);
create index on public.client_members (user_id);

-- Dynamic preference model (Prompt 1 + Prompt 3 fields).
create table public.client_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  preference_type text not null
    check (preference_type in ('must_have','strong_preference','prefer','neutral','dislike','strong_dislike','deal_breaker')),
  category text not null,
  value text not null,
  weight integer not null default 50 check (weight between 0 and 100),
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  evidence_count integer not null default 0,
  source text not null default 'realtor'
    check (source in ('onboarding','realtor','buyer','showing_ai','demo')),
  status text not null default 'active' check (status in ('active','suggested','rejected')),
  confirmed_by_realtor boolean not null default false,
  confirmed_by_buyer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.client_preferences (client_id);

-- ─────────────────────────────────────────────────────────────
-- Properties
-- ─────────────────────────────────────────────────────────────
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  address_line1 text not null,
  city text not null,
  state text not null default 'MA',
  zip_code text,
  latitude double precision,
  longitude double precision,
  listing_price numeric(12,2),
  beds numeric(3,1),
  baths numeric(3,1),
  square_feet integer,
  lot_size text,
  year_built integer,
  property_type text check (property_type in ('single_family','condo','townhouse','multi_family','land','other')),
  property_tax numeric(10,2),
  hoa_fee numeric(10,2),
  days_on_market integer,
  mls_number text,
  listing_agent_name text,
  listing_brokerage text,
  primary_photo text,
  status text not null default 'active'
    check (status in ('active','pending','under_contract','sold','off_market','coming_soon')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.properties (organization_id);

create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  showing_id uuid,
  photo_url text not null,       -- storage path inside a private bucket
  room_type text,
  caption text,
  uploaded_by uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.property_photos (property_id);

create table public.property_intelligence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  category text not null,
  title text not null,
  value text,
  source text not null default 'agent_note'
    check (source in ('verified','public_record','mls','agent_note','ai_estimate','buyer_input','demo')),
  source_url text,
  confidence text check (confidence in ('low','medium','high')),
  verified boolean not null default false,
  retrieved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.property_intelligence (property_id);

-- ─────────────────────────────────────────────────────────────
-- Tours & showings
-- ─────────────────────────────────────────────────────────────
create table public.tours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  agent_id uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  name text not null,
  tour_date date not null,
  status text not null default 'planned' check (status in ('planned','active','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tours (organization_id, tour_date);
create index on public.tours (client_id);

create table public.tour_properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  tour_id uuid not null references public.tours(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  scheduled_time time,
  sequence_number integer not null default 1,
  status text not null default 'scheduled' check (status in ('scheduled','showing','completed','skipped')),
  created_at timestamptz not null default now(),
  unique (tour_id, property_id)
);
create index on public.tour_properties (tour_id);

create table public.showings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  tour_id uuid references public.tours(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  agent_id uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  property_id uuid not null references public.properties(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  recording_consent boolean not null default false,
  buyer_interest_score integer check (buyer_interest_score between 0 and 100),
  buyer_interest_level text check (buyer_interest_level in ('low','medium','high','very_high')),
  ai_status text not null default 'not_started'
    check (ai_status in ('not_started','processing','completed','failed')),
  ai_summary text,
  ai_analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.showings (client_id);
create index on public.showings (property_id);
create index on public.showings (tour_id);

alter table public.property_photos
  add constraint property_photos_showing_id_fkey
  foreign key (showing_id) references public.showings(id) on delete set null;

create table public.showing_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  showing_id uuid not null references public.showings(id) on delete cascade,
  author_id uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  note_type text not null default 'text' check (note_type in ('text','voice','question','concern')),
  room_type text,
  content text not null,
  sentiment text check (sentiment in ('positive','neutral','negative')),
  created_at timestamptz not null default now()
);
create index on public.showing_notes (showing_id);

create table public.recording_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  showing_id uuid not null references public.showings(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  consent_confirmed boolean not null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.recording_consents (showing_id);

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  showing_id uuid not null references public.showings(id) on delete cascade,
  audio_url text not null,       -- storage path in private 'recordings' bucket
  duration_seconds integer,
  transcription_status text not null default 'pending'
    check (transcription_status in ('pending','processing','completed','failed')),
  created_at timestamptz not null default now()
);
create index on public.recordings (showing_id);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  showing_id uuid not null references public.showings(id) on delete cascade,
  recording_id uuid references public.recordings(id) on delete cascade,
  content text not null,
  speaker_data jsonb,
  created_at timestamptz not null default now()
);
create index on public.transcripts (showing_id);

create table public.buyer_reactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  showing_id uuid references public.showings(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  client_member_id uuid references public.client_members(id) on delete set null,
  property_id uuid not null references public.properties(id) on delete cascade,
  feature text not null,
  reaction text not null check (reaction in ('love','like','neutral','dislike','deal_breaker')),
  sentiment text check (sentiment in ('positive','neutral','negative')),
  strength integer check (strength between 1 and 5),
  source text not null default 'realtor' check (source in ('realtor','buyer','showing_ai')),
  created_at timestamptz not null default now()
);
create index on public.buyer_reactions (client_id, property_id);
create index on public.buyer_reactions (showing_id);

create table public.property_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  overall_score integer check (overall_score between 0 and 100),
  price_score integer, location_score integer, condition_score integer, size_score integer,
  financial_score integer, must_have_score integer, emotional_score integer,
  ai_reasoning text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, property_id)
);

-- ─────────────────────────────────────────────────────────────
-- Work, finance, comparison, messaging, insights, audit
-- ─────────────────────────────────────────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  agent_id uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  client_id uuid references public.clients(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  showing_id uuid references public.showings(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  due_date date,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks (organization_id, status);

create table public.mortgage_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  purchase_price numeric(12,2) not null,
  down_payment numeric(12,2) not null,
  loan_amount numeric(12,2) not null,
  interest_rate numeric(6,3) not null,
  loan_term_years integer not null,
  taxes_monthly numeric(10,2) not null default 0,
  insurance_monthly numeric(10,2) not null default 0,
  hoa_monthly numeric(10,2) not null default 0,
  pmi_monthly numeric(10,2) not null default 0,
  principal_interest numeric(10,2) not null,
  total_monthly_payment numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  agent_id uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.comparison_properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  comparison_id uuid not null references public.comparisons(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  rank integer,
  created_at timestamptz not null default now(),
  unique (comparison_id, property_id)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  agent_id uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  potential_price numeric(12,2),
  status text not null default 'considering'
    check (status in ('considering','preparing','submitted','accepted','rejected','withdrawn')),
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  agent_id uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  type text not null default 'note' check (type in ('follow_up','note','update','question')),
  channel text not null default 'portal' check (channel in ('email','sms','portal')),
  content text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','sent','failed')),
  created_at timestamptz not null default now()
);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  showing_id uuid references public.showings(id) on delete cascade,
  insight_type text not null,
  content text not null,
  structured_data jsonb,
  confidence text check (confidence in ('low','medium','high')),
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid default auth.uid(),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.activity_logs (organization_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['organizations','teams','profiles','clients','client_members','client_preferences',
    'properties','tours','showings','property_scores','tasks','offers']
  loop
    execute format('create trigger set_updated_at before update on public.%I
      for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
