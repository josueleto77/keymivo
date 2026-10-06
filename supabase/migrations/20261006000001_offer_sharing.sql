-- Share an offer analysis with the buyer's portal. The buyer sees a SNAPSHOT taken at share time
-- (what the Realtor approved), never the live analysis, internal notes, data gaps or model details.
alter table public.offers
  add column shared_at timestamptz,
  add column shared_analysis jsonb,
  add column share_note text;

create table public.offer_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  client_member_id uuid not null references public.client_members(id) on delete cascade,
  choice text not null check (choice in ('conservative','competitive','strong','not_ready','discuss')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_id, client_member_id)
);
create index on public.offer_responses (offer_id);
alter table public.offer_responses enable row level security;
create policy "org staff select" on public.offer_responses for select to authenticated
  using (public.can_access_org(organization_id) or public.is_super_admin());
create trigger set_updated_at before update on public.offer_responses for each row execute function public.set_updated_at();

-- ── Realtor actions ─────────────────────────────────────────────────
create or replace function public.share_offer_with_buyer(p_offer uuid, p_note text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare o public.offers; v_address text; v_now timestamptz := now(); v_first boolean;
begin
  select * into o from public.offers where id = p_offer;
  if o.id is null or not public.can_access_org(o.organization_id) then raise exception 'Offer not found'; end if;
  if o.analysis is null then raise exception 'Run the analysis before sharing it.'; end if;
  v_first := o.shared_at is null;
  select address_line1 into v_address from public.properties where id = o.property_id;

  update public.offers set
    shared_at = v_now,
    shared_analysis = o.analysis - 'data_gaps' - 'model',
    share_note = nullif(trim(coalesce(p_note, '')), '')
  where id = o.id;

  insert into public.messages (organization_id, client_id, agent_id, property_id, type, channel, status, sender, content)
  values (o.organization_id, o.client_id, public.current_profile_id(), o.property_id, 'update', 'portal', 'sent', 'agent',
    case when v_first then 'I put together an offer strategy for ' else 'I updated the offer strategy for ' end
      || coalesce(v_address, 'the home') || '. Open Offers in your portal to compare the options and tell me which one you prefer.'
      || coalesce(E'\n\n' || nullif(trim(coalesce(p_note, '')), ''), ''));
  return v_now;
end $$;

create or replace function public.unshare_offer(p_offer uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.offers;
begin
  select * into o from public.offers where id = p_offer;
  if o.id is null or not public.can_access_org(o.organization_id) then raise exception 'Offer not found'; end if;
  update public.offers set shared_at = null, shared_analysis = null, share_note = null where id = o.id;
end $$;

-- ── Buyer action ────────────────────────────────────────────────────
create or replace function public.portal_respond_offer(p_offer uuid, p_choice text, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.client_members; o public.offers; v_address text; v_title text;
begin
  select * into m from public.client_members where user_id = auth.uid() order by created_at limit 1;
  if m.id is null then raise exception 'No buyer portal access.'; end if;
  select * into o from public.offers where id = p_offer;
  if o.id is null or o.client_id <> m.client_id or o.shared_at is null then raise exception 'Offer not available.'; end if;
  if p_choice not in ('conservative','competitive','strong','not_ready','discuss') then raise exception 'Invalid choice'; end if;

  insert into public.offer_responses (organization_id, offer_id, client_id, client_member_id, choice, comment)
  values (o.organization_id, o.id, o.client_id, m.id, p_choice, nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (offer_id, client_member_id) do update set choice = excluded.choice, comment = excluded.comment;

  select address_line1 into v_address from public.properties where id = o.property_id;
  v_title := coalesce(m.first_name, 'Your buyer') || case p_choice
    when 'not_ready' then ' isn''t ready to offer on '
    when 'discuss' then ' wants to talk about the offer on '
    else ' prefers the ' || initcap(p_choice) || ' offer on ' end || coalesce(v_address, 'a home');
  perform public.notify_client_agent(o.client_id, 'offer_response', v_title, nullif(left(trim(coalesce(p_comment, '')), 160), ''), '/offers/' || o.id);
end $$;

revoke execute on function public.share_offer_with_buyer(uuid, text), public.unshare_offer(uuid),
  public.portal_respond_offer(uuid, text, text) from public, anon;
grant execute on function public.share_offer_with_buyer(uuid, text), public.unshare_offer(uuid),
  public.portal_respond_offer(uuid, text, text) to authenticated;

-- ── Portal read model: add shared offers ────────────────────────────
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
                 from public.messages g where g.client_id = c.id and g.channel = 'portal' and g.status = 'sent'),
    'offers', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'property_id', o.property_id, 'status', o.status, 'shared_at', o.shared_at, 'note', o.share_note,
        'address_line1', p.address_line1, 'city', p.city, 'state', p.state, 'listing_price', p.listing_price, 'primary_photo', p.primary_photo,
        'analysis', o.shared_analysis,
        'responses', (select coalesce(jsonb_agg(jsonb_build_object('member_id', r.client_member_id, 'choice', r.choice,
                        'comment', r.comment, 'updated_at', r.updated_at)), '[]'::jsonb)
                      from public.offer_responses r where r.offer_id = o.id)
      ) order by o.shared_at desc), '[]'::jsonb)
      from public.offers o join public.properties p on p.id = o.property_id
      where o.client_id = c.id and o.shared_at is not null and o.status <> 'withdrawn')
  );
end $$;
