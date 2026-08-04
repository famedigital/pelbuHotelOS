-- TCB tour-operator directory: bookable agents without credit/portal/B2B nets.
-- Directory rows are searchable A–Z on desk; credit stays approved/demo only.

alter table agents drop constraint if exists agents_status_check;
alter table agents
  add constraint agents_status_check
  check (status in ('pending', 'approved', 'rejected', 'demo', 'directory'));

comment on column agents.status is
  'pending = application; approved = trade partner (credit/portal when enabled); rejected; demo; directory = TCB/public listing (bookable, credit_limit 0, no portal).';

-- FO pickers load ~800 directory rows A–Z.
create index if not exists agents_status_company_name_idx
  on agents (status, company_name);

-- Soft identity for idempotent TCB re-import (match on email or company).
create index if not exists agents_contact_email_lower_idx
  on agents (lower(trim(contact_email)))
  where contact_email is not null and trim(contact_email) <> '';

create index if not exists agents_company_name_lower_idx
  on agents (lower(trim(company_name)));
