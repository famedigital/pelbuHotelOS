-- Per-staff ERP module allowlist for desk nav (GM/Owner assigns under HR).
-- NULL = inherit role defaults in app; non-null array = explicit grants.

alter table staff_members
  add column if not exists desk_module_keys text[];

comment on column staff_members.desk_module_keys is
  'Allowlist of ERP_MODULES keys (dashboard, calendar, front-desk, rooms, pos, money, channels, team, inventory, hotel). NULL = inherit desk_role defaults. Empty with can_access_desk is rejected in app.';
