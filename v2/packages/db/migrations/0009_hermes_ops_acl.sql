-- Hermes ops: roles, staff links, forum topics, agent MoU mirror.

ALTER TABLE v2.telegram_pair_tokens
  DROP CONSTRAINT IF EXISTS telegram_pair_tokens_role_check;

ALTER TABLE v2.telegram_pair_tokens
  ADD CONSTRAINT telegram_pair_tokens_role_check
  CHECK (role IN ('fo', 'manager', 'hk', 'kitchen', 'gm', 'agent'));

ALTER TABLE v2.telegram_pair_tokens
  ADD COLUMN IF NOT EXISTS agent_id text;

ALTER TABLE v2.telegram_chats
  DROP CONSTRAINT IF EXISTS telegram_chats_role_check;

ALTER TABLE v2.telegram_chats
  ADD CONSTRAINT telegram_chats_role_check
  CHECK (role IN ('fo', 'manager', 'hk', 'kitchen', 'gm', 'agent'));

ALTER TABLE v2.telegram_chats
  ADD COLUMN IF NOT EXISTS agent_id text;

ALTER TABLE v2.telegram_chats
  ADD COLUMN IF NOT EXISTS active_mou_property_id uuid;

CREATE TABLE IF NOT EXISTS v2.telegram_staff_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties (id) ON DELETE CASCADE,
  tg_user_id bigint NOT NULL,
  staff_name text NOT NULL,
  role text NOT NULL
    CHECK (role IN ('fo', 'manager', 'hk', 'kitchen', 'gm')),
  linked_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (property_id, tg_user_id)
);

CREATE INDEX IF NOT EXISTS telegram_staff_links_property_idx
  ON v2.telegram_staff_links (property_id)
  WHERE active;

CREATE TABLE IF NOT EXISTS v2.telegram_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties (id) ON DELETE CASCADE,
  chat_id bigint NOT NULL,
  thread_id bigint NOT NULL,
  kind text NOT NULL
    CHECK (kind IN (
      'front_office',
      'housekeeping',
      'kitchen_pos',
      'management_audit',
      'guides_drivers'
    )),
  UNIQUE (property_id, chat_id, kind)
);

CREATE TABLE IF NOT EXISTS v2.agent_mou_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties (id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  status text NOT NULL
    CHECK (status IN (
      'draft',
      'pending_counterparty',
      'active',
      'suspended',
      'expired',
      'rejected'
    )),
  initiated_by text NOT NULL CHECK (initiated_by IN ('hotel', 'agent')),
  proposed_by_actor text NOT NULL,
  decided_by_actor text,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  expires_at timestamptz,
  credit_limit_btn numeric(14, 2) NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  UNIQUE (property_id, agent_id, status)
);

CREATE INDEX IF NOT EXISTS agent_mou_links_agent_status_idx
  ON v2.agent_mou_links (agent_id, status);

COMMENT ON TABLE v2.telegram_staff_links IS 'Hermes Telegram user → staff role ACL';
COMMENT ON TABLE v2.telegram_topics IS 'Ops super-group forum topic bindings';
COMMENT ON TABLE v2.agent_mou_links IS 'Bilateral hotel↔agent MoU lifecycle';
