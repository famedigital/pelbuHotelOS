# supabase-migrate

Apply Hotel OS migrations to the **self-hosted** Supabase/Postgres on this droplet.

1. Read `/root/.cursor/skills/droplet-coolify-ops/SKILL.md` (self-hosted DB section).
2. List new files under `supabase/migrations/`.
3. Apply via Supabase CLI or `psql` into the Postgres container — **not** cloud MCP alone.
4. Verify with a smoke query; do not reset volumes without user OK.
