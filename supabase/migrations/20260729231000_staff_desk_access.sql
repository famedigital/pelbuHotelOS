-- Additive Work dual-auth flag: staff who may open /erp after code+PIN login.
-- Shared DESK_PIN remains valid; this does not retire the desk cookie.

alter table staff_members
  add column if not exists can_access_desk boolean not null default false;

comment on column staff_members.can_access_desk is
  'When true, an active staff Auth session may open Pelbu Work (/erp). Shared DESK_PIN remains an alternate gate.';

-- Owners already operate the desk; enable for them only. Other roles stay
-- explicit opt-in from HR so front-line staff do not suddenly get ERP access.
update staff_members
set can_access_desk = true
where access_level = 'owner'
  and can_login = true
  and status in ('active', 'on_leave');
