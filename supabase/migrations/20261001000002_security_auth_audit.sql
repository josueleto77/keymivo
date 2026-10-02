-- HomeTour AI — RLS, auth bootstrap, onboarding, audit trail, storage

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;

-- Tenant tables share one policy shape: staff of the row's organization get full CRUD,
-- super admins can read everything.
do $$
declare t text;
begin
  foreach t in array array['clients','client_members','client_preferences','properties','property_photos',
    'property_intelligence','tours','tour_properties','showings','showing_notes','recording_consents',
    'recordings','transcripts','buyer_reactions','property_scores','tasks','mortgage_scenarios',
    'comparisons','comparison_properties','offers','messages','ai_insights']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "org staff select" on public.%I for select to authenticated
      using (public.can_access_org(organization_id) or public.is_super_admin())$p$, t);
    execute format($p$create policy "org staff insert" on public.%I for insert to authenticated
      with check (public.can_access_org(organization_id))$p$, t);
    execute format($p$create policy "org staff update" on public.%I for update to authenticated
      using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id))$p$, t);
    execute format($p$create policy "org staff delete" on public.%I for delete to authenticated
      using (public.can_access_org(organization_id))$p$, t);
  end loop;
end $$;

-- Organizations: members read their own; staff may edit cosmetic fields only.
create policy "members read own org" on public.organizations for select to authenticated
  using (id = public.current_org_id() or public.is_super_admin());
create policy "staff update own org" on public.organizations for update to authenticated
  using (public.can_access_org(id)) with check (public.can_access_org(id));
revoke update on public.organizations from authenticated;
grant update (name, logo_url, primary_market) on public.organizations to authenticated;

create policy "staff read teams" on public.teams for select to authenticated
  using (public.can_access_org(organization_id) or public.is_super_admin());

-- Profiles: read self + colleagues; update only own non-privileged columns.
create policy "read own profile" on public.profiles for select to authenticated
  using (user_id = auth.uid());
create policy "staff read org profiles" on public.profiles for select to authenticated
  using (public.can_access_org(organization_id) or public.is_super_admin());
create policy "update own profile" on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, phone, avatar_url, license_number, license_state,
  brokerage_name, primary_market, timezone) on public.profiles to authenticated;

-- Activity log: append-only from the client; readable by org staff.
alter table public.activity_logs enable row level security;
create policy "staff read activity" on public.activity_logs for select to authenticated
  using (public.can_access_org(organization_id) or public.is_super_admin());
create policy "staff append activity" on public.activity_logs for insert to authenticated
  with check (public.can_access_org(organization_id) and user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Auth bootstrap: every new auth user gets a profile row
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Onboarding: independent Realtors get their own organization + 14-day Pro trial
-- ─────────────────────────────────────────────────────────────
create or replace function public.complete_onboarding(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_brokerage text,
  p_license_state text,
  p_license_number text,
  p_primary_market text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
  v_org uuid;
begin
  select * into v_profile from public.profiles where user_id = auth.uid();
  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then
    raise exception 'First and last name are required';
  end if;

  v_org := v_profile.organization_id;
  if v_org is null then
    insert into public.organizations (name, state_code, primary_market)
    values (
      coalesce(nullif(trim(p_brokerage), ''), trim(p_first_name) || ' ' || trim(p_last_name)),
      coalesce(nullif(upper(trim(p_license_state)), ''), 'MA'),
      nullif(trim(p_primary_market), '')
    )
    returning id into v_org;
  end if;

  update public.profiles set
    first_name = trim(p_first_name),
    last_name = trim(p_last_name),
    phone = nullif(trim(p_phone), ''),
    brokerage_name = nullif(trim(p_brokerage), ''),
    license_state = nullif(upper(trim(p_license_state)), ''),
    license_number = nullif(trim(p_license_number), ''),
    primary_market = nullif(trim(p_primary_market), ''),
    organization_id = v_org,
    role = case when role = 'buyer' then 'realtor' else role end,
    onboarding_completed = true
  where id = v_profile.id;

  insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id)
  values (v_org, auth.uid(), 'onboarding_completed', 'profile', v_profile.id);

  return v_org;
end $$;
revoke execute on function public.complete_onboarding(text,text,text,text,text,text,text) from anon;

-- ─────────────────────────────────────────────────────────────
-- Audit trail (server-side so it can't be skipped by the client)
-- ─────────────────────────────────────────────────────────────
create or replace function public.log_entity_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_action text;
begin
  v_action := case TG_TABLE_NAME
    when 'clients' then 'client_created'
    when 'properties' then 'property_created'
    when 'tours' then 'tour_created'
    when 'showings' then 'showing_started'
    when 'recording_consents' then 'recording_consent_confirmed'
    when 'client_preferences' then 'preference_created'
    when 'tasks' then 'task_created'
    when 'comparisons' then 'property_compared'
    when 'offers' then 'offer_analysis_created'
    else TG_TABLE_NAME || '_created'
  end;
  insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
  values (new.organization_id, auth.uid(), v_action, TG_TABLE_NAME, new.id, '{}'::jsonb);
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['clients','properties','tours','showings','recording_consents',
    'client_preferences','tasks','comparisons','offers']
  loop
    execute format('create trigger audit_insert after insert on public.%I
      for each row execute function public.log_entity_created()', t);
  end loop;
end $$;

create or replace function public.log_showing_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status = 'completed' then
    insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id)
    values (new.organization_id, auth.uid(), 'showing_completed', 'showings', new.id);
  end if;
  return new;
end $$;
create trigger audit_status after update on public.showings
  for each row execute function public.log_showing_status();

create or replace function public.log_preference_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
  values (new.organization_id, auth.uid(), 'preference_updated', 'client_preferences', new.id,
    jsonb_build_object('value', new.value, 'weight', new.weight, 'type', new.preference_type));
  return new;
end $$;
create trigger audit_update after update on public.client_preferences
  for each row execute function public.log_preference_update();

-- ─────────────────────────────────────────────────────────────
-- Storage: private buckets, first path segment = organization_id
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('property-photos', 'property-photos', false),
  ('showing-media', 'showing-media', false),
  ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "org staff read files" on storage.objects for select to authenticated
  using (bucket_id in ('property-photos','showing-media','recordings')
    and public.can_access_org(((storage.foldername(name))[1])::uuid));
create policy "org staff upload files" on storage.objects for insert to authenticated
  with check (bucket_id in ('property-photos','showing-media','recordings')
    and public.can_access_org(((storage.foldername(name))[1])::uuid));
create policy "org staff delete files" on storage.objects for delete to authenticated
  using (bucket_id in ('property-photos','showing-media','recordings')
    and public.can_access_org(((storage.foldername(name))[1])::uuid));
