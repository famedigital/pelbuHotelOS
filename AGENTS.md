# Hotel OS — Agent ownership

White-label multi-tenant hotel ERP with a public booking site plus `/erp`, `/staff`, and `/agents`. Production is the Coolify app on the droplet with self-hosted Supabase, not Vercel. Multi-agent build (**Cursor architect** + **z.ai/GLM implementer** + optional Claude polish). Respect ownership to avoid collisions and wasted tokens.

## Product shape

- Platform shell: `/erp`, `/staff`, `/agents` — each hotel is a tenant/property
- Pelbu Suites is **not** hard-coded; create it later as a tenant and copy data separately
- Default seed slug: `demo-hotel` (`DEFAULT_PROPERTY_SLUG`)

### Hotel OS v2 (live FO) + Innora archive

- Live desk/API: [`v2/`](v2/) (Vite desk + Fastify). FO URL: `desk-v2.*.sslip.io`
- Frozen Innora source: [`v1/web/`](v1/web/) — see [`v1/README.md`](v1/README.md)
- Spec: [`docs/v2/ENTERPRISE-SPEC.md`](docs/v2/ENTERPRISE-SPEC.md) · status: [`docs/v2/IMPLEMENTATION.md`](docs/v2/IMPLEMENTATION.md)
- Root `apps/*` / Wave packages are legacy experiment paths; do not treat as production desk
- Additive migrations under `supabase/migrations/` still apply to droplet Postgres

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
- Rates / desk money paths in `v2/` (archive reference: `v1/web/src/lib/rates.ts`)
- `scripts/bank-recon/`
- Auth middleware, Realtime / desk live refresh
- Check-in/out, folio, GST, agent credit, POS/KOT logic
- Finance, HR, inventory, night audit, deposit links
- Channex ARI queue / payments wiring
- Writing z.ai briefs and reviewing z.ai PRs/diffs

Feature history (do not treat as the live desk): [`docs/FEATURES.md`](docs/FEATURES.md). Module map: [`docs/PROJECT-AUDIT.md`](docs/PROJECT-AUDIT.md).

## z.ai owns (when briefed)

- Presentational components under `v2/apps/desk/` listed in the brief
- Form layout/copy polish that already has server/API contracts
- Boilerplate that copies existing v2 desk patterns

## Claude owns

- `templates/*` visual systems (except wiring contracts)
- Marketing/SEO copy (when a tenant site exists elsewhere)
- Motion/art direction specs
- Parallel UI polish on `claude/*` branches

## Shared

- Live UI: `v2/` — z.ai/Claude presentational; Cursor money/auth/schema
- Archive only: `v1/web/` — do not extend as production
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

**Always-on rules**

- [`.cursor/rules/enterprise-core.mdc`](.cursor/rules/enterprise-core.mdc) — money atomics, tenant scope, verify-before-done
- [`.cursor/rules/3d-glassmorphism.mdc`](.cursor/rules/3d-glassmorphism.mdc) — dual-tier glass (opaque rack cells; glass chrome)

**Architecture (Code 0 + stack)**

- [`docs/architecture/ZERO-SUPERFICIAL-CODE.md`](docs/architecture/ZERO-SUPERFICIAL-CODE.md) — no stubs/mocks/phantom schema
- [`docs/architecture/TECH-STACK-UPGRADES.md`](docs/architecture/TECH-STACK-UPGRADES.md) — LRU middleware, Next opts, indexes
- [`docs/architecture/3D-GLASSMORPHISM-DESIGN-SYSTEM.md`](docs/architecture/3D-GLASSMORPHISM-DESIGN-SYSTEM.md)

**Phase order:** money integrity → RLS/audit → desk glass chrome → public 3D explorer. Do not mix money RPCs and full UI redesign in one unbounded prompt.

**Invoke skills by domain**

| Work | Skill |
|------|--------|
| Folio / checkout / payments | `.cursor/skills/atomic-ledger-safety` + `.cursor/skills/pelbu-hotel-ops` |
| Desk UI chrome / glass / R3F | `.cursor/skills/high-perf-glassmorphism` + `.cursor/skills/pelbu-design-system` |

Also:

- `.cursor/rules/desk-ops-invariants.mdc` — StayHub-only editor, offline money ban, PIN
- `.cursor/rules/zai-implementer.mdc` — attach in every z.ai chat
- Keyword memory: `.cursor/memory/KEYWORDS.md` (hook injects matches; do not load the file whole)
- `.cursor/skills/pelbu-zai-handoff` — how Cursor should brief and review

**Schema reality:** examples saying `stays` / `folio_charges` mean `bookings` / `folio_lines`.

## Subagents

No project `subagents/` folder. Parallel work = **second chat with GLM selected** (+ Task tool when needed). Ownership stays in this file.

## Model switching (important)

A `.cursor/rules` file **cannot** auto-select the model. Pick in the Agent dropdown:

- Default in this repo: **Composer** (included Cursor Models pool)
- Implementer second chat: **`GLM-5.2`** — see `.cursor/rules/prefer-glm.mdc`
- When using GLM, Base URL override is on; turn it **off** before switching back to Composer / Grok
