-- Remaining direct FK indexes (the property-first feed indexes do not cover
-- deletes by the referenced key). Remove one redundant auth lookup index.
drop index if exists staff_members_auth_user_idx;

create index if not exists staff_members_manager_fk_idx
  on staff_members (manager_id)
  where manager_id is not null;

create index if not exists staff_employment_events_staff_fk_idx
  on staff_employment_events (staff_id);

create index if not exists staff_leave_staff_fk_idx
  on staff_leave (staff_id);
