-- Client-side error reports (in-app monitoring). Anyone using the app can report; only super admins read.
create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  organization_id uuid,
  area text not null default 'app' check (area in ('app','portal','public')),
  kind text not null default 'error' check (kind in ('error','unhandledrejection','render')),
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 4000),
  path text check (char_length(path) <= 300),
  user_agent text check (char_length(user_agent) <= 300),
  release text check (char_length(release) <= 60)
);
create index on public.app_errors (created_at desc);
alter table public.app_errors enable row level security;

-- Insert-only for clients; organization is stamped by the trigger below (never trusted from the client).
create policy "anyone can report errors" on public.app_errors for insert to anon, authenticated
  with check (user_id is not distinct from auth.uid());
create policy "super admins read errors" on public.app_errors for select to authenticated
  using (public.is_super_admin());

create or replace function public.trg_app_errors_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recent int;
begin
  new.organization_id := public.current_org_id();
  -- Basic flood control: at most 30 reports per user (or anonymous) per 10 minutes.
  select count(*) into recent from public.app_errors
   where created_at > now() - interval '10 minutes' and user_id is not distinct from new.user_id;
  if recent >= 30 then return null; end if;
  if random() < 0.01 then delete from public.app_errors where created_at < now() - interval '60 days'; end if;
  return new;
end $$;
create trigger app_errors_stamp before insert on public.app_errors for each row execute function public.trg_app_errors_stamp();
