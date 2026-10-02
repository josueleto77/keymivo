-- Team management: managers invite agents by private link; seats enforced per plan.
-- Managers = super_admin, brokerage_admin, team_leader. The Realtor who creates an organization becomes its team_leader.

create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  role text not null default 'realtor' check (role in ('realtor','assistant','team_leader')),
  email text,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.org_invites enable row level security;
create policy "org staff read invites" on public.org_invites for select to authenticated
  using (public.can_access_org(organization_id) or public.is_super_admin());

create or replace function public.is_org_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('super_admin','brokerage_admin','team_leader') from public.profiles where user_id = auth.uid()), false)
$$;

-- Founders of single-agent organizations become team leaders.
update public.profiles p set role = 'team_leader'
where p.role = 'realtor' and p.onboarding_completed
  and not exists (select 1 from public.profiles q where q.organization_id = p.organization_id and q.id <> p.id and q.role <> 'buyer');

create or replace function public.complete_onboarding(
  p_first_name text, p_last_name text, p_phone text, p_brokerage text,
  p_license_state text, p_license_number text, p_primary_market text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles; v_org uuid; v_new_org boolean := false;
begin
  select * into v_profile from public.profiles where user_id = auth.uid();
  if v_profile.id is null then raise exception 'Profile not found'; end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then
    raise exception 'First and last name are required';
  end if;

  v_org := v_profile.organization_id;
  if v_org is null then
    insert into public.organizations (name, state_code, primary_market)
    values (coalesce(nullif(trim(p_brokerage), ''), trim(p_first_name) || ' ' || trim(p_last_name)),
            coalesce(nullif(upper(trim(p_license_state)), ''), 'MA'), nullif(trim(p_primary_market), ''))
    returning id into v_org;
    v_new_org := true;
  end if;

  update public.profiles set
    first_name = trim(p_first_name), last_name = trim(p_last_name), phone = nullif(trim(p_phone), ''),
    brokerage_name = nullif(trim(p_brokerage), ''), license_state = nullif(upper(trim(p_license_state)), ''),
    license_number = nullif(trim(p_license_number), ''), primary_market = nullif(trim(p_primary_market), ''),
    organization_id = v_org,
    role = case when v_new_org and role in ('buyer','realtor') then 'team_leader'
                when role = 'buyer' then 'realtor' else role end,
    onboarding_completed = true
  where id = v_profile.id;

  insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id)
  values (v_org, auth.uid(), 'onboarding_completed', 'profile', v_profile.id);
  return v_org;
end $$;

