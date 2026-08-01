-- Expand staff_shifts.outlet CHECK to match rota UI (maintenance, security, admin).
-- Fixes "Could not add shift" when scheduling non-F&B outlets.

alter table staff_shifts
  drop constraint if exists staff_shifts_outlet_check;

alter table staff_shifts
  add constraint staff_shifts_outlet_check
  check (outlet is null or outlet = any (array[
    'front_desk'::text,
    'cafe'::text,
    'pastry'::text,
    'restaurant'::text,
    'bar'::text,
    'spa'::text,
    'housekeeping'::text,
    'maintenance'::text,
    'security'::text,
    'admin'::text,
    'other'::text
  ]));
