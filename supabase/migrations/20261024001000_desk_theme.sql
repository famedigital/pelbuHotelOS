-- Per-hotel desk skin. Dzong is the default. Status colors are not stored here.

alter table public.properties
  add column if not exists desk_theme text not null default 'dzong';

alter table public.properties
  drop constraint if exists properties_desk_theme_check;

alter table public.properties
  add constraint properties_desk_theme_check
  check (desk_theme in ('dzong', 'brass', 'dusk', 'cedar'));
