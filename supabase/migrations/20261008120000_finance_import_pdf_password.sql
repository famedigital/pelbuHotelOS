-- Short-lived PDF open password for a locked bank or receipt file.
-- Cleared when the parser finishes. Desk reads never return this column.

alter table finance_import_batches
  add column if not exists source_password text;
