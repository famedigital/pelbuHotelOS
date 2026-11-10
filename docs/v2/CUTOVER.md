# Hotel OS v2 — Cutover & rollback (clean rebuild)

**Rule:** Innora Coolify `web` stays live until shadow diffs are clean **and** an owner sets `V2_DESK_CUTOVER=true`.

Canonical journeys: [`OPERATIONS-FLOW.md`](./OPERATIONS-FLOW.md). Schema isolation: [`adr/001-separate-v2-schema.md`](./adr/001-separate-v2-schema.md).

## Feature flag

| Env | Effect |
|---|---|
| `V2_DESK_CUTOVER=false` (default) | Staff on Innora `/erp/*` |
| `V2_DESK_CUTOVER=true` | Desk URL → `v2/apps/desk` behind `v2/apps/api` (schema `v2`) |

Do **not** delete `web/` on cutover day.

## Shadow run (2–4 weeks before flag)

1. Nightly ETL `public.*` → `v2.*` (re-runnable; MIGRATE rules in [SOURCE-MAP](./SOURCE-MAP.md)).
2. Run v2 night audit on imported data; compare room revenue, F&B, taxes, AR, occupancy to v1.
3. Every difference explained or filed as known v1 bug.

## Go / no-go

Harness (never flips the flag): `cd v2 && pnpm cutover:go-no-go`

FO FIT journey: `pnpm --filter @hos-v2/desk test:e2e:fo` (API `:4200` + desk `:5174`)

- [ ] Shadow diffs = 0 unexplained
- [ ] Restore drill from off-droplet `v2` dump passed
- [ ] Printers / keycards on-site
- [ ] Agents notified; portal logins sent
- [ ] Website DNS staged
- [ ] All §5 journeys green on `v2/` Playwright
- [ ] `v2_app` cannot `SELECT` from `public.bookings`

## Cutover night

1. Freeze v1 (read-only banner)
2. Final import; continue PSBN/INV from v1 last numbers
3. Flip desk URL + website domain
4. Smoke OPERATIONS-FLOW journeys

## Rollback (7 days)

Set `V2_DESK_CUTOVER=false`; unfreeze Innora. Export new `v2` records for diagnosis. Root Wave `apps/*` is **not** the rollback target.

## Legacy Wave smoke (reference only)

Older fo-spine / `apps/desk` e2e paths apply to root Waves only — not the clean `v2/` product.
