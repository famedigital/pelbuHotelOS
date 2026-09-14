-- Public header logo layout: size + vertical hang relative to the nav rail.
alter table public.properties
  add column if not exists logo_nav_size_rem numeric(4, 2) not null default 6.50,
  add column if not exists logo_nav_offset_pct numeric(4, 1) not null default 42.0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_logo_nav_size_rem_check'
  ) then
    alter table public.properties
      add constraint properties_logo_nav_size_rem_check
      check (logo_nav_size_rem >= 4 and logo_nav_size_rem <= 12);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_logo_nav_offset_pct_check'
  ) then
    alter table public.properties
      add constraint properties_logo_nav_offset_pct_check
      check (logo_nav_offset_pct >= 20 and logo_nav_offset_pct <= 70);
  end if;
end $$;

comment on column public.properties.logo_nav_size_rem is
  'Public site header logo height/width in rem (desktop mark). Guest-facing BrandLockup.';
comment on column public.properties.logo_nav_offset_pct is
  'Vertical translation percent for hanging logo (translateY). Higher = hangs lower under the rail.';
