# Pelbu Suites — Agent ownership

Multi-agent build (**Cursor architect** + **z.ai/GLM implementer** + optional Claude polish). Respect ownership to avoid collisions and wasted tokens.

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

- `supabase/` migrations, RLS
- `packages/db`, `packages/rates`
- `scripts/bank-recon/`
- Auth middleware, Realtime subscriptions
- Check-in/out, folio, GST, agent credit, POS/KOT logic
- Channex / payments wiring
- Writing z.ai briefs and reviewing z.ai PRs/diffs

## z.ai owns (when briefed)

- Presentational components and page UI under `web/src/` listed in the brief
- Form layout/copy polish that already has server actions/contracts
- Boilerplate that copies existing patterns (`BookingForm`, `OrderForm`, `ConversionShell`)

## Claude owns

- `templates/*` visual systems (except wiring contracts)
- Marketing/SEO copy, menu prose
- Motion/art direction specs
- Parallel UI polish on `claude/*` branches

## Shared

- `web/` (and later ERP apps) — z.ai/Claude do presentational work; Cursor does data/hooks/actions that touch DB money/auth
- Never commit secrets (`.env*`)

## template_id

- `1` / `pelbu-flagship` = Pelbu Suites Olakha (primary)
- Tenants clone from template 1

## Cursor commands

Slash commands in `.cursor/commands/`:

- `flagship-pages` — build public conversion pages
- `supabase-migrate` — apply DB migrations via plugin MCP
- `hotel-ops` — booking / check-in / folio modules
- `zai-handoff` — brief template for a GLM implementer chat

## Rules / skills

- `.cursor/rules/zai-implementer.mdc` — attach in every z.ai chat
- `.cursor/skills/pelbu-zai-handoff` — how Cursor should brief and review

## Subagents

No project `subagents/` folder. Parallel work = **second chat with GLM selected** (+ Task tool when needed). Ownership stays in this file.

## Model switching (important)

A `.cursor/rules` file **cannot** auto-select the model. Pick in the Agent dropdown:

- Default in this repo: **Composer** (included Cursor Models pool)
- Implementer second chat: **`GLM-5.2`** — see `.cursor/rules/prefer-glm.mdc`
- When using GLM, Base URL override is on; turn it **off** before switching back to Composer / Grok

