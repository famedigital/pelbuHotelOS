-- Spa / meeting / steam public requests
-- Applied remotely via Supabase MCP.

create table if not exists service_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  kind text not null check (kind = any (array['spa'::text,'meeting'::text,'steam'::text])),
  contact_name text not null,
  contact_phone text not null,
  contact_email text,
  preferred_on date not null,
  preferred_time text,
  party_size int not null default 1 check (party_size > 0 and party_size <= 40),
  duration_hours numeric(4,1),
  package_name text,
  charge_to_room boolean not null default false,
  room_or_booking_ref text,
  notes text,
  status text not null default 'pending' check (status = any (array[
    'pending'::text,
    'confirmed'::text,
    'completed'::text,
    'cancelled'::text
  ])),
  created_at timestamptz not null default now()
);

alter table service_requests enable row level security;

drop policy if exists "anon insert service_requests" on service_requests;
create policy "anon insert service_requests" on service_requests
  for insert to anon, authenticated
  with check (status = 'pending');
