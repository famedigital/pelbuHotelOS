---
name: pelbu-hotel-ops
description: >-
  Bhutan hotel desk ops for Hotel OS — StayHub, check-in/out, SDF, guide/driver
  beds, agent credit, folio, GST, seasons, KOT/POS, night audit on the droplet.
  Use when editing ERP booking, stay, money, or kitchen flows.
---

# Pelbu hotel ops

Desk truth: `docs/OPS-RUNBOOK.md`. `docs/FEATURES.md` is a historical August 2026 list. Do not use it to revert the desk, the host, or the palette.

## Stay channel

1. Book / rates → check-in → folio (day-1 rent) → POS as needed → night audit → checkout.
2. **StayHub is the only place a stay is edited.** The rack, Today, the book modal, check-in, POS, and laundry open that card. Lists are not a second editor.
3. A charge is a folio line (room night, POS, laundry, minibar). The guest or the agent is only the payor. `PS-…` is the confirmation. `INV-` is a print of the folio, issued only when the desk asks.
4. Lookup: `/erp/reservations` or Ctrl+K (guest, PS conf #, INV). Front office homes are **Today** and **Stay View**, not the arrivals list.
5. Business date: `properties.current_business_date` advances on night audit. Check-in waits if yesterday is not audited. A manager PIN override is audited.

## Auth

- Staff: employee code + PIN (property from `staff_members`).
- Shared `DESK_PIN` only with `ALLOW_DESK_PIN_IN_PROD=1` — escape hatch, not multi-hotel.
- Never share one DESK_PIN across hotels.

## Money safety

- Agent AR / void / comp / agreed rate: respect manager PIN thresholds.
- Agent checkout needs guide evidence. Open-room cap may block the stay.
- Payment webhooks: idempotent; do not double-post (`payments.idempotency_key`).
- Offline mode may park a book draft or a POS ticket. It must not park a folio charge, a payment, night audit, or a kitchen fire.
- Kitchen sees a desk or room-charge order immediately. A public pickup waits for desk confirm and the payment journal.

## Droplet

- Production is the Coolify container on the droplet, with self-hosted Supabase. `vercel.json` crons do not run.
- Night audit, hold expiry, and notification drain: `supabase/scripts/droplet-desk-cron.sh` with `Authorization: Bearer CRON_SECRET`. Midnight Thimphu is 18:00 UTC.
- The server talks to Postgres on the Docker network via `SUPABASE_INTERNAL_URL`. The browser stays on the hotel HTTPS host.
- Migrations: `psql` or the Supabase CLI into that Postgres. Cloud Supabase cannot see it. Do not wipe volumes to fix a migration.
- Channex stays uncertified until the money path is stable. Do not claim the channel is live.

## Agent release

Read logs and data, then change Git on a branch. Do not deploy onto the live desk until that commit is the release. Do not post folio charges or check guests out while investigating.

## Ownership

Cursor owns schema, auth, folio, POS/KOT logic, finance. Rates live in `web/src/lib/rates.ts`. Presentational UI may be briefed to z.ai per `AGENTS.md`.
