# Ops runbook — Pelbu Olakha

Short desk/owner checklist when something breaks after go-live.

## Front-desk stay money cycle

1. Book / rates (`/erp/rates`; **PS conf #** assigned on save)
2. Check-in → folio + **day-1 room rent** (+ meal if priced); agent **open room cap** may block
3. In-house StayHub **Folio**: Room + **POS** (F&B guest pay default; agent AR / agent tab optional)
4. Later nights → night audit; advances `current_business_date`
5. Collect cash or **Charge agent AR**; issue **INV** only if paperwork needed
6. Checkout — local when due clear / agent after guide evidence

Settings → Tax: *Post day-1 room rent at check-in* (default on). Kitchen publishes BF/dinner from `/erp/kitchen` to POS.

### Lookup (no separate search module)

| Need | Where |
|------|--------|
| Guest / phone / agent / **PS-… conf** / room | `/erp/reservations` search box or **Ctrl+K** |
| Tax invoice **INV-…** | Ctrl+K or `/erp/invoices` |
| Agent AR / packs | `/erp/agents/[id]` dossier Money |

### 30-minute FO / POS / kitchen shift script

| Role | Home | First 30 minutes |
|------|------|------------------|
| Front desk | `/erp/arrivals` | Scan arrivals → assign clean rooms → lead guest ID → check-in → Folio collect |
| Cashier / F&B | `/erp/pos` | Open register → room-charge tickets → settle walk-ins; escalate master folio to FO |
| Kitchen | `/erp/kitchen` | BF/L/D covers board → KDS pass → mark served; food-cost tabs are manager-only |
| HK / laundry | HK or laundry home | Dirty→clean queue; arrivals board shows readiness |

**Business date:** `properties.current_business_date` advances when night audit completes. Check-in is blocked if the prior day is not audited (manager PIN override audited). Greenfield properties skip the gate until the first audit runs.

**Groups:** Reservations party board links bookings; master folio attach lives on folio → Advanced (also noted on StayHub settle panel).

## Night audit cron

- Schedule: `0 18 * * *` UTC ≈ midnight Thimphu (`vercel.json`).
- Auth: `Authorization: Bearer CRON_SECRET` (required in production).
- Default policy: cron **completes** even with close-day blockers; blockers are stored on `night_audits.summary.blockers` and returned in the cron JSON.
- Strict mode: set `NIGHT_AUDIT_CRON_STRICT=1` to fail the cron when dirty rooms / open balances / rate variance / overdue departures exist (desk must clear or force-close manually first).
- Desk override: notes containing `force close` (audited).

## Hotel backup Excel pack (continuity)

Every successful night audit (desk or cron) builds a multi-sheet `.xlsx` hotel snapshot:

- **Ops sheets:** in-house, arrivals/departures, bookings (~±90d), folio lines, payments, open laundry.
- **Settings sheets:** property, rooms/types, seasons/rates, outlets/menu, laundry catalog, agents, staff (no auth secrets), dining tables.
- **Storage:** private bucket `night-audit-packs` at `{propertyId}/{YYYY-MM-DD}.xlsx` (overwrite per date).
- **Email:** Resend attachment to `NOTIFY_DESK_EMAIL` plus optional comma-list `OPS_BACKUP_EMAIL`. Failures never fail the audit.
- **Download:** `/erp/night-audit` → **Download hotel backup**, or `GET /api/erp/night-audit/continuity?date=YYYY-MM-DD` (money desk).
- **Habit:** save the nightly email to phone/USB. Treat as confidential owner/ops.
- **Import:** `pack_version = 1` in `_meta` is the future clean-state import contract; **importer not shipped yet**.

## Payments / webhooks

- Webhook: `/api/payments/webhook` — rate limited; HMAC when merchant credentials exist.
- Guest `/pay/[token]` is bank-instruction + hold countdown; desk or webhook marks paid.
- Idempotency: `payments.idempotency_key` unique per property — replays must not double-post.

## Observability

- Optional Sentry: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`.
- Cron failures call `captureServerError` (Sentry when configured).

## Auth / desk PIN

- Production: shared `DESK_PIN` ignored unless `ALLOW_DESK_PIN_IN_PROD=1`.
- Prefer staff Auth with `can_access_desk` + `desk_role`.
- **Never share one DESK_PIN across hotels** — each property uses its own staff Auth. The shared PIN is a single-hotel Olakha escape hatch only.

## Host white-label

- Settings → Identity → Public/desk hostnames.
- Settings → Identity → Org name & seats (tenant plan / seat_limit / billing_status read-only stub).
- Add the same hostnames in Vercel domains; middleware sets `x-pelbu-property-*`.
- Public CMS/content resolves Host first, then flagship slug.

## Channel (Channex)

- Follow [CHANNEX-CERT.md](CHANNEX-CERT.md) after Olakha money path is stable. Do not claim Channel 98 until live cert packet is accepted.

## Support / on-call (business)

- **24/7 staffing is a business choice**, not a code feature. Owner-operated coverage + this runbook is the shipped support model for Olakha.
- **Rota:** Fo 07:00–22:00 duty FO; **22:00–07:00** owner WhatsApp rota answers Night Audit / payment webhook / DESK lockouts. Print name next to [hang-card](ops/fo-ezee-to-pelbu-hang-card.md).
- On-call: who gets CallMeBot / phone when night-audit cron or payment webhook fails.
- Escalate channel cert / Pay.bt merchant issues to the owning vendor; keep screenshots in the cert packet.
- Trust checklist: [ops/wave-d-trust.md](ops/wave-d-trust.md) (Pay.bt live, agent AR void UAT).

## Night audit FO pack

- Every successful NA emails **FO flash summary + hotel backup xlsx** to `NOTIFY_DESK_EMAIL` / `OPS_BACKUP_EMAIL` (arrivals/departures sheets live inside the pack).
- Manager force-close: note contains `force close` (audited).

## Offline desk queue

- IndexedDB queue (`pelbu-desk-offline`) parks **hold drafts**, **book drafts**, and **POS park** tickets when fiber drops.
- **Not queued:** folio charges, payments, night audit, channel flush, or silent KOT fire — those stay online-only.
- After power/fiber restore: open POS → Open tickets / parks → settle or re-fire; never invent double KOTs.
- Calendar / POS show `DeskOfflineQueueStrip` when offline or when drafts are pending.

## F&B walk-in SOP (restaurant day)

1. Open **POS shift** (float) before guest money moves.
2. Seat table (Floor) → name/covers → order → **Send to kitchen** (status **ordered**).
3. Kitchen works **Kitchen TV** (`/erp/kds`); pass uses `/erp/kds/pass`.
4. Settle cash / bank transfer / mBoB / mPay / card / room charge; comps need manager discipline.
5. Shift **Closing** → printed X/Z tender sheet → count cash → manager PIN → close.
6. **Restaurant day pack** `/erp/kitchen/day-pack` for covers + outlet flash (not ledger books).
7. BFDA-ish logs: `/erp/kitchen/compliance` (waste, fridge temps, cleaning, LPG).
8. Hotel night audit still owns property day roll; POS variance feeds NA pack.

### Channels → kitchen

| Source | When kitchen sees ticket |
|--------|---------------------------|
| Desk walk-in / room charge | Immediately (open cook status) |
| Public pickup/taxi | After desk confirm + payment journal |
| Public in-room | Immediately on place (folio + stock) — settlement ≠ kitchen done |

### Product pack

Settings → Identity → **Product pack** `hotel` | `restaurant`. Restaurant hides rooms/calendar/front-desk/channels chrome; keeps POS/kitchen/inventory/finance/HR.

## Owner residual ops (after Waves 0–4)

Engineering waves are shipped. Owner still owns:

1. [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) + [FINANCE-UAT.md](FINANCE-UAT.md) — real initials only.
2. Enable Supabase HaveIBeenPwned leaked-password protection.
3. Set `CHANNEX_*` and complete [CHANNEX-CERT.md](CHANNEX-CERT.md).
4. Remove `ALLOW_DESK_PIN_IN_PROD` when staff Auth covers the desk.
5. Optional: Pay.bt credentials, `SENTRY_DSN`, Upstash Redis.

## UAT

- Launch: [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)
- Finance: [FINANCE-UAT.md](FINANCE-UAT.md) (includes edge journal proof checklist)
- Desk smoke: [UAT-CHECKLIST.md](UAT-CHECKLIST.md)
- Agent FO: [FO-AGENT-COMMERCE-CHECKLIST.md](FO-AGENT-COMMERCE-CHECKLIST.md)
- GST e-invoice stub: [GST-EINVOICE.md](GST-EINVOICE.md) — live when DRC mandates
- Map: [WHITEBOARD.md](WHITEBOARD.md)
- Features truth: [FEATURES.md](FEATURES.md)
