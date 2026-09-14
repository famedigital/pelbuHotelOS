-- Host → property white-label foundation (Wave 4)

alter table properties
  add column if not exists public_host text,
  add column if not exists desk_host text;

create unique index if not exists properties_public_host_uidx
  on properties (lower(public_host))
  where public_host is not null;

create unique index if not exists properties_desk_host_uidx
  on properties (lower(desk_host))
  where desk_host is not null;

comment on column properties.public_host is
  'Hostname for public site (e.g. www.acme.bt). Resolved in middleware.';
comment on column properties.desk_host is
  'Hostname for desk ERP (e.g. desk.acme.bt).';
