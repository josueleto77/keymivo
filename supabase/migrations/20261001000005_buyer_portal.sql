-- Buyer portal: invites, explicit sharing, buyer ratings, portal messaging.
-- Buyers never get direct table access. Everything they see comes from SECURITY DEFINER
-- functions that return curated fields for their own client account only.

create table public.buyer_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_member_id uuid not null references public.client_members(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid default public.current_profile_id() references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.portal_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (client_id, property_id)
);

create table public.buyer_ratings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  client_member_id uuid not null references public.client_members(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  overall smallint check (overall between 1 and 5),
  kitchen smallint check (kitchen between 1 and 5),
  location smallint check (location between 1 and 5),
  bedrooms smallint check (bedrooms between 1 and 5),
  condition smallint check (condition between 1 and 5),
  backyard smallint check (backyard between 1 and 5),
  value smallint check (value between 1 and 5),
  decision text check (decision in ('love','like','maybe','pass','discuss_offer')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_member_id, property_id)
);
create index on public.buyer_ratings (client_id, property_id);
create trigger set_updated_at before update on public.buyer_ratings for each row execute function public.set_updated_at();

alter table public.messages add column sender text not null default 'agent' check (sender in ('agent','buyer'));

-- Staff RLS (same shape as other tenant tables)
do $$
declare t text;
begin
  foreach t in array array['buyer_invites','portal_shares','buyer_ratings'] loop
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

-- ─────────────────────────────────────────────────────────────
-- Buyer helpers
-- ─────────────────────────────────────────────────────────────
create or replace function public.portal_property_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  with c as (select client_id from public.client_members where user_id = auth.uid())
  select property_id from public.portal_shares where client_id in (select client_id from c)
  union
  select tp.property_id from public.tour_properties tp join public.tours t on t.id = tp.tour_id
    where t.client_id in (select client_id from c) and t.status <> 'cancelled'
  union
  select property_id from public.showings where client_id in (select client_id from c)
$$;

-- Buyers can view photos of properties shared with them.
create policy "buyers read shared property photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'property-photos'
    and ((storage.foldername(name))[2])::uuid in (select public.portal_property_ids())
  );

-- ─────────────────────────────────────────────────────────────
-- Invites
-- ─────────────────────────────────────────────────────────────
create or replace function public.create_buyer_invite(p_member_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_member public.client_members; v_token uuid;
begin
  select * into v_member from public.client_members where id = p_member_id;
  if v_member.id is null or not public.can_access_org(v_member.organization_id) then
    raise exception 'Not allowed';
  end if;
  if v_member.user_id is not null then
    raise exception '% already has portal access', v_member.first_name;
  end if;
  select token into v_token from public.buyer_invites
    where client_member_id = p_member_id and accepted_at is null and created_at > now() - interval '30 days'
    order by created_at desc limit 1;
  if v_token is null then
    insert into public.buyer_invites (organization_id, client_member_id)
    values (v_member.organization_id, p_member_id) returning token into v_token;
  end if;
  return v_token;
end $$;

-- Minimal, non-sensitive invite preview for the join page (token is the secret).
create or replace function public.get_buyer_invite(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'member_first_name', m.first_name,
    'member_email', m.email,
    'agent_name', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
    'brokerage', p.brokerage_name,
    'accepted', i.accepted_at is not null
  )
  from public.buyer_invites i
  join public.client_members m on m.id = i.client_member_id
  join public.clients c on c.id = m.client_id
  left join public.profiles p on p.id = c.agent_id
  where i.token = p_token and i.created_at > now() - interval '30 days'
$$;

create or replace function public.accept_buyer_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.buyer_invites; v_member public.client_members; v_profile public.profiles;
begin
  select * into v_inv from public.buyer_invites where token = p_token and created_at > now() - interval '30 days';
  if v_inv.id is null then raise exception 'This invite link is invalid or has expired. Ask your agent for a new one.'; end if;
  select * into v_member from public.client_members where id = v_inv.client_member_id;
  if v_member.user_id is not null and v_member.user_id <> auth.uid() then
    raise exception 'This invite has already been used by another account.';
  end if;
  select * into v_profile from public.profiles where user_id = auth.uid();
  if v_profile.id is null then raise exception 'Profile not found'; end if;
  if v_profile.role <> 'buyer' and v_profile.onboarding_completed then
    raise exception 'This email is registered as a Realtor account. Please use a different email for the buyer portal.';
  end if;

  update public.client_members set user_id = auth.uid() where id = v_member.id;
  update public.profiles set
    role = 'buyer',
    organization_id = v_inv.organization_id,
    first_name = coalesce(first_name, v_member.first_name),
    last_name = coalesce(last_name, v_member.last_name),
    onboarding_completed = true
  where id = v_profile.id;
  update public.buyer_invites set accepted_at = coalesce(accepted_at, now()) where id = v_inv.id;

  insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id)
  values (v_inv.organization_id, auth.uid(), 'buyer_portal_joined', 'client_members', v_member.id);
  return v_member.client_id;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Portal read model (curated fields only — no Realtor notes, no AI analysis)
