-- Multi-year money history: archive cold settled folio lines + payments.
-- Live tables stay hot for desk UAT; archive tables keep property_id for tenant isolation.
-- Operators: select public.archive_settled_money_history('<property_uuid>', 36);

create table if not exists folio_line_archives (
  id uuid primary key,
  property_id uuid not null references properties(id) on delete cascade,
  folio_id uuid not null,
  booking_id uuid,
  source_type text not null,
  source_id uuid,
  description text not null,
  qty numeric(12,2) not null default 1,
  unit_price_btn numeric(12,2) not null default 0,
  amount_btn numeric(12,2) not null default 0,
  gst_applicable boolean not null default false,
  gst_btn numeric(12,2) not null default 0,
  total_btn numeric(12,2) not null default 0,
  status text not null,
  business_date date,
  created_at timestamptz not null,
  archived_at timestamptz not null default now(),
  archive_reason text not null default 'retention'
);

create index if not exists folio_line_archives_property_created_idx
  on folio_line_archives (property_id, created_at desc);

create table if not exists payment_archives (
  id uuid primary key,
  property_id uuid not null references properties(id) on delete cascade,
  folio_id uuid,
  booking_id uuid,
  method text,
  kind text,
  amount_btn numeric(12,2) not null default 0,
  confirmation_status text,
  created_at timestamptz not null,
  archived_at timestamptz not null default now(),
  archive_reason text not null default 'retention',
  payload jsonb not null default '{}'::jsonb
);

create index if not exists payment_archives_property_created_idx
  on payment_archives (property_id, created_at desc);

alter table folio_line_archives enable row level security;
alter table payment_archives enable row level security;

drop policy if exists "service_role full folio_line_archives" on folio_line_archives;
create policy "service_role full folio_line_archives" on folio_line_archives
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full payment_archives" on payment_archives;
create policy "service_role full payment_archives" on payment_archives
  for all to service_role using (true) with check (true);

create or replace function public.archive_settled_money_history(
  p_property_id uuid,
  p_older_than_months int default 36
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff date := (current_date - make_interval(months => greatest(p_older_than_months, 12)))::date;
  lines_moved int := 0;
  pays_moved int := 0;
begin
  if p_property_id is null then
    raise exception 'property_id required';
  end if;

  with candidates as (
    select fl.*
    from folio_lines fl
    join folios f on f.id = fl.folio_id
    where f.property_id = p_property_id
      and f.status in ('closed', 'settled')
      and coalesce(fl.business_date, (fl.created_at at time zone 'UTC')::date) < cutoff
  ),
  moved as (
    insert into folio_line_archives (
      id, property_id, folio_id, booking_id, source_type, source_id,
      description, qty, unit_price_btn, amount_btn, gst_applicable, gst_btn,
      total_btn, status, business_date, created_at
    )
    select
      c.id,
      p_property_id,
      c.folio_id,
      c.booking_id,
      c.source_type,
      c.source_id,
      c.description,
      c.qty,
      c.unit_price_btn,
      c.amount_btn,
      c.gst_applicable,
      c.gst_btn,
      c.total_btn,
      c.status,
      c.business_date,
      c.created_at
    from candidates c
    on conflict (id) do nothing
    returning id
  ),
  deleted as (
    delete from folio_lines fl
    using moved m
    where fl.id = m.id
    returning fl.id
  )
  select count(*)::int into lines_moved from deleted;

  with candidates as (
    select p.*
    from payments p
    left join folios f on f.id = p.folio_id
    where p.property_id = p_property_id
      and (p.created_at at time zone 'UTC')::date < cutoff
      and (
        p.folio_id is null
        or f.status in ('closed', 'settled')
      )
  ),
  moved as (
    insert into payment_archives (
      id, property_id, folio_id, booking_id, method, kind, amount_btn,
      confirmation_status, created_at, payload
    )
    select
      c.id,
      c.property_id,
      c.folio_id,
      c.booking_id,
      c.method,
      c.kind,
      c.amount_btn,
      c.confirmation_status,
      c.created_at,
      jsonb_build_object(
        'reference', c.reference,
        'notes', c.notes
      )
    from candidates c
    on conflict (id) do nothing
    returning id
  ),
  deleted as (
    delete from payments p
    using moved m
    where p.id = m.id
    returning p.id
  )
  select count(*)::int into pays_moved from deleted;

  return jsonb_build_object(
    'property_id', p_property_id,
    'cutoff', cutoff,
    'folio_lines_archived', lines_moved,
    'payments_archived', pays_moved
  );
end;
$$;

comment on function public.archive_settled_money_history(uuid, int) is
  'Move settled folio lines and payments older than N months into archive tables (tenant-scoped).';
