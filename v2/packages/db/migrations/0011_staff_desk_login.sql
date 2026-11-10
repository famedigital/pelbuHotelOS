-- Desk PIN Gateway: which staff appear on the lock screen + home route hint.

ALTER TABLE v2.staff
  ADD COLUMN IF NOT EXISTS can_login boolean NOT NULL DEFAULT false;

ALTER TABLE v2.staff
  ADD COLUMN IF NOT EXISTS desk_role text;

ALTER TABLE v2.staff
  ADD COLUMN IF NOT EXISTS home_route text NOT NULL DEFAULT '/desk';

ALTER TABLE v2.staff
  ADD COLUMN IF NOT EXISTS pin_set_at timestamptz;

CREATE INDEX IF NOT EXISTS staff_property_login_idx
  ON v2.staff (property_id)
  WHERE active AND can_login;

COMMENT ON COLUMN v2.staff.pin_reset_required IS
  'True after cutover until staff sets a v2 PIN (v1 Auth passwords are not portable).';