-- ─────────────────────────────────────────────────────────────
create or replace function public.portal_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare m public.client_members; c public.clients; a public.profiles;
begin
  select * into m from public.client_members where user_id = auth.uid() order by created_at limit 1;
  if m.id is null then raise exception 'No buyer portal access for this account.'; end if;
  select * into c from public.clients where id = m.client_id;
  select * into a from public.profiles where id = c.agent_id;

  return jsonb_build_object(
    'me', jsonb_build_object('member_id', m.id, 'first_name', m.first_name),
    'client', jsonb_build_object(
      'id', c.id, 'name', trim(c.first_name || ' ' || coalesce(c.last_name, '')),
      'budget_min', c.target_price_min, 'budget_max', c.target_price_max,
      'down_payment', c.down_payment_amount, 'target_areas', c.target_areas, 'is_demo', c.is_demo),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'first_name', x.first_name, 'joined', x.user_id is not null)
                 order by x.is_primary desc, x.created_at), '[]'::jsonb)
                from public.client_members x where x.client_id = c.id),
    'agent', jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name, 'email', a.email,
                                'phone', a.phone, 'brokerage', a.brokerage_name),
    'properties', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'address_line1', p.address_line1, 'city', p.city, 'state', p.state, 'zip_code', p.zip_code,
        'listing_price', p.listing_price, 'beds', p.beds, 'baths', p.baths, 'square_feet', p.square_feet,
        'year_built', p.year_built, 'property_tax', p.property_tax, 'hoa_fee', p.hoa_fee, 'lot_size', p.lot_size,
        'property_type', p.property_type, 'primary_photo', p.primary_photo, 'status', p.status, 'is_demo', p.is_demo,
        'shared_note', (select s.note from public.portal_shares s where s.client_id = c.id and s.property_id = p.id),
        'toured', exists (select 1 from public.showings sh where sh.client_id = c.id and sh.property_id = p.id and sh.status = 'completed'),
        'match_score', (select ps.overall_score from public.property_scores ps where ps.client_id = c.id and ps.property_id = p.id),
        'ratings', (select coalesce(jsonb_agg(jsonb_build_object(
            'member_id', r.client_member_id, 'overall', r.overall, 'kitchen', r.kitchen, 'location', r.location,
            'bedrooms', r.bedrooms, 'condition', r.condition, 'backyard', r.backyard, 'value', r.value,
            'decision', r.decision, 'comment', r.comment, 'updated_at', r.updated_at)), '[]'::jsonb)
          from public.buyer_ratings r where r.client_id = c.id and r.property_id = p.id)
      ) order by p.created_at desc), '[]'::jsonb)
      from public.properties p where p.id in (select public.portal_property_ids())),
    'tours', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'tour_date', t.tour_date, 'status', t.status,
        'stops', (select coalesce(jsonb_agg(jsonb_build_object('property_id', tp.property_id, 'scheduled_time', tp.scheduled_time,
                    'sequence_number', tp.sequence_number, 'status', tp.status) order by tp.sequence_number), '[]'::jsonb)
                  from public.tour_properties tp where tp.tour_id = t.id)
      ) order by t.tour_date), '[]'::jsonb)
      from public.tours t where t.client_id = c.id and t.status <> 'cancelled'),
    'messages', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'content', g.content, 'sender', g.sender, 'created_at', g.created_at)
                  order by g.created_at), '[]'::jsonb)
                 from public.messages g where g.client_id = c.id and g.channel = 'portal' and g.status = 'sent')
  );
end $$;

