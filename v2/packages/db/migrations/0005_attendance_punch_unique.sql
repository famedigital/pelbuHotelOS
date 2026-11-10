-- Dedup ADMS punches by property + staff PIN + punch time (device may resend).
CREATE UNIQUE INDEX IF NOT EXISTS attendance_punches_pin_time_uidx
  ON v2.attendance_punches (property_id, employee_code, punched_at);
