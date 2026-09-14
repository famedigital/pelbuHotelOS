-- 202607290022_partners.sql
-- Master per-property tables for guides and drivers, so the property can count
-- visits, recognize repeat partners, and (later) grant perks.
-- Backfilled from existing bookings.guide_number and booking_drivers rows.

-- Master guides (per property) ----------------------------------------------
create table if not exists guides (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id) on delete cascade,
  guide_number text not null,
  full_name    text,
  phone        text,
  notes        text,
  visit_count  integer not null default 0,
  last_seen_at date,
  created_at   timestamptz not null default now(),
  unique (property_id, guide_number)
);
create index if not exists guides_property_idx on guides(property_id);
alter table guides enable row level security;
-- Desk-only access: server actions use the service role, which bypasses RLS.
-- No policies = no anon/authenticated access.

-- Master drivers (per property) ---------------------------------------------
create table if not exists drivers (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id) on delete cascade,
  full_name    text,
  phone        text,
  vehicle_no   text,
  license_no   text,
  notes        text,
  visit_count  integer not null default 0,
  last_seen_at date,
  created_at   timestamptz not null default now()
);
create index if not exists drivers_property_idx on drivers(property_id);
create index if not exists drivers_phone_idx on drivers(property_id, phone);
create unique index if not exists drivers_property_phone_uniq
  on drivers(property_id, phone) where phone is not null;
alter table drivers enable row level security;

-- Link bookings → master rows (nullable; keeps old free-text fields intact) -
alter table bookings
  add column if not exists guide_id uuid references guides(id) on delete set null,
  add column if not exists driver_id uuid references drivers(id) on delete set null;
create index if not exists bookings_guide_id_idx on bookings(guide_id);
create index if not exists bookings_driver_id_idx on bookings(driver_id);

-- Backfill master guides from existing distinct guide_number values ---------
insert into guides (property_id, guide_number, visit_count, last_seen_at)
select b.property_id, b.guide_number,
       count(*)::int,
       max(b.check_in)::date
from bookings b
where b.guide_number is not null and b.guide_number <> ''
  and not exists (
    select 1 from guides g
    where g.property_id = b.property_id and g.guide_number = b.guide_number
  )
group by b.property_id, b.guide_number;

-- Link bookings back to the master guide rows just created ------------------
update bookings b
  set guide_id = g.id
from guides g
where g.property_id = b.property_id
  and g.guide_number = b.guide_number
  and b.guide_number is not null and b.guide_number <> ''
  and b.guide_id is null;

-- Backfill master drivers from existing booking_drivers ---------------------
-- De-duped by phone where present; one row per missing-phone entry otherwise.
insert into drivers (property_id, full_name, phone, vehicle_no, license_no, visit_count, last_seen_at)
select b.property_id,
       max(d.full_name),
       d.phone,
       max(d.vehicle_no),
       max(d.license_no),
       count(distinct b.id)::int,
       max(b.check_in)::date
from booking_drivers d
join bookings b on b.id = d.booking_id
where d.phone is not null and d.phone <> ''
group by b.property_id, d.phone
on conflict do nothing;

insert into drivers (property_id, full_name, phone, vehicle_no, license_no, visit_count, last_seen_at)
select b.property_id, d.full_name, d.phone, d.vehicle_no, d.license_no, 1, b.check_in::date
from booking_drivers d
join bookings b on b.id = d.booking_id
where (d.phone is null or d.phone = '')
on conflict do nothing;

-- Link bookings → master driver rows by phone (fallback to vehicle_no) ------
update bookings b
  set driver_id = drv.id
from drivers drv
where drv.property_id = b.property_id
  and b.driver_id is null
  and exists (
    select 1 from booking_drivers d
    where d.booking_id = b.id
      and ((drv.phone is not null and d.phone = drv.phone)
           or (drv.phone is null and d.vehicle_no is not null and d.vehicle_no = drv.vehicle_no))
  );
