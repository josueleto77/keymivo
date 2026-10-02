-- Stripe billing architecture. Subscription fields are written only by Edge Functions
-- (service role) — clients can't grant themselves a paid plan (no column grants).

alter table public.organizations
  add column stripe_subscription_id text,
  add column current_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false;

-- Webhook idempotency log (service role only: RLS on, no policies).
create table public.stripe_events (
  id text primary key,
  type text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
