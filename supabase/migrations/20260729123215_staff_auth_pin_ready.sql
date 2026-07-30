-- Staff portal login readiness: track PIN provisioning and last login.
-- Actual PIN hashes live in auth.users via Supabase Auth (never in public tables).

alter table staff_members
  add column if not exists can_login boolean not null default false,
  add column if not exists pin_set_at timestamptz,
  add column if not exists last_login_at timestamptz;

create index if not exists staff_members_login_idx
  on staff_members (property_id, employee_code)
  where can_login = true and status in ('active', 'on_leave');
