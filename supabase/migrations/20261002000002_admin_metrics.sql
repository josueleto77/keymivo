-- Super Admin platform metrics. Only callable usefully by super_admin (checked inside).
create or replace function public.admin_metrics()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.is_super_admin() then raise exception 'Not allowed'; end if;

  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'active_realtors', (select count(*) from public.profiles p where p.role in ('realtor','team_leader','brokerage_admin','assistant','super_admin')
                          and p.onboarding_completed
                          and exists (select 1 from public.activity_logs a where a.user_id = p.user_id and a.created_at > now() - interval '30 days')),
    'realtors', (select count(*) from public.profiles where role <> 'buyer' and onboarding_completed),
    'active_buyers', (select count(*) from public.client_members where user_id is not null),
    'clients', (select count(*) from public.clients where not is_demo),
    'organizations', (select count(*) from public.organizations),
    'showings', (select count(*) from public.showings),
    'showings_completed', (select count(*) from public.showings where status = 'completed'),
    'ai_analyses', (select count(*) from public.activity_logs where action in ('AI_analysis_generated','buyer_preferences_analyzed','followup_drafted')),
    'mrr', (select coalesce(sum(case subscription_plan when 'pro' then 99 when 'team' then 399 else 0 end), 0)
            from public.organizations where subscription_status = 'active'),
    'committed_mrr', (select coalesce(sum(case subscription_plan when 'pro' then 99 when 'team' then 399 else 0 end), 0)
            from public.organizations where stripe_subscription_id is not null and subscription_status in ('active','trialing','past_due')),
    'subscriptions', jsonb_build_object(
      'free_trial', (select count(*) from public.organizations where stripe_subscription_id is null and subscription_status = 'trialing' and trial_ends_at > now()),
      'trial_expired', (select count(*) from public.organizations where stripe_subscription_id is null and (subscription_status in ('expired','canceled') or (subscription_status = 'trialing' and trial_ends_at <= now()))),
      'paid_trialing', (select count(*) from public.organizations where stripe_subscription_id is not null and subscription_status = 'trialing'),
      'active', (select count(*) from public.organizations where subscription_status = 'active'),
      'past_due', (select count(*) from public.organizations where subscription_status = 'past_due'),
      'pro', (select count(*) from public.organizations where stripe_subscription_id is not null and subscription_plan = 'pro'),
      'team', (select count(*) from public.organizations where stripe_subscription_id is not null and subscription_plan = 'team')
    ),
    -- Conversion = orgs whose trial window has passed (or that subscribed) that hold a paid subscription.
    'trial_conversion', (
      select jsonb_build_object(
        'converted', count(*) filter (where stripe_subscription_id is not null),
        'eligible', count(*) filter (where stripe_subscription_id is not null or trial_ends_at <= now()))
      from public.organizations),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', coalesce(c.n, 0)) order by d), '[]'::jsonb)
      from generate_series(current_date - 29, current_date, interval '1 day') d
      left join (select created_at::date as day, count(*) n from public.profiles group by 1) c on c.day = d::date),
    'recent_signups', (
      select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
        select jsonb_build_object('name', trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), 'email', p.email,
          'role', p.role, 'organization', o.name, 'onboarded', p.onboarding_completed, 'created_at', p.created_at) x
        from public.profiles p left join public.organizations o on o.id = p.organization_id
        order by p.created_at desc limit 12) s),
    'organizations_list', (
      select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
        select jsonb_build_object('name', o.name, 'plan', o.subscription_plan, 'status', o.subscription_status,
          'trial_ends_at', o.trial_ends_at, 'paid', o.stripe_subscription_id is not null, 'created_at', o.created_at,
          'members', (select count(*) from public.profiles p where p.organization_id = o.id and p.role <> 'buyer'),
          'clients', (select count(*) from public.clients c where c.organization_id = o.id)) x
        from public.organizations o order by o.created_at desc limit 50) s),
    'recent_activity', (
      select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
        select jsonb_build_object('action', a.action, 'entity_type', a.entity_type, 'organization', o.name, 'created_at', a.created_at) x
        from public.activity_logs a left join public.organizations o on o.id = a.organization_id
        order by a.created_at desc limit 25) s)
  ) into v;
  return v;
end $$;

revoke execute on function public.admin_metrics() from public, anon;
grant execute on function public.admin_metrics() to authenticated;
