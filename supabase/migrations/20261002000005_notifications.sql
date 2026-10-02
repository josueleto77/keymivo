-- In-app notifications for Realtors (bell). Created by triggers on buyer activity; each user sees only their own.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (recipient_id, created_at desc);
alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications for select to authenticated
  using (recipient_id = public.current_profile_id());
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (recipient_id = public.current_profile_id()) with check (recipient_id = public.current_profile_id());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Recipient = the client's assigned agent (falls back to the org's team leaders when unassigned).
create or replace function public.notify_client_agent(p_client uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.clients;
begin
  select * into c from public.clients where id = p_client;
  if c.id is null then return; end if;
  if c.agent_id is not null then
    insert into public.notifications (organization_id, recipient_id, kind, title, body, link)
    values (c.organization_id, c.agent_id, p_kind, p_title, p_body, p_link);
  else
    insert into public.notifications (organization_id, recipient_id, kind, title, body, link)
    select c.organization_id, p.id, p_kind, p_title, p_body, p_link
    from public.profiles p where p.organization_id = c.organization_id and p.role in ('team_leader','brokerage_admin','super_admin');
  end if;
end $$;

create or replace function public.trg_notify_buyer_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_member text; v_address text; v_label text;
begin
  select first_name into v_member from public.client_members where id = new.client_member_id;
  select address_line1 into v_address from public.properties where id = new.property_id;
  v_label := case new.decision when 'love' then 'Love It' when 'like' then 'Like It' when 'maybe' then 'Maybe'
    when 'pass' then 'Pass' when 'discuss_offer' then 'wants to discuss an offer' else null end;
  perform public.notify_client_agent(new.client_id,
    case when new.decision = 'discuss_offer' then 'offer_interest' else 'buyer_rating' end,
    coalesce(v_member, 'Your buyer') || case when new.decision = 'discuss_offer' then ' wants to discuss an offer on ' else ' rated ' end || coalesce(v_address, 'a home'),
    concat_ws(' · ', case when new.decision <> 'discuss_offer' then v_label end,
      case when new.overall is not null then new.overall || '★ overall' end, nullif(left(new.comment, 140), '')),
    '/properties/' || new.property_id);
  return new;
end $$;
create trigger notify_buyer_rating after insert or update on public.buyer_ratings
  for each row execute function public.trg_notify_buyer_rating();

create or replace function public.trg_notify_buyer_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.sender = 'buyer' then
    perform public.notify_client_agent(new.client_id, 'buyer_message', 'New message from your buyer', left(new.content, 160), '/messages');
  end if;
  return new;
end $$;
create trigger notify_buyer_message after insert on public.messages
  for each row execute function public.trg_notify_buyer_message();

create or replace function public.trg_notify_portal_joined()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null and old.user_id is null then
    perform public.notify_client_agent(new.client_id, 'portal_joined', new.first_name || ' joined the buyer portal',
      'They can now see shared homes, rate them and message you.', '/clients/' || new.client_id);
  end if;
  return new;
end $$;
create trigger notify_portal_joined after update of user_id on public.client_members
  for each row execute function public.trg_notify_portal_joined();

revoke execute on function public.notify_client_agent(uuid, text, text, text, text), public.trg_notify_buyer_rating(),
  public.trg_notify_buyer_message(), public.trg_notify_portal_joined() from public, anon, authenticated;
