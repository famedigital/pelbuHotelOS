-- Central rate book: several labeled prices for the same agent or guest.
-- Shared matrix rows stay label = Standard with no party.
-- New stays: HotelBK booking, HotelFN folio. Existing PS- numbers are left as-is.

alter table public.properties
  add column if not exists doc_prefix text;

update public.properties
set doc_prefix = 'PS'
where slug in ('pelbu-suites-olakha', 'pelbu-olakha')
  and coalesce(btrim(doc_prefix), '') = '';

update public.properties
set doc_prefix = 'Demo'
where slug = 'demo-hotel'
  and coalesce(btrim(doc_prefix), '') = '';

create or replace function public.property_doc_prefix(p_property_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(regexp_replace(btrim(doc_prefix), '[^A-Za-z0-9]', '', 'g'), ''),
    nullif(
      regexp_replace(split_part(btrim(name), ' ', 1), '[^A-Za-z0-9]', '', 'g'),
      ''
    ),
    'Hotel'
  )
  from public.properties
  where id = p_property_id;
$$;

alter table public.room_rates
  add column if not exists label text not null default 'Standard',
  add column if not exists agent_id uuid references public.agents (id) on delete cascade,
  add column if not exists guest_label text,
  add column if not exists active boolean not null default true;

update public.room_rates
set label = 'Standard'
where coalesce(btrim(label), '') = '';

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'room_rates'
      and con.contype = 'u'
  loop
    execute format('alter table public.room_rates drop constraint %I', r.conname);
  end loop;
end $$;

create unique index if not exists room_rates_offer_uidx
  on public.room_rates (
    property_id,
    room_type_id,
    season_kind,
    rate_tier,
    coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(lower(btrim(guest_label)), ''),
    lower(btrim(label))
  );

create index if not exists room_rates_agent_idx
  on public.room_rates (property_id, agent_id)
  where agent_id is not null;

comment on column public.room_rates.label is
  'Offer name. Standard is the shared tier cell. Contract and Fill-up can sit beside it for one agent.';
comment on column public.room_rates.guest_label is
  'Named guest this offer belongs to. Null means the tier or the agent, not one person.';

alter table public.bookings
  add column if not exists room_rate_id uuid references public.room_rates (id) on delete set null;

alter table public.booking_rooms
  add column if not exists room_rate_id uuid references public.room_rates (id) on delete set null;

comment on column public.bookings.room_rate_id is
  'Central rate row chosen for this stay. agreed_nightly_rate_btn is the amount copied at selection.';

alter table public.folios
  add column if not exists doc_no text;

create unique index if not exists folios_property_doc_no_uidx
  on public.folios (property_id, doc_no)
  where doc_no is not null;

create or replace function public.folios_assign_doc_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
  v_prefix text;
begin
  if NEW.doc_no is not null and btrim(NEW.doc_no) <> '' then
    return NEW;
  end if;
  v_prefix := public.property_doc_prefix(NEW.property_id);
  v_seq := public.next_property_sequence(NEW.property_id, 'folio_fn:' || to_char(timezone('Asia/Thimphu', coalesce(NEW.created_at, now())), 'YYYY'));
  NEW.doc_no := v_prefix || 'FN-' || to_char(timezone('Asia/Thimphu', coalesce(NEW.created_at, now())), 'YYYY') || '-' || lpad(v_seq::text, 5, '0');
  return NEW;
end;
$$;

drop trigger if exists folios_doc_no_bi on public.folios;
create trigger folios_doc_no_bi
  before insert on public.folios
  for each row
  execute function public.folios_assign_doc_no();

create or replace function public.bookings_assign_confirmation_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
  v_prefix text;
begin
  if NEW.confirmation_code is not null
     and btrim(NEW.confirmation_code) <> '' then
    return NEW;
  end if;

  v_prefix := public.property_doc_prefix(NEW.property_id);
  v_seq := public.next_property_sequence(NEW.property_id, 'booking_bk:' || to_char(timezone('Asia/Thimphu', coalesce(NEW.created_at, now())), 'YYYY'));
  NEW.confirmation_code := v_prefix || 'BK-' || to_char(timezone('Asia/Thimphu', coalesce(NEW.created_at, now())), 'YYYY') || '-' || lpad(v_seq::text, 5, '0');
  return NEW;
end;
$$;

comment on column public.bookings.confirmation_code is
  'Stay booking number (HotelBK#). Older stays may still be PS-YYYY-#####. Not a tax invoice.';
