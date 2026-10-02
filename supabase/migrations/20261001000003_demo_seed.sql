-- HomeTour AI — demo workspace seeding.
-- Loads the playbook demo (Mike & Sarah Johnson + five Massachusetts properties) into the
-- caller's own organization. Everything is flagged is_demo so the UI can badge it and
-- remove_demo_data() can clean it up.

create or replace function public.seed_demo_data()
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := public.current_org_id();
  v_agent uuid := public.current_profile_id();
  v_client uuid;
  v_tour uuid;
  v_props uuid[] := '{}';
  v_id uuid;
  r record;
  v_saturday date := current_date + ((6 - extract(isodow from current_date)::int + 7) % 7);
begin
  if v_org is null or not public.is_org_staff() then
    raise exception 'Complete onboarding before loading demo data';
  end if;
  if exists (select 1 from public.clients where organization_id = v_org and is_demo) then
    raise exception 'Demo data is already loaded';
  end if;
  if v_saturday = current_date then v_saturday := current_date + 7; end if;

  insert into public.clients (organization_id, agent_id, first_name, last_name, email, phone, status,
    buying_timeline, preapproval_amount, preapproval_status, lender_name, target_price_min, target_price_max,
    target_areas, min_beds, min_baths, property_types, preferred_monthly_payment, down_payment_amount,
    loan_type, offer_readiness, notes, is_demo)
  values (v_org, v_agent, 'Mike & Sarah', 'Johnson', 'mike.sarah@example.com', '(617) 555-0142', 'touring',
    '60-90 days', 725000, 'preapproved', 'Demo Lending Co.', 650000, 725000,
    array['North Shore, MA','Woburn','Reading','Wakefield'], 3, 2, array['single_family'], 4600, 145000,
    'conventional', 'high', 'Demo buyer — 30-40 minute commute to Boston.', true)
  returning id into v_client;

  insert into public.client_members (organization_id, client_id, first_name, last_name, email, is_primary)
  values (v_org, v_client, 'Mike', 'Johnson', 'mike@example.com', true),
         (v_org, v_client, 'Sarah', 'Johnson', 'sarah@example.com', false);

  insert into public.client_preferences (organization_id, client_id, preference_type, category, value, weight,
    confidence, evidence_count, source, confirmed_by_realtor)
  values
    (v_org, v_client, 'must_have', 'bedrooms', '3+ bedrooms', 95, 'high', 0, 'demo', true),
    (v_org, v_client, 'must_have', 'bathrooms', '2+ bathrooms', 90, 'high', 0, 'demo', true),
    (v_org, v_client, 'must_have', 'yard', 'Backyard', 92, 'high', 0, 'demo', true),
    (v_org, v_client, 'must_have', 'price', 'Under $725k', 95, 'high', 0, 'demo', true),
    (v_org, v_client, 'prefer', 'garage', 'Garage', 65, 'medium', 0, 'demo', true),
    (v_org, v_client, 'prefer', 'kitchen', 'Modern kitchen', 70, 'medium', 0, 'demo', true),
    (v_org, v_client, 'prefer', 'basement', 'Finished basement', 60, 'medium', 0, 'demo', true),
    (v_org, v_client, 'dislike', 'location', 'Busy road', 70, 'medium', 0, 'demo', true),
    (v_org, v_client, 'dislike', 'taxes', 'High taxes', 65, 'medium', 0, 'demo', true),
    (v_org, v_client, 'dislike', 'condition', 'Major renovation', 70, 'medium', 0, 'demo', true);

  for r in
    select * from (values
      (1, '24 Main Street', 'Woburn', '01801', 699000, 3, 2.5, 1950, 1962, 8420, 0, 12, 92, 95, 90, 96, 80, 84, 100, 96),
      (2, '81 Forest Avenue', 'Reading', '01867', 675000, 3, 2.0, 1820, 1958, 9150, 0, 21, 87, 97, 92, 88, 78, 88, 95, 82),
      (3, '17 Salem Street', 'Wakefield', '01880', 710000, 4, 2.5, 2240, 1971, 9870, 0, 8, 82, 88, 80, 95, 76, 78, 90, 74),
      (4, '55 Washington Street', 'Burlington', '01803', 725000, 3, 2.0, 1880, 1985, 7240, 0, 33, 79, 82, 74, 86, 88, 72, 85, 70),
      (5, '9 Park Street', 'Stoneham', '02180', 649000, 3, 1.5, 1610, 1949, 6980, 0, 46, 73, 98, 70, 72, 62, 90, 70, 60)
    ) as t(seq, addr, city, zip, price, beds, baths, sqft, yr, tax, hoa, dom,
           overall, s_price, s_loc, s_size, s_cond, s_fin, s_must, s_emo)
  loop
    insert into public.properties (organization_id, address_line1, city, state, zip_code, listing_price, beds, baths,
      square_feet, lot_size, year_built, property_type, property_tax, hoa_fee, days_on_market, mls_number,
      listing_agent_name, listing_brokerage, status, is_demo)
    values (v_org, r.addr, r.city, 'MA', r.zip, r.price, r.beds, r.baths, r.sqft, '0.2 acres', r.yr,
      'single_family', r.tax, r.hoa, r.dom, 'DEMO-' || lpad(r.seq::text, 4, '0'),
      'Demo Listing Agent', 'Demo Brokerage', 'active', true)
    returning id into v_id;
    v_props := v_props || v_id;

    insert into public.property_scores (organization_id, client_id, property_id, overall_score, price_score,
      location_score, size_score, condition_score, financial_score, must_have_score, emotional_score, ai_reasoning)
    values (v_org, v_client, v_id, r.overall, r.s_price, r.s_loc, r.s_size, r.s_cond, r.s_fin, r.s_must, r.s_emo,
      'Demo score — illustrative values from the HomeTour AI playbook.');
  end loop;

  insert into public.tours (organization_id, client_id, agent_id, name, tour_date, status, notes)
  values (v_org, v_client, v_agent, 'Saturday Home Tour', v_saturday, 'planned', 'Demo tour')
  returning id into v_tour;

  insert into public.tour_properties (organization_id, tour_id, property_id, scheduled_time, sequence_number)
  values
    (v_org, v_tour, v_props[1], '10:00', 1),
    (v_org, v_tour, v_props[2], '10:45', 2),
    (v_org, v_tour, v_props[3], '11:30', 3),
    (v_org, v_tour, v_props[4], '12:15', 4);

  return v_client;
end $$;

create or replace function public.remove_demo_data()
returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := public.current_org_id();
begin
  if v_org is null or not public.is_org_staff() then
    raise exception 'Not allowed';
  end if;
  delete from public.clients where organization_id = v_org and is_demo;
  delete from public.properties where organization_id = v_org and is_demo;
end $$;

revoke execute on function public.seed_demo_data(), public.remove_demo_data() from anon;
