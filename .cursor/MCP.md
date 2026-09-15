# Cursor MCP on this droplet (Hotel OS)

## Copy for local secrets (gitignored)

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
# Reload Cursor Settings → MCP
```

`mcp.json` is gitignored. Only `.example` is committed.

## Servers

| Server | Status | Notes |
|--------|--------|--------|
| `playwright` | In example | Interactive browse / e2e assist. Enable in Cursor Settings → MCP. |
| Cloudinary | Deferred | Add when `CLOUDINARY_*` filled — see `docs/IMAGE_SERVER.md`. |
| Supabase plugin | Host Cursor plugins | OAuth via `mcp_auth`. **Does not replace** self-hosted migrate path. |

## Self-hosted database (important)

This droplet runs Supabase at `http://165.22.211.20:8001` in Docker.

- Cloud Supabase MCP (`mcp.supabase.com`) is for docs/advisors/cloud projects.
- Apply Hotel OS migrations with **Supabase CLI** or **`psql` into the Postgres container**.
- See `/root/.cursor/skills/droplet-coolify-ops/SKILL.md` and slash command `supabase-migrate`.

## Host-wide plugins

Supabase / Vercel / Magic Patterns are installed at the Cursor host level. Authenticate Supabase when prompted; defer Vercel/Magic Patterns until needed.
