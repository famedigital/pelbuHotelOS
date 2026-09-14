-- Guest CRM lite: blacklist + notes on booking_guests (Wave 3d)

alter table booking_guests
  add column if not exists blacklisted boolean not null default false,
  add column if not exists blacklist_reason text,
  add column if not exists desk_notes text;

create index if not exists booking_guests_blacklisted_idx
  on booking_guests (blacklisted)
  where blacklisted = true;
