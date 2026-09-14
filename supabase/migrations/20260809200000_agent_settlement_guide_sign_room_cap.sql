-- Agent settlement evidence + room capacity commercial controls
-- Guide sign (photo/file) unlocks guest leave; seal/email is FO post-work.
-- open_room_cap is primary agent throttle (not Nu-only credit).

alter table public.agents
  add column if not exists open_room_cap integer not null default 15;

comment on column public.agents.open_room_cap is
  'Max concurrent in-house guest rooms for this agent before next CI is blocked (FO override logged).';

alter table public.bookings
  add column if not exists guide_sign_status text,
  add column if not exists guide_signed_at timestamptz,
  add column if not exists guide_signed_by_staff_id uuid references public.staff_members(id) on delete set null,
  add column if not exists guide_sign_photo_public_id text,
  add column if not exists guide_sign_waive_reason text,
  add column if not exists confirm_mode text not null default 'soft',
  add column if not exists advance_due_btn numeric(12,2),
  add column if not exists advance_status text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_guide_sign_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_guide_sign_status_check
      check (guide_sign_status is null or guide_sign_status in ('photo', 'waived'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_confirm_mode_check'
  ) then
    alter table public.bookings
      add constraint bookings_confirm_mode_check
      check (confirm_mode in ('soft', 'advance_requested', 'secured', 'on_account'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_advance_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_advance_status_check
      check (advance_status in ('none', 'requested', 'received', 'waived'));
  end if;
end $$;

comment on column public.bookings.guide_sign_status is
  'Agent stays: photo = guide signed pack on file; waived = FO override; null = not required or pending.';
comment on column public.bookings.confirm_mode is
  'soft | advance_requested | secured | on_account — commercial promise, not hard gate by default.';

create table if not exists public.booking_settlement_packs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  sealed_at timestamptz not null default now(),
  sealed_by_staff_id uuid references public.staff_members(id) on delete set null,
  totals_json jsonb not null default '{}'::jsonb,
  guide_photo_public_id text,
  guide_sign_status text,
  email_sent_at timestamptz,
  email_to text,
  email_error text,
  created_at timestamptz not null default now()
);

create index if not exists booking_settlement_packs_booking_idx
  on public.booking_settlement_packs (booking_id, sealed_at desc);
create index if not exists booking_settlement_packs_agent_idx
  on public.booking_settlement_packs (agent_id, sealed_at desc)
  where agent_id is not null;
create index if not exists booking_settlement_packs_property_idx
  on public.booking_settlement_packs (property_id, sealed_at desc);

alter table public.booking_settlement_packs enable row level security;

drop policy if exists booking_settlement_packs_deny_anon on public.booking_settlement_packs;
create policy booking_settlement_packs_deny_anon
  on public.booking_settlement_packs
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.booking_settlement_packs is
  'Sealed agent settlement packs (totals snapshot + guide evidence). FO emails after guest leave.';
