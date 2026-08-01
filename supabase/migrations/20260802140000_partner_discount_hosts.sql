-- Partner visit discount + ensure host columns for white-label settings UI
alter table guides
  add column if not exists discount_pct numeric(5,2) not null default 0
    check (discount_pct >= 0 and discount_pct <= 100);

alter table drivers
  add column if not exists discount_pct numeric(5,2) not null default 0
    check (discount_pct >= 0 and discount_pct <= 100);

comment on column guides.discount_pct is
  'Suggested room discount % for returning guides (desk applies manually or via friends tier).';
comment on column drivers.discount_pct is
  'Suggested room discount % for returning drivers.';

alter table properties
  add column if not exists public_host text,
  add column if not exists desk_host text;

create unique index if not exists properties_public_host_uidx
  on properties (lower(public_host))
  where public_host is not null and length(trim(public_host)) > 0;

create unique index if not exists properties_desk_host_uidx
  on properties (lower(desk_host))
  where desk_host is not null and length(trim(desk_host)) > 0;
