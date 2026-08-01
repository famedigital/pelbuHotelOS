# Ops runbook — Pelbu Olakha

Short desk/owner checklist when something breaks after go-live.

## Night audit cron

- Schedule: `0 18 * * *` UTC ≈ midnight Thimphu (`vercel.json`).
- Auth: `Authorization: Bearer CRON_SECRET` (required in production).
- Default policy: cron **completes** even with close-day blockers; blockers are stored on `night_audits.summary.blockers` and returned in the cron JSON.
- Strict mode: set `NIGHT_AUDIT_CRON_STRICT=1` to fail the cron when dirty rooms / open balances / rate variance / overdue departures exist (desk must clear or force-close manually first).
- Desk override: notes containing `force close` (audited).

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
- On-call: who gets CallMeBot / phone when night-audit cron or payment webhook fails.
- Escalate channel cert / Pay.bt merchant issues to the owning vendor; keep screenshots in the cert packet.

## Offline desk queue

- IndexedDB queue (`pelbu-desk-offline`) parks **hold drafts**, **book drafts**, and **POS park** tickets when fiber drops.
- **Not queued:** folio charges, payments, night audit, channel flush — those stay online-only.
- Calendar shows `DeskOfflineQueueStrip` when offline or when drafts are pending.

## UAT

- Launch: [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)
- Finance: [FINANCE-UAT.md](FINANCE-UAT.md) (includes edge journal proof checklist)
- Desk smoke: [UAT-CHECKLIST.md](UAT-CHECKLIST.md)
- GST e-invoice stub: [GST-EINVOICE.md](GST-EINVOICE.md) — live when DRC mandates
