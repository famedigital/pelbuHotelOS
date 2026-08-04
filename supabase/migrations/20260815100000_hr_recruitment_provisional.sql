-- HR recruitment lifecycle: provisional staff → confirmed hire or terminate.
-- Desk uses status provisional on staff_members plus employment event audit.

alter table staff_members drop constraint if exists staff_members_status_check;
alter table staff_members
  add constraint staff_members_status_check
  check (status = any (array[
    'provisional'::text,
    'active'::text,
    'inactive'::text,
    'on_leave'::text,
    'suspended'::text,
    'terminated'::text
  ]));

comment on column staff_members.status is
  'Employment lifecycle: provisional (onboarding / probation offer) → active or terminated; also on_leave, suspended, inactive.';

alter table staff_employment_events drop constraint if exists staff_employment_events_event_type_check;
alter table staff_employment_events
  add constraint staff_employment_events_event_type_check
  check (event_type = any (array[
    'provisional'::text,
    'hire'::text,
    'confirmation'::text,
    'promotion'::text,
    'transfer'::text,
    'wage_change'::text,
    'suspension'::text,
    'reactivation'::text,
    'resignation'::text,
    'termination'::text,
    'note'::text
  ]));

create index if not exists staff_members_provisional_idx
  on staff_members (property_id, status, hired_on)
  where status = 'provisional';
