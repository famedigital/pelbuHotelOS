-- Public header: gap between logo mark and hotel name.
alter table public.properties
  add column if not exists logo_nav_gap_rem numeric(4, 2) not null default 0.75;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_logo_nav_gap_rem_check'
  ) then
    alter table public.properties
      add constraint properties_logo_nav_gap_rem_check
      check (logo_nav_gap_rem >= 0 and logo_nav_gap_rem <= 3);
  end if;
end $$;

comment on column public.properties.logo_nav_gap_rem is
  'Space between public header logo mark and hotel name (rem). Guest-facing BrandLockup.';
