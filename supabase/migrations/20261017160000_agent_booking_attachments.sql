-- Partner portal: payment proofs / attachments on own bookings.

create table if not exists public.agent_booking_attachments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind text not null
    check (kind = any (array['payment_proof'::text, 'other'::text])),
  doc_url text not null,
  doc_name text,
  notes text,
  uploaded_by text not null default 'agent',
  created_at timestamptz not null default now()
);

create index if not exists agent_booking_attachments_agent_idx
  on public.agent_booking_attachments (agent_id, created_at desc);

create index if not exists agent_booking_attachments_booking_idx
  on public.agent_booking_attachments (booking_id, created_at desc);

alter table public.agent_booking_attachments enable row level security;

drop policy if exists "service_role full agent_booking_attachments"
  on public.agent_booking_attachments;
create policy "service_role full agent_booking_attachments"
  on public.agent_booking_attachments
  for all to service_role using (true) with check (true);

drop policy if exists "agent portal select own booking attachments"
  on public.agent_booking_attachments;
create policy "agent portal select own booking attachments"
  on public.agent_booking_attachments
  for select to authenticated
  using (agent_id = (select private.current_agent_id()));

drop policy if exists "agent portal insert own booking attachments"
  on public.agent_booking_attachments;
create policy "agent portal insert own booking attachments"
  on public.agent_booking_attachments
  for insert to authenticated
  with check (
    agent_id = (select private.current_agent_id())
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and b.agent_id = (select private.current_agent_id())
        and b.property_id = property_id
    )
  );

comment on table public.agent_booking_attachments is
  'Partner-uploaded payment screenshots and stay docs; scoped to own bookings.';
