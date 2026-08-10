-- Human-facing stay confirmation numbers (not tax invoices).
-- Format: PS-YYYY-##### via property sequence booking_conf:YYYY (Thimphu year).

alter table public.bookings
  add column if not exists confirmation_code text;

comment on column public.bookings.confirmation_code is
  'Stay confirmation for FO search and guest/agent documents (PS-YYYY-#####). Not a tax invoice — those are fiscal_documents INV-/RCP-/CN-.';

create unique index if not exists bookings_property_confirmation_code_uidx
  on public.bookings (property_id, confirmation_code)
  where confirmation_code is not null;

create index if not exists bookings_property_confirmation_code_trgm_idx
  on public.bookings (property_id, confirmation_code);

create or replace function public.bookings_assign_confirmation_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text;
  v_seq bigint;
begin
  if NEW.confirmation_code is not null
     and btrim(NEW.confirmation_code) <> '' then
    return NEW;
  end if;

  v_year := to_char(
    timezone('Asia/Thimphu', coalesce(NEW.created_at, now())),
    'YYYY'
  );
  v_seq := next_property_sequence(
    NEW.property_id,
    'booking_conf:' || v_year
  );
  NEW.confirmation_code :=
    'PS-' || v_year || '-' || lpad(v_seq::text, 5, '0');
  return NEW;
end;
$$;

drop trigger if exists bookings_confirmation_code_bi on public.bookings;
create trigger bookings_confirmation_code_bi
  before insert on public.bookings
  for each row
  execute function public.bookings_assign_confirmation_code();

-- Backfill existing stays in create order so numbers stay chronological per year.
do $$
declare
  r record;
  v_year text;
  v_seq bigint;
begin
  for r in
    select id, property_id, created_at
    from public.bookings
    where confirmation_code is null
    order by created_at nulls first, id
  loop
    v_year := to_char(
      timezone('Asia/Thimphu', coalesce(r.created_at, now())),
      'YYYY'
    );
    v_seq := next_property_sequence(
      r.property_id,
      'booking_conf:' || v_year
    );
    update public.bookings
      set confirmation_code =
        'PS-' || v_year || '-' || lpad(v_seq::text, 5, '0')
      where id = r.id;
  end loop;
end $$;
