-- Offer analysis (informational preparation, never a contract).
-- inputs: what the Realtor knows about the market for this home (comps, DOM, repairs, market pace, financing).
-- analysis: three scenarios. Prices / payments / fit are computed in code; the AI only explains them.
alter table public.offers
  add column inputs jsonb not null default '{}',
  add column selected_scenario text check (selected_scenario in ('conservative','competitive','strong')),
  add column ai_status text not null default 'none' check (ai_status in ('none','processing','completed','failed')),
  add column analyzed_at timestamptz,
  add column notes text;

create index on public.offers (organization_id, status);
create index on public.offers (client_id);
create index on public.offers (property_id);

-- Keep the buyer's pipeline status in step with their offers.
create or replace function public.sync_client_status_from_offer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'submitted' then
      update public.clients set status = 'offer_submitted'
      where id = new.client_id and status in ('new','searching','touring','offer_ready');
    elsif new.status = 'accepted' then
      update public.clients set status = 'under_contract'
      where id = new.client_id and status not in ('under_contract','closed');
    elsif new.status = 'preparing' then
      update public.clients set status = 'offer_ready'
      where id = new.client_id and status in ('new','searching','touring');
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.sync_client_status_from_offer() from public, anon, authenticated;

create trigger offers_sync_client_status after update of status on public.offers
  for each row execute function public.sync_client_status_from_offer();
