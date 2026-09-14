-- Single occupancy room-night amount beside existing double (amount_btn).

alter table public.room_rates
  add column if not exists amount_single_btn numeric(12, 2)
  check (amount_single_btn is null or amount_single_btn >= 0);

comment on column public.room_rates.amount_btn is
  'Double occupancy (2 adults) room-only night rate in BTN. Historical default column.';

comment on column public.room_rates.amount_single_btn is
  'Single occupancy (1 adult) room-only night in BTN. Null = not set (desk falls back to double for quotes).';
