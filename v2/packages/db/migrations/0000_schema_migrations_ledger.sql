-- Migration ledger for clean Hotel OS v2 (ADR 001).
CREATE SCHEMA IF NOT EXISTS v2;

CREATE TABLE IF NOT EXISTS v2.schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum text
);

COMMENT ON TABLE v2.schema_migrations IS 'Applied files under v2/packages/db/migrations';
