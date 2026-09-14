-- Cover HR foreign keys used by deletes, joins, and property-scoped feeds.
create index if not exists staff_members_auth_user_idx
  on staff_members (auth_user_id)
  where auth_user_id is not null;

create index if not exists staff_leave_reviewer_idx
  on staff_leave (reviewed_by_staff_id)
  where reviewed_by_staff_id is not null;

create index if not exists hr_announcements_work_order_idx
  on hr_announcements (work_order_id)
  where work_order_id is not null;

create index if not exists hr_announcements_revision_idx
  on hr_announcements (revision_of_id)
  where revision_of_id is not null;

create index if not exists hr_announcements_creator_idx
  on hr_announcements (created_by_staff_id)
  where created_by_staff_id is not null;

create index if not exists hr_announcement_recipients_staff_fk_idx
  on hr_announcement_recipients (staff_id);

create index if not exists hr_notification_outbox_property_idx
  on hr_notification_outbox (property_id, created_at desc);

create index if not exists hr_notification_outbox_staff_idx
  on hr_notification_outbox (staff_id)
  where staff_id is not null;

create index if not exists hr_notification_outbox_announcement_idx
  on hr_notification_outbox (announcement_id)
  where announcement_id is not null;

create index if not exists hr_push_subscriptions_staff_fk_idx
  on hr_push_subscriptions (staff_id);