-- ─────────────────────────────────────────────────────────────
-- Buyer actions
-- ─────────────────────────────────────────────────────────────
create or replace function public.portal_rate_property(p_property_id uuid, p_ratings jsonb, p_decision text, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.client_members;
  c public.clients;
  k text; stars int; feat text; v_reaction text;
  features constant jsonb := '{"kitchen":"Kitchen","location":"Location","bedrooms":"Bedroom","condition":"Condition","backyard":"Yard","value":"Value"}';
  s public.property_scores;
  v_emotional int;
begin
  select * into m from public.client_members where user_id = auth.uid() order by created_at limit 1;
  if m.id is null then raise exception 'No buyer portal access.'; end if;
  if p_property_id not in (select public.portal_property_ids()) then raise exception 'Property not available.'; end if;
  if p_decision is not null and p_decision not in ('love','like','maybe','pass','discuss_offer') then raise exception 'Invalid decision'; end if;
  select * into c from public.clients where id = m.client_id;

  insert into public.buyer_ratings (organization_id, client_id, client_member_id, property_id,
    overall, kitchen, location, bedrooms, condition, backyard, value, decision, comment)
  values (c.organization_id, c.id, m.id, p_property_id,
    nullif((p_ratings->>'overall')::int, 0), nullif((p_ratings->>'kitchen')::int, 0), nullif((p_ratings->>'location')::int, 0),
    nullif((p_ratings->>'bedrooms')::int, 0), nullif((p_ratings->>'condition')::int, 0), nullif((p_ratings->>'backyard')::int, 0),
    nullif((p_ratings->>'value')::int, 0), p_decision, nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (client_member_id, property_id) do update set
    overall = excluded.overall, kitchen = excluded.kitchen, location = excluded.location, bedrooms = excluded.bedrooms,
    condition = excluded.condition, backyard = excluded.backyard, value = excluded.value,
    decision = excluded.decision, comment = excluded.comment;

  -- Mirror ratings into buyer_reactions (source = buyer) so they feed scores, comparison and learning.
  delete from public.buyer_reactions where client_member_id = m.id and property_id = p_property_id and source = 'buyer';
  for k, feat in select key, value #>> '{}' from jsonb_each(features) loop
    stars := nullif((p_ratings->>k)::int, 0);
    continue when stars is null;
    v_reaction := case stars when 5 then 'love' when 4 then 'like' when 3 then 'neutral' else 'dislike' end;
    insert into public.buyer_reactions (organization_id, client_id, client_member_id, property_id, feature, reaction, sentiment, strength, source)
    values (c.organization_id, c.id, m.id, p_property_id, feat, v_reaction,
      case when stars >= 4 then 'positive' when stars = 3 then 'neutral' else 'negative' end, stars, 'buyer');
  end loop;
  v_reaction := case p_decision when 'love' then 'love' when 'discuss_offer' then 'love' when 'like' then 'like'
    when 'maybe' then 'neutral' when 'pass' then 'dislike' else
    case nullif((p_ratings->>'overall')::int, 0) when 5 then 'love' when 4 then 'like' when 3 then 'neutral' when 2 then 'dislike' when 1 then 'dislike' end end;
  if v_reaction is not null then
    insert into public.buyer_reactions (organization_id, client_id, client_member_id, property_id, feature, reaction, sentiment, source)
    values (c.organization_id, c.id, m.id, p_property_id, 'Overall', v_reaction,
      case when v_reaction in ('love','like') then 'positive' when v_reaction = 'neutral' then 'neutral' else 'negative' end, 'buyer');
  end if;

  -- Update the Buyer Match "buyer reaction" component and re-weight overall (if a score exists).
  select round(avg(case reaction when 'love' then 100 when 'like' then 80 when 'neutral' then 55 when 'dislike' then 30 else 0 end))
    into v_emotional from public.buyer_reactions where client_id = c.id and property_id = p_property_id;
  select * into s from public.property_scores where client_id = c.id and property_id = p_property_id;
  if s.id is not null and v_emotional is not null then
    update public.property_scores set
      emotional_score = v_emotional,
      overall_score = round(
        coalesce(must_have_score, 80) * 0.30 + coalesce(price_score, 70) * 0.20 + coalesce(location_score, 70) * 0.15 +
        coalesce(size_score, 75) * 0.10 + coalesce(condition_score, 70) * 0.10 + coalesce(financial_score, 70) * 0.10 +
        v_emotional * 0.05)
    where id = s.id;
  end if;

  if p_decision = 'discuss_offer' and c.offer_readiness <> 'high' then
    update public.clients set offer_readiness = 'high' where id = c.id;
  end if;

  insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
  values (c.organization_id, auth.uid(), 'buyer_rating_submitted', 'properties', p_property_id,
    jsonb_build_object('member', m.first_name, 'decision', p_decision));
end $$;

create or replace function public.portal_send_message(p_content text)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.client_members; c public.clients;
begin
  select * into m from public.client_members where user_id = auth.uid() order by created_at limit 1;
  if m.id is null then raise exception 'No buyer portal access.'; end if;
  if coalesce(trim(p_content), '') = '' then raise exception 'Message is empty'; end if;
  select * into c from public.clients where id = m.client_id;
  insert into public.messages (organization_id, client_id, agent_id, type, channel, status, sender, content)
  values (c.organization_id, c.id, c.agent_id, 'question', 'portal', 'sent', 'buyer',
    m.first_name || ': ' || left(trim(p_content), 4000));
end $$;

revoke execute on function public.portal_property_ids(), public.create_buyer_invite(uuid), public.get_buyer_invite(uuid),
  public.accept_buyer_invite(uuid), public.portal_data(), public.portal_rate_property(uuid, jsonb, text, text),
  public.portal_send_message(text) from public, anon;
grant execute on function public.portal_property_ids(), public.create_buyer_invite(uuid), public.get_buyer_invite(uuid),
  public.accept_buyer_invite(uuid), public.portal_data(), public.portal_rate_property(uuid, jsonb, text, text),
  public.portal_send_message(text) to authenticated;
-- The join page shows who invited you before you sign in.
grant execute on function public.get_buyer_invite(uuid) to anon;
