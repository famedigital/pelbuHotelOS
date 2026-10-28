# Hotel OS — Agent ownership

White-label multi-tenant hotel ERP with a public booking site plus `/erp`, `/staff`, and `/agents`. Production is the Coolify app on the droplet with self-hosted Supabase, not Vercel. Multi-agent build (**Cursor architect** + **z.ai/GLM implementer** + optional Claude polish). Respect ownership to avoid collisions and wasted tokens.

## Product shape

- Platform shell: `/erp`, `/staff`, `/agents` — each hotel is a tenant/property
- Pelbu Suites is **not** hard-coded; create it later as a tenant and copy data separately
- Default seed slug: `demo-hotel` (`DEFAULT_PROPERTY_SLUG`)

## Roles (token strategy)

| Role | Who | Job |
|------|-----|-----|
| Architect / reviewer | **Composer** (or Grok 4.5) — Cursor Models pool | Spec, schema, RLS, auth, money paths, review diffs, hard bugs |
| Implementer | z.ai **GLM-5.2** in a **second chat** | Bulk UI/components inside a locked brief |
| Visual polish (optional) | Claude on `claude/*` only when Other Models has headroom | Templates, copy, motion |

**Spend guard:** Prefer Composer / Grok / GLM. Avoid Claude/GPT in Agent when [Other Models](https://cursor.com/dashboard/usage) is ≥100% — that is on-demand. See `.cursor/rules/prefer-glm.mdc`.

**Do not** give z.ai unbounded “build everything” prompts — that creates buggy code and burns Cursor tokens fixing it. Always use a file-scoped brief (`/zai-handoff`).

## Branches

- `cursor/*` — schema, auth, ERP logic, integrations
- `zai/*` — implementer UI/work from a Cursor brief
- `claude/*` — templates, visual polish, marketing copy

## Cursor owns

- `supabase/` migrations, RLS (apply to droplet Postgres, not cloud Supabase)
- Rates in `web/src/lib/rates.ts` (`packages/db` and `packages/rates` are not in this repo)
- `scripts/bank-recon/`
- Auth middleware, Realtime / desk live refresh
- Check-in/out, folio, GST, agent credit, POS/KOT logic
- Finance, HR, inventory, night audit, deposit links
- Channex ARI queue / payments wiring
- Writing z.ai briefs and reviewing z.ai PRs/diffs

Feature history (do not treat as the live desk): [`docs/FEATURES.md`](docs/FEATURES.md). Module map: [`docs/PROJECT-AUDIT.md`](docs/PROJECT-AUDIT.md).

## z.ai owns (when briefed)

- Presentational components and page UI under `web/src/` listed in the brief
- Form layout/copy polish that already has server actions/contracts
- Boilerplate that copies existing patterns (`BookingForm`, `OrderForm`, `ConversionShell`)

## Claude owns

- `templates/*` visual systems (except wiring contracts)
- Marketing/SEO copy (when a tenant site exists elsewhere)
- Motion/art direction specs
- Parallel UI polish on `claude/*` branches

## Shared

- `web/` — z.ai/Claude do presentational work; Cursor does data/hooks/actions that touch DB money/auth
- Never commit secrets (`.env*`) or `backups/` (PII dumps)

## template_id

- Platform templates seed empty hotels; flagship mapping is env-driven (`FLAGSHIP_*`)
- Tenants clone from the chosen template — not a hard-coded Pelbu property

## Cursor commands

Slash commands in `.cursor/commands/`:

- `supabase-migrate` — apply DB migrations via plugin MCP
- `hotel-ops` — booking / check-in / folio modules
- `zai-handoff` — brief template for a GLM implementer chat

## Rules / skills

- `.cursor/rules/zai-implementer.mdc` — attach in every z.ai chat
- Keyword memory: `.cursor/memory/KEYWORDS.md` (hook injects matches; do not load the file whole)
- `.cursor/skills/pelbu-zai-handoff` — how Cursor should brief and review

## Subagents

No project `subagents/` folder. Parallel work = **second chat with GLM selected** (+ Task tool when needed). Ownership stays in this file.

## Model switching (important)

A `.cursor/rules` file **cannot** auto-select the model. Pick in the Agent dropdown:

- Default in this repo: **Composer** (included Cursor Models pool)
- Implementer second chat: **`GLM-5.2`** — see `.cursor/rules/prefer-glm.mdc`
- When using GLM, Base URL override is on; turn it **off** before switching back to Composer / Grok

## Cursor Cloud specific instructions

- The app is the Next.js project in `web/`. Install with `npm ci --include=dev` from that directory. `npm run dev` already binds `0.0.0.0:3000`. Open it at `http://localhost:3000`. Client components do not hydrate on `http://127.0.0.1:3000` because the dev HMR websocket upgrade fails for that origin.
- `npm run typecheck` and `npm run build` need `NODE_OPTIONS=--max-old-space-size=3072`. The default Node heap runs out of memory during `tsc`.
- `/`, `/pricing`, `/conditions`, `/demo`, and `GET /api/health` start without Supabase. Health returns `db: skipped`. Copy `web/.env.example` to `web/.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` before desk writes, `/book`, or `npm run build`. Do not commit `.env.local`.
- With `DESK_PIN` unset and `NODE_ENV` not `production`, `hasDeskPinSession()` treats the desk as already open, so `/erp/login` redirects to `/erp`, and `/erp` then throws until Supabase is configured. Set `DESK_PIN` in `web/.env.local` to render the login form.
- `npm test` does not need Supabase. Two test files import `vitest`, which is not a dependency, and `anyShiftCoversLocalNow` compares a fixed August date with today's calendar date.
