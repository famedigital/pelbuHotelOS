-- Optional property policy: when true, non-management staff may use /erp
-- only during a published staff_shifts window (Thimphu wall clock).
-- Default false preserves free desk access for any staff with can_access_desk.

alter table public.property_policies
  add column if not exists desk_restrict_to_scheduled_shifts boolean not null default false;

comment on column public.property_policies.desk_restrict_to_scheduled_shifts is
  'When true, staff without Owner/GM (or access_level owner/manager) may open hotel desk (/erp) only while a published staff_shifts row covers now in the property timezone (Asia/Thimphu). When false (default), any staff with can_login + can_access_desk may use /erp any time. Shared DESK_PIN and management always bypass. Does not use POS cashier shifts.';
