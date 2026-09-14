-- Marketing CRM lite + email send log + campaign Meta tracking fields.
-- Service-role desk pattern (matches marketing_campaigns / promo_codes).

-- ---------------------------------------------------------------------------
-- Campaign Meta / social ROI notes (no Graph App Review required)
-- ---------------------------------------------------------------------------
alter table marketing_campaigns
  add column if not exists meta_post_url text,
  add column if not exists ig_handle text,
  add column if not exists meta_posted_at timestamptz,
  add column if not exists meta_post_notes text;

comment on column marketing_campaigns.meta_post_url is
  'Manual Facebook/IG post URL for ROI tracking (share hub does not auto-post without App Review tokens).';
comment on column marketing_campaigns.ig_handle is
  'Instagram handle @… for campaign / influencer tracking.';

-- ---------------------------------------------------------------------------
-- Contacts (CRM lite)
-- ---------------------------------------------------------------------------
create table if not exists marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  whatsapp text,
  contact_type text not null default 'other'
    check (contact_type = any (array[
      'guest'::text,
      'agent'::text,
      'influencer'::text,
      'media'::text,
      'other'::text
    ])),
  tags text[] not null default array[]::text[],
  notes text,
  source text,
  last_touched_at timestamptz not null default now(),
  campaign_id uuid references marketing_campaigns (id) on delete set null,
  agent_id uuid references agents (id) on delete set null,
  last_redemption_id uuid references promo_redemptions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_contacts_property_idx
  on marketing_contacts (property_id, last_touched_at desc);

create index if not exists marketing_contacts_property_email_idx
  on marketing_contacts (property_id, lower(email))
  where email is not null;

create index if not exists marketing_contacts_property_type_idx
  on marketing_contacts (property_id, contact_type);

create index if not exists marketing_contacts_tags_gin
  on marketing_contacts using gin (tags);

alter table marketing_contacts enable row level security;

drop policy if exists marketing_contacts_service_role on marketing_contacts;
create policy marketing_contacts_service_role
  on marketing_contacts
  for all
  to service_role
  using (true)
  with check (true);

comment on table marketing_contacts is
  'Property-scoped marketing CRM contacts (influencers, media, free email list). Optional agent link; guests stay free-form.';

-- ---------------------------------------------------------------------------
-- Email broadcast send log
-- ---------------------------------------------------------------------------
create table if not exists marketing_email_sends (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  contact_id uuid references marketing_contacts (id) on delete set null,
  campaign_id uuid references marketing_campaigns (id) on delete set null,
  to_email text not null,
  subject text not null,
  body_text text not null default '',
  body_html text,
  status text not null default 'pending'
    check (status = any (array[
      'pending'::text,
      'sent'::text,
      'failed'::text,
      'skipped'::text
    ])),
  resend_id text,
  error text,
  created_at timestamptz not null default now(),
  created_by text not null default 'desk'
);

create index if not exists marketing_email_sends_property_day_idx
  on marketing_email_sends (property_id, created_at desc);

create index if not exists marketing_email_sends_campaign_idx
  on marketing_email_sends (campaign_id, created_at desc)
  where campaign_id is not null;

alter table marketing_email_sends enable row level security;

drop policy if exists marketing_email_sends_service_role on marketing_email_sends;
create policy marketing_email_sends_service_role
  on marketing_email_sends
  for all
  to service_role
  using (true)
  with check (true);

comment on table marketing_email_sends is
  'One-shot marketing broadcast log (Resend). Max batch enforced in app (owner/GM only).';
