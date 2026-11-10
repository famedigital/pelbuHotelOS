-- Hotel OS v2 — StayView room blocks (OOO / OOS / hold).
-- Additive. Half-open date window [from_date, to_date).

CREATE TABLE IF NOT EXISTS v2.room_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES v2.rooms(id) ON DELETE CASCADE,
  block_kind text NOT NULL DEFAULT 'ooo'
    CHECK (block_kind = ANY (ARRAY['ooo', 'oos', 'hold'])),
  from_date date NOT NULL,
  to_date date NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  CHECK (to_date > from_date)
);

CREATE INDEX IF NOT EXISTS room_blocks_property_window
  ON v2.room_blocks (property_id, from_date, to_date);

CREATE INDEX IF NOT EXISTS room_blocks_room_active
  ON v2.room_blocks (room_id, released_at)
  WHERE released_at IS NULL;

-- Reject assigning a room onto an active block window
CREATE OR REPLACE FUNCTION v2.reject_assignment_over_room_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = v2, public
AS $$
BEGIN
  IF NEW.active IS TRUE AND EXISTS (
    SELECT 1
      FROM v2.room_blocks rb
     WHERE rb.room_id = NEW.room_id
       AND rb.released_at IS NULL
       AND rb.from_date <= NEW.stay_date
       AND NEW.stay_date < rb.to_date
  ) THEN
    RAISE EXCEPTION 'Room is blocked on %', NEW.stay_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS room_assignments_reject_blocks ON v2.room_assignments;
CREATE TRIGGER room_assignments_reject_blocks
  BEFORE INSERT OR UPDATE OF room_id, stay_date, active
  ON v2.room_assignments
  FOR EACH ROW EXECUTE FUNCTION v2.reject_assignment_over_room_block();
