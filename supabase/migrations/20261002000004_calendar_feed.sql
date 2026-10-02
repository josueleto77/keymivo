-- Private calendar subscription feed (ICS). Tokens live in their own table with RLS and no policies,
-- so teammates (who can read each other's profiles) can never read someone else's feed token.
create table public.calendar_feeds (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security; -- no policies: only SECURITY DEFINER functions / service role

create or replace function public.get_calendar_token()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile uuid; v_token uuid;
begin
  select id into v_profile from public.profiles where user_id = auth.uid() and role <> 'buyer' and organization_id is not null;
  if v_profile is null then raise exception 'Not allowed'; end if;
  insert into public.calendar_feeds (profile_id) values (v_profile) on conflict (profile_id) do nothing;
  select token into v_token from public.calendar_feeds where profile_id = v_profile;
  return v_token;
end $$;

-- Rotating invalidates the old link (e.g. if it was shared by mistake).
create or replace function public.rotate_calendar_token()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile uuid; v_token uuid;
begin
  select id into v_profile from public.profiles where user_id = auth.uid() and role <> 'buyer' and organization_id is not null;
  if v_profile is null then raise exception 'Not allowed'; end if;
  insert into public.calendar_feeds (profile_id, token) values (v_profile, gen_random_uuid())
  on conflict (profile_id) do update set token = gen_random_uuid(), created_at = now()
  returning token into v_token;
  return v_token;
end $$;

revoke execute on function public.get_calendar_token(), public.rotate_calendar_token() from public, anon;
grant execute on function public.get_calendar_token(), public.rotate_calendar_token() to authenticated;
