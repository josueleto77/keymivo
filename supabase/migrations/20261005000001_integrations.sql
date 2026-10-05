-- Integrations framework. Credentials are encrypted in Supabase Vault; only the service role
-- (Edge Functions) can read them. The browser only ever sees connection status.

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('follow_up_boss','google','docusign')),
  account_label text,
  status text not null default 'connected' check (status in ('connected','error')),
  settings jsonb not null default '{}',
  secret_id uuid,           -- vault.secrets id
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, provider)
);
alter table public.integration_connections enable row level security;
create policy "read own connections" on public.integration_connections for select to authenticated
  using (profile_id = public.current_profile_id());
create trigger set_updated_at before update on public.integration_connections for each row execute function public.set_updated_at();

-- Keymivo entity ↔ external record (so syncs update instead of duplicating).
create table public.integration_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  entity_type text not null,
  entity_id uuid not null,
  external_id text not null,
  synced_at timestamptz not null default now(),
  unique (organization_id, provider, entity_type, entity_id)
);
alter table public.integration_links enable row level security;
create policy "org staff read links" on public.integration_links for select to authenticated
  using (public.can_access_org(organization_id));

-- Service-role-only helpers (Edge Functions).
create or replace function public.integration_save(p_profile uuid, p_provider text, p_secret text, p_label text, p_settings jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_existing public.integration_connections; v_secret uuid;
begin
  select organization_id into v_org from public.profiles where id = p_profile;
  if v_org is null then raise exception 'Profile has no organization'; end if;
  select * into v_existing from public.integration_connections where profile_id = p_profile and provider = p_provider;
  if v_existing.secret_id is not null then
    perform vault.update_secret(v_existing.secret_id, p_secret);
    v_secret := v_existing.secret_id;
  else
    v_secret := vault.create_secret(p_secret, 'integration:' || p_provider || ':' || p_profile::text || ':' || gen_random_uuid()::text);
  end if;
  insert into public.integration_connections (organization_id, profile_id, provider, account_label, status, settings, secret_id, last_error)
  values (v_org, p_profile, p_provider, p_label, 'connected', coalesce(p_settings, '{}'::jsonb), v_secret, null)
  on conflict (profile_id, provider) do update set
    account_label = excluded.account_label, status = 'connected', settings = excluded.settings,
    secret_id = excluded.secret_id, last_error = null;
  return v_secret;
end $$;

create or replace function public.integration_secret(p_profile uuid, p_provider text)
returns text language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret from public.integration_connections c
  join vault.decrypted_secrets s on s.id = c.secret_id
  where c.profile_id = p_profile and c.provider = p_provider
$$;

create or replace function public.integration_delete(p_profile uuid, p_provider text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_secret uuid;
begin
  delete from public.integration_connections where profile_id = p_profile and provider = p_provider returning secret_id into v_secret;
  if v_secret is not null then delete from vault.secrets where id = v_secret; end if;
end $$;

revoke execute on function public.integration_save(uuid, text, text, text, jsonb), public.integration_secret(uuid, text),
  public.integration_delete(uuid, text) from public, anon, authenticated;
grant execute on function public.integration_save(uuid, text, text, text, jsonb), public.integration_secret(uuid, text),
  public.integration_delete(uuid, text) to service_role;
