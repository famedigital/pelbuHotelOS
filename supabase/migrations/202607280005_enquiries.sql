-- Public contact / general enquiries
-- Applied remotely via Supabase MCP.

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  topic text not null check (topic = any (array[
    'general'::text,
    'rooms'::text,
    'dining'::text,
    'spa'::text,
    'meeting'::text,
    'agents'::text,
    'other'::text
  ])),
  contact_name text not null,
  contact_phone text not null,
  contact_email text,
  message text not null,
  status text not null default 'new' check (status = any (array[
    'new'::text,
    'in_progress'::text,
    'closed'::text
  ])),
  created_at timestamptz not null default now()
);

alter table enquiries enable row level security;

drop policy if exists "anon insert enquiries" on enquiries;
create policy "anon insert enquiries" on enquiries
  for insert to anon, authenticated
  with check (status = 'new');
