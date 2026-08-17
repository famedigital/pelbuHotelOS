# Pelbu Suites — automated verification

How agents (and you) check routes, desk flows, money gates, and layout overflow **without** clicking every screen by hand.

## What this is / is not

| Automated layers | Still human |
|------------------|---------------|
| Route smoke (public + ERP nav) | Go-live money sign-off |
| Wave A–B click-through (calendar / StayHub / money surfaces) | Bhutan ops judgment (SDF, guide photo) |
| Seeded money-cycle e2e (when secrets set) | Brand / spacing *taste* |
| Document overflow at 375 / 1440 (no screenshots) | Full UAT-CHECKLIST end-to-end |
| Supabase advisors | |

Canonical go-live list: [UAT-CHECKLIST.md](UAT-CHECKLIST.md). Fault register for this wave: [VERIFICATION-FAULTS.md](VERIFICATION-FAULTS.md).

## One-time: Playwright MCP (interactive agent browse)

Playwright MCP is declared in [`.cursor/mcp.json`](../.cursor/mcp.json). Cursor **Settings → MCP** must show `playwright` **enabled** (green). Reload Cursor after toggling.

Without MCP, agents still run CLI smoke via `npm run test:e2e` in `web/`.

## Env (never commit secrets)

Add to `web/.env.local` (or shell):

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
# Prefer dedicated keys; helpers fall back to DESK_PIN when unset
PLAYWRIGHT_DESK_PIN=
# Or staff Auth:
# PLAYWRIGHT_DESK_EMAIL=
# PLAYWRIGHT_DESK_PASSWORD=
```

Money-cycle mutation tests also need a seeded property and stay; they **skip** (not fail) when secrets or seed flags are missing.

## Commands

```bash
cd web
# Dev server already running on :3000 recommended
npm run test:e2e
# Or subsets:
npx playwright test e2e/routes-smoke.spec.ts
npx playwright test e2e/wave-ab-clickthrough.spec.ts
npx playwright test e2e/layout-overflow.spec.ts
npx playwright test e2e/money-path.spec.ts e2e/money-cycle-seeded.spec.ts
```

Load local env when needed (Node loads secrets; do not echo PIN into the shell):

```bash
cd web
# PowerShell
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000"
node --env-file=.env.local ./node_modules/@playwright/test/cli.js test
```

Desk auth for e2e uses cookie `pelbu_desk_session=ok:{DESK_PIN}` (same as a successful Open desk). Form login is a fallback — prefer cookie to avoid rate limits after failed attempts.

## Wave map (reuse ERP audit)

| Wave | Focus | Spec |
|------|--------|------|
| Public + nav | Load / no crash | `routes-smoke.spec.ts` |
| A–B | Calendar, arrivals, StayHub language, rooms/HK, money surfaces | `wave-ab-clickthrough.spec.ts` |
| Money gate | Surfaces only vs full book→CI→pay→NA→CO | `money-path.spec.ts` / `money-cycle-seeded.spec.ts` |
| Layout | Horizontal overflow at 375 & 1440 — **no image files** | `layout-overflow.spec.ts` |

## Layout policy

Do **not** save Playwright screenshots into the repo. Overflow is asserted in-page (`scrollWidth` vs viewport). Fix collisions; skip pixel-diff baselines.
