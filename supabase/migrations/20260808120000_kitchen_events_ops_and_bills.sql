-- Banquet / group kitchen events: venue, contact, timespan, commercial bill fields + folio link.
alter table kitchen_events
  add column if not exists service_end time,
  add column if not exists venue text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists status text not null default 'planned',
  add column if not exists rate_per_pax_btn numeric(12, 2),
  add column if not exists package_total_btn numeric(12, 2),
  add column if not exists deposit_btn numeric(12, 2) not null default 0,
  add column if not exists billing_status text not null default 'none',
  add column if not exists bill_note text,
  add column if not exists folio_id uuid references folios (id) on delete set null,
  add column if not exists booking_id uuid references bookings (id) on delete set null,
  add column if not exists posted_folio_line_id uuid,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'kitchen_events_status_check'
  ) then
    alter table kitchen_events
      add constraint kitchen_events_status_check
      check (status = any (array[
        'planned'::text, 'confirmed'::text, 'served'::text, 'cancelled'::text
      ]));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'kitchen_events_billing_status_check'
  ) then
    alter table kitchen_events
      add constraint kitchen_events_billing_status_check
      check (billing_status = any (array[
        'none'::text,
        'quoted'::text,
        'confirmed'::text,
        'posted'::text,
        'paid'::text,
        'comp'::text
      ]));
  end if;
end $$;

create index if not exists kitchen_events_folio_idx
  on kitchen_events (folio_id)
  where folio_id is not null;
