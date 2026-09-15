---
name: pelbu-hotel-ops
description: >-
  Bhutan hotel desk ops for Hotel OS — check-in/out, SDF, guide/driver beds,
  agent credit, folio, GST, seasons, KOT/POS, night audit. Use when editing ERP
  booking, stay, money, or kitchen flows.
---

# Pelbu hotel ops

Canonical detail: `docs/OPS-RUNBOOK.md`, `docs/FEATURES.md`.

## Stay money cycle

1. Book / rates → check-in → folio (day-1 rent) → POS as needed → night audit → checkout.
2. Lookup: `/erp/reservations` or Ctrl+K (guest, PS conf #, INV).
3. Business date: `properties.current_business_date` advances on night audit.

## Auth

- Staff: employee code + PIN (property from `staff_members`).
- Shared `DESK_PIN` only with `ALLOW_DESK_PIN_IN_PROD=1` — escape hatch, not multi-hotel.
- Never share one DESK_PIN across hotels.

## Money safety

- Agent AR / void / comp: respect manager PIN thresholds.
- Payment webhooks: idempotent; do not double-post.
- Night audit cron uses `CRON_SECRET` when set.

## Ownership

Cursor owns schema, auth, folio, POS/KOT logic, finance. Presentational UI may be briefed to z.ai per `AGENTS.md`.
