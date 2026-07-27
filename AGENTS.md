# Pelbu Suites — Agent ownership

Multi-agent build (Cursor + Claude). Respect file ownership to avoid collisions.

## Branches

- `cursor/*` — schema, auth, ERP logic, integrations
- `claude/*` — templates, visual polish, marketing copy

## Cursor owns

- `supabase/` migrations, RLS
- `packages/db`, `packages/rates`
- `scripts/bank-recon/`
- Auth middleware, Realtime subscriptions
- Check-in/out, folio, GST, agent credit, POS/KOT logic
- Channex / payments wiring

## Claude owns

- `templates/*` visual systems (except wiring contracts)
- Marketing/SEO copy, menu prose
- Motion/art direction specs
- Parallel UI polish on `claude/*` branches

## Shared

- `apps/web`, `apps/erp` — coordinate; Claude does presentational components, Cursor does data/hooks
- Never commit secrets (`.env*`)

## template_id

- `1` / `pelbu-flagship` = Pelbu Suites Olakha (primary)
- Tenants clone from template 1

## Stack

Vercel · Supabase · Resend · CallMeBot · **Cloudinary** (primary image CDN + Cursor MCP) · PWA · Realtime

Image MCP: `.cursor/mcp.json` → `cloudinary-assets`. Details: `docs/IMAGE_SERVER.md`.
