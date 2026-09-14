-- Desk RBAC roles for ERP money / FO gates (Wave 1d)

alter table staff_members
  add column if not exists desk_role text
    check (
      desk_role is null
      or desk_role = any (
        array[
          'front_desk'::text,
          'cashier'::text,
          'gm'::text,
          'hk'::text,
          'owner'::text
        ]
      )
    );

comment on column staff_members.desk_role is
  'ERP desk RBAC: front_desk | cashier | gm | hk | owner. Null falls back to access_level mapping.';

update staff_members
set desk_role = case
  when access_level = 'owner' then 'owner'
  when access_level in ('hr_admin', 'supervisor') then 'gm'
  when can_access_desk then 'front_desk'
  else desk_role
end
where desk_role is null and can_access_desk = true;
