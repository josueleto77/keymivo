-- complete_onboarding: log "onboarding_completed" only on the first completion; remove existing duplicates.
create or replace function public.complete_onboarding(p_first_name text, p_last_name text, p_phone text, p_brokerage text, p_license_state text, p_license_number text, p_primary_market text)
 returns uuid language plpgsql security definer set search_path to '' as $function$
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

  -- Log only the first completion (a second tab or a double submit must not log twice).
  if not coalesce(v_profile.onboarding_completed, false) then
    insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id)
    values (v_org, auth.uid(), 'onboarding_completed', 'profile', v_profile.id);
  end if;
  return v_org;
end $function$;

delete from public.activity_logs a using public.activity_logs b
 where a.action = 'onboarding_completed' and b.action = 'onboarding_completed'
   and a.organization_id = b.organization_id and a.user_id is not distinct from b.user_id
   and a.created_at > b.created_at;
