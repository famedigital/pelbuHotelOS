# Hotel OS v2 (clean rebuild)

**Specs:** [`../docs/v2/MODULES.md`](../docs/v2/MODULES.md) · [`SOURCE-MAP.md`](../docs/v2/SOURCE-MAP.md) · [`DESIGN-SYSTEM.md`](../docs/v2/DESIGN-SYSTEM.md)

## Doctrine

- **MERGE / COPY / REINVENT** — see SOURCE-MAP. Copy = re-type; never runtime-import Innora `web/` or root `apps/*` / `packages/*`.
- **Thin-page ban** — module-done gate in `docs/v2/IMPLEMENTATION.md`.
- **Schema** — Postgres schema `v2`, role `v2_app`, no grants on `public` (ADR 001).

## Workspace

| Path | Role |
|---|---|
| `apps/api` | Fastify + commands/events/outbox |
| `apps/desk` | Vite staff desk + `/partner` |
| `apps/web` | Vite + React 19 public marketing (innorahotel.com) |
| `packages/domain` | Pure tax, numbering, dates, auth, permissions |
| `packages/db` | Drizzle schema + SQL migrations |
| `packages/sync` | Offline **drafts only** (no money) |
| `packages/ui` | Glacier Glass kit |
| `packages/hardware` | ESC/POS, keycard interfaces |
| `_reference/` | Points at root Waves — open as anti-patterns / COPY shells only |

## Commands

```bash
pnpm install
pnpm typecheck
pnpm test
```

## Import ban

```bash
rg "@hotel-os/|from ['\"].*web/" apps packages
# must find nothing
```
