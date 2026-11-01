# Enterprise money integrity — design (2026-11-02)

Cites: `enterprise-core.mdc` §2, `docs/architecture/ZERO-SUPERFICIAL-CODE.md`, `.cursor/skills/atomic-ledger-safety`, `.cursor/skills/pelbu-hotel-ops`.

## Schema map

| Pattern name | Live object |
|--------------|-------------|
| stays | `bookings` |
| folio_charges | `folio_lines` |
| idempotency store | `money_idempotency` + `payments.idempotency_key` |
| sequences | `property_sequences` / `next_property_sequence` |

## RPCs (migration `20261102130000_money_atomic_rpcs.sql`)

1. `post_folio_charge_atomic` — `FOR UPDATE` folio; insert `folio_lines`; cache result on `(property_id, idempotency_key)`.
2. `check_in_guest_atomic` — lock booking (+ optional room); set `checked_in`.
3. `settle_checkout_atomic` — lock booking/folio; optional balance gate; `desk_release_check_out_rooms`; set `checked_out`.

TypeScript gateways: `postFolioCharge` calls the charge RPC then journals GL; `confirmCheckIn` / `confirmCheckOut` call check-in / checkout RPCs. Journal posting remains in TS with compensating delete on GL failure (residual until GL is also SQL).

## Code 0

No stubs; property assert before RPC; structured errors; desk forms should send `idempotency_key` when available (server generates UUID if missing).
