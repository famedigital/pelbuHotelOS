-- Tab-level (screen) grants in desk_module_keys alongside module keys.
-- e.g. money = all Money screens; /erp/hr/payroll = Payroll only under Team.

comment on column staff_members.desk_module_keys is
  'Allowlist of ERP grants: module keys (dashboard, calendar, front-desk, rooms, pos, money, channels, team, inventory, hotel) and/or tab hrefs (/erp/hr/payroll). Module key = all tabs. NULL = inherit desk_role defaults. Empty with can_access_desk is rejected in app.';
