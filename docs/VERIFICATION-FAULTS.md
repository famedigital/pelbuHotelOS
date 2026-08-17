# Verification fault register (agent UAT)

**Date:** 2026-08-17  
**Method:** Playwright CLI smoke + Wave A–B click-through + layout overflow (no screenshot files) + Supabase security advisors.  
**Not proven:** full book→CI→pay→NA→CO against live bank; brand spacing taste.

Severity: **P0** money/inventory wrong · **P1** blocks desk shift · **P2** UX · **P3** polish.

## Setup status

| Item | Status |
|------|--------|
| Playwright MCP in `.cursor/mcp.json` | Declared (`npx @playwright/mcp`) |
| Cursor Settings → MCP → playwright enabled | **User must confirm green** (agent session may not see MCP tools until reload) |
| `DESK_PIN` in `web/.env.local` | Present |
| `PLAYWRIGHT_*` keys | Optional — e2e helpers fall back to `DESK_PIN` + `http://127.0.0.1:3000` |

## Supabase advisors (security) — 2026-08-17

| ID | Sev | Finding | Evidence | Action |
|----|-----|---------|----------|--------|
| ADV-01 | P2 | `btree_gist` in `public` schema | advisor `extension_in_public` | Move extension schema when convenient |
| ADV-02 | P1 | Anon can execute several `SECURITY DEFINER` RPCs | `bookings_assign_confirmation_code`, `next_property_sequence`, promo redeem/preview, marketing catalogue | Revoke anon EXECUTE or INVOKER where not intentional — see [Supabase lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) |
| ADV-03 | P2 | Authenticated can execute same DEFINER RPCs | lint 0029 | Tighten grants after desk paths reviewed |
| ADV-04 | P3 | Leaked password protection disabled | Auth advisor | Enable HaveIBeenPwned check in Supabase Auth |

## Playwright findings

**Run:** 2026-08-17 — `npx playwright test` (routes + Wave A–B + layout + money-path + money-cycle gate). **134 passed, 1 skipped** (money mutation gated), **0 failed**.

| ID | Sev | Wave | Finding | Route / CTA | Notes |
|----|-----|------|---------|-------------|-------|
| PW-01 | — | Setup | Desk login form rate-limit after wrong PIN targeting Staff Auth `name=pin` | `/erp/login` | Fixed: e2e injects `pelbu_desk_session=ok:{DESK_PIN}` cookie; form fallback uses **Desk PIN** label + **Open desk** |
| PW-02 | — | Layout | No horizontal overflow (>8px) at 375 / 1440 | Public + desk shell | No screenshot files |
| PW-03 | — | Nav | All ERP nav hrefs + public routes load without crash / login wall | See `ERP_NAV_HREFS` | Cookie session |
| PW-04 | — | A–B | Calendar / arrivals / rooms / money surfaces show expected copy | Wave A–B list | Surface smoke only |
| PW-05 | P3 | Money | Full book→CI→pay→NA→CO mutations not run | — | Requires `PLAYWRIGHT_MONEY_CYCLE=1` + human settle spot-check |

## Human still required

- One real stay: book → check-in → pay → night audit → check-out
- Sign off [UAT-CHECKLIST.md](UAT-CHECKLIST.md) money + agent sections
- Cursor Settings → MCP → enable **playwright** (green) for interactive agent browse (optional; CLI suite covers smoke)
