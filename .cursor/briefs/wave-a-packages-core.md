# Wave A — packages/core (Hotel OS v2 complete)

Repo: `c:\GitHub\Hotel OS Bhutan`
Goal: shared money core so local `/v2` posts charges/payments/checkout/night audit with the SAME GL path as Innora. Do NOT edit `web/src/app/erp/**`. Cutover flag stays false.

## Done means
1. Create `packages/core` (`@hotel-os/core`) in pnpm workspace — TypeScript ESM like `@hotel-os/engine`.
2. Move framework-free money/ops from `web/src/lib` into `@hotel-os/core` (prefer move + re-export shims so Innora keeps working):
   - Priority: `folio/post-charge.ts`, `folio/post-payment.ts`, `folio/void-line.ts`, `folio/open-folio.ts`, `accounting/*` (period-guard, posting, journals, sequences, types), `night-audit/run.ts` + needed night-audit helpers, `business-date.ts`, pricing/rates helpers used by folio posting.
3. Replace `import "server-only"` and `@/lib/supabase/admin` with injected `Admin` client type (Supabase-like). No `next/*` inside core.
4. `web/src/lib/...` re-exports from `@hotel-os/core` OR thin wrappers that inject admin — v1 behaviour unchanged.
5. Wire `apps/api` folio adapters (`adapters/folio.ts`, `folio-rpc.ts`, night-audit) so charge/payment/checkout go through core (period lock + journals + round-off), not bare RPC-only when that skips GL.
6. Real night audit path: room nights, no-shows, `night_audits`, business date — not the no-op `run_night_audit_v2` shim.
7. Verify: `pnpm typecheck:v2` green for packages touched; do not invent schema — check `supabase/migrations/`.
8. Update `docs/v2/IMPLEMENTATION.md` Wave A status honestly.

## Hard rules
- Atomic money: existing Postgres RPCs + GL posting as v1 does. Idempotency UUID required.
- No TODO stubs, no mock arrays, no empty catch, no `any`.
- Do not set `V2_DESK_CUTOVER=true`.
- Do not commit secrets.

## Out of scope this wave
- `/v2` UI polish (Wave B+), marketplace, editing `/erp` pages.