-- Seats: Team = 5 agents, Brokerage = unlimited, Pro / trial = 1 (team features require Team).
create or replace function public.org_seat_limit(p_org uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case
    when o.subscription_plan = 'brokerage' then 1000
    when o.subscription_plan = 'team' and o.stripe_subscription_id is not null then 5
    else 1 end
  from public.organizations o where o.id = p_org
$$;

create or replace function public.create_team_invite(p_role text, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid := public.current_org_id(); v_used int; v_limit int; v_token uuid;
begin
  if v_org is null or not public.is_org_manager() then raise exception 'Only team leaders can invite agents.'; end if;
  if p_role not in ('realtor','assistant','team_leader') then raise exception 'Invalid role'; end if;
  v_limit := public.org_seat_limit(v_org);
  select (select count(*) from public.profiles where organization_id = v_org and role <> 'buyer')
       + (select count(*) from public.org_invites where organization_id = v_org and accepted_at is null and revoked_at is null
            and created_at > now() - interval '14 days')
    into v_used;
  if v_used >= v_limit then
    if v_limit = 1 then raise exception 'Inviting agents is part of the Team plan. Upgrade in Settings → Billing.'; end if;
    raise exception 'All % seats are in use. Remove a member or revoke a pending invite.', v_limit;
  end if;
  insert into public.org_invites (organization_id, role, email) values (v_org, p_role, nullif(trim(p_email), ''))
  returning token into v_token;
  insert into public.activity_logs (organization_id, user_id, action, entity_type) values (v_org, auth.uid(), 'team_invite_created', 'org_invites');
  return v_token;
end $$;

create or replace function public.revoke_team_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_org_manager() then raise exception 'Not allowed'; end if;
  update public.org_invites set revoked_at = now()
  where id = p_invite_id and organization_id = public.current_org_id() and accepted_at is null;
end $$;

create or replace function public.get_team_invite(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('organization', o.name, 'role', i.role, 'email', i.email,
    'inviter', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')))
  from public.org_invites i
  join public.organizations o on o.id = i.organization_id
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token and i.accepted_at is null and i.revoked_at is null and i.created_at > now() - interval '14 days'
$$;

create or replace function public.accept_team_invite(p_token uuid, p_first_name text, p_last_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.org_invites; v_profile public.profiles;
begin
  select * into v_inv from public.org_invites
  where token = p_token and accepted_at is null and revoked_at is null and created_at > now() - interval '14 days';
  if v_inv.id is null then raise exception 'This invite link is invalid, used or expired. Ask your team leader for a new one.'; end if;
  select * into v_profile from public.profiles where user_id = auth.uid();
  if v_profile.id is null then raise exception 'Profile not found'; end if;
  if v_profile.role = 'buyer' then raise exception 'This is a buyer portal account. Use a different email to join a team.'; end if;
  if v_profile.organization_id is not null and v_profile.organization_id <> v_inv.organization_id then
    raise exception 'This account already belongs to another organization. Use a different email, or ask support to move it.';
  end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then
    raise exception 'First and last name are required';
  end if;

  update public.profiles set organization_id = v_inv.organization_id, role = v_inv.role, onboarding_completed = true,
    first_name = trim(p_first_name), last_name = trim(p_last_name)
  where id = v_profile.id;
  update public.org_invites set accepted_at = now() where id = v_inv.id;
  insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id)
  values (v_inv.organization_id, auth.uid(), 'team_member_joined', 'profiles', v_profile.id);
  return v_inv.organization_id;
end $$;

create or replace function public.set_member_role(p_profile_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.profiles;
begin
  if not public.is_org_manager() then raise exception 'Not allowed'; end if;
  if p_role not in ('realtor','assistant','team_leader') then raise exception 'Invalid role'; end if;
  select * into v_target from public.profiles where id = p_profile_id;
  if v_target.organization_id is distinct from public.current_org_id() or v_target.role in ('buyer','super_admin') then raise exception 'Not allowed'; end if;
  if v_target.user_id = auth.uid() then raise exception 'You cannot change your own role.'; end if;
  update public.profiles set role = p_role where id = p_profile_id;
end $$;

-- Removing a member detaches them; the organization keeps all clients and records they created.
create or replace function public.remove_team_member(p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.profiles;
begin
  if not public.is_org_manager() then raise exception 'Not allowed'; end if;
  select * into v_target from public.profiles where id = p_profile_id;
  if v_target.organization_id is distinct from public.current_org_id() or v_target.role in ('buyer','super_admin') then raise exception 'Not allowed'; end if;
  if v_target.user_id = auth.uid() then raise exception 'You cannot remove yourself.'; end if;
  update public.profiles set organization_id = null, onboarding_completed = false, role = 'realtor' where id = p_profile_id;
  insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id)
  values (v_target.organization_id, auth.uid(), 'team_member_removed', 'profiles', p_profile_id);
end $$;

revoke execute on function public.is_org_manager(), public.org_seat_limit(uuid), public.create_team_invite(text, text),
  public.revoke_team_invite(uuid), public.get_team_invite(uuid), public.accept_team_invite(uuid, text, text),
  public.set_member_role(uuid, text), public.remove_team_member(uuid) from public, anon;
grant execute on function public.is_org_manager(), public.org_seat_limit(uuid), public.create_team_invite(text, text),
  public.revoke_team_invite(uuid), public.get_team_invite(uuid), public.accept_team_invite(uuid, text, text),
  public.set_member_role(uuid, text), public.remove_team_member(uuid) to authenticated;
grant execute on function public.get_team_invite(uuid) to anon;
