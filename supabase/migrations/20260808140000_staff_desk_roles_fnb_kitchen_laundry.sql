-- Expand desk RBAC for department-home dashboards (F&B, kitchen, laundry).
alter table staff_members drop constraint if exists staff_members_desk_role_check;

alter table staff_members
  add constraint staff_members_desk_role_check
  check (
    desk_role is null
    or desk_role = any (
      array[
        'front_desk'::text,
        'cashier'::text,
        'gm'::text,
        'hk'::text,
        'owner'::text,
        'fnb'::text,
        'kitchen'::text,
        'laundry'::text
      ]
    )
  );

comment on column staff_members.desk_role is
  'ERP desk RBAC: front_desk | cashier | gm | hk | owner | fnb | kitchen | laundry. Null falls back to department / access_level mapping.';
