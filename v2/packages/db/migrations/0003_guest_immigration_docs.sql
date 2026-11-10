-- Guest immigration / RBP document fields for tourist manifest export.
ALTER TABLE v2.guests
  ADD COLUMN IF NOT EXISTS passport_or_cid text,
  ADD COLUMN IF NOT EXISTS visa_stamp text,
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'passport';

COMMENT ON COLUMN v2.guests.passport_or_cid IS 'Passport number or Bhutan CID';
COMMENT ON COLUMN v2.guests.visa_stamp IS 'Visa / entry stamp reference';
COMMENT ON COLUMN v2.guests.document_type IS 'passport | cid | other';
