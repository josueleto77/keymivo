-- Track invites sent from the app (Gmail of the Realtor, or Keymivo email via Resend).
alter table public.buyer_invites
  add column sent_at timestamptz,
  add column sent_to text,
  add column sent_via text check (sent_via in ('gmail','keymivo_email'));
