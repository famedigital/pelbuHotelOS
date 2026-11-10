-- Hotel Hermes Wave 1 — Telegram pairing + guest doc OCR drafts.

CREATE TABLE IF NOT EXISTS v2.telegram_pair_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'fo'
    CHECK (role IN ('fo', 'manager', 'hk', 'kitchen')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_chat_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_pair_tokens_property_idx
  ON v2.telegram_pair_tokens (property_id);

CREATE TABLE IF NOT EXISTS v2.telegram_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties (id) ON DELETE CASCADE,
  chat_id bigint NOT NULL,
  chat_type text NOT NULL DEFAULT 'private'
    CHECK (chat_type IN ('private', 'group', 'supergroup')),
  role text NOT NULL DEFAULT 'fo'
    CHECK (role IN ('fo', 'manager', 'hk', 'kitchen')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'revoked')),
  display_name text,
  tg_username text,
  paired_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_seen_at timestamptz,
  UNIQUE (property_id, chat_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_chats_active_chat_uidx
  ON v2.telegram_chats (chat_id)
  WHERE status <> 'revoked';

CREATE INDEX IF NOT EXISTS telegram_chats_property_status_idx
  ON v2.telegram_chats (property_id, status);

CREATE TABLE IF NOT EXISTS v2.telegram_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties (id) ON DELETE CASCADE,
  chat_id bigint,
  direction text NOT NULL DEFAULT 'in'
    CHECK (direction IN ('in', 'out', 'system')),
  intent text NOT NULL DEFAULT 'unknown',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_events_property_created_idx
  ON v2.telegram_events (property_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v2.telegram_doc_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('passport', 'sdf')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'discarded')),
  ocr jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_ref text,
  suggested_stay_id uuid,
  applied_stay_id uuid,
  created_by_chat_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);

CREATE INDEX IF NOT EXISTS telegram_doc_drafts_property_status_idx
  ON v2.telegram_doc_drafts (property_id, status, created_at DESC);

COMMENT ON TABLE v2.telegram_doc_drafts IS 'Hermes Wave 1 passport/SDF OCR drafts pending Guests & Docs apply';
