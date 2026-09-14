-- Agent login readiness: a short login code + Supabase Auth identity so approved
-- agents can sign into the Work app (/agents/app). Portal token remains a
-- fallback invite. Mirrors the staff PIN pattern; PINs live only in Auth.

alter table agents
  add column if not exists login_code text,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists can_login boolean not null default false,
  add column if not exists pin_set_at timestamptz,
  add column if not exists last_login_at timestamptz;

create unique index if not exists agents_login_code_uidx
  on agents (login_code)
  where login_code is not null;

comment on column agents.login_code is
  'Human-entered agent login code (e.g. AG-0007). Unique when set.';
comment on column agents.can_login is
  'When true, an approved/demo agent may sign into /agents/app with code + PIN.';
