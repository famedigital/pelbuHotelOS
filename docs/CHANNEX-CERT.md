# Channex certification checklist (post white-label)

Do **not** chase Channel maturity to 98 until Olakha Ops+Money are stable and you have run a live cert packet with real credentials.

## Wiring inventory (repo)

| Piece | Where | Ready? |
|-------|--------|--------|
| Env | `CHANNEX_API_KEY` (alias `CHANNEXT_API_KEY`), optional `CHANNEX_API_BASE`, `CHANNEX_WEBHOOK_SECRET` | **Human** — set in Vercel Preview + prod |
| Active property desk | `/erp/channel` via `requireDeskPropertyId` / `resolveActivePropertyId` | **Code** — not flagship-slug only |
| Connection bootstrap | `ensureChannexConnection` creates draft row per active property | **Code** |
| Desk map UI | `ChannelForms` — room type + rate plan map, mapping checklist | **Code** |
| ARI outbox kinds | `ari_queue`: `availability`, `rates`, `restrictions`, `full_sync` | **Code + migration** `20260802150000_ari_queue_rates_kind` |
| ARI enqueue | `enqueueFullAriWindow` — 90d availability + public rates + min_stay(1) / stop_sell(remaining=0) | **Code** |
| ARI flush / retry | `flushAriQueue` (pending) + `retryFailedAriJobs` (failed → pending) | **Code** — needs API key + staging/live |
| Channex HTTP | `pushAvailabilityBatch` → `POST /availability`; `pushRestrictionsBatch` → `POST /restrictions` | **Code** |
| Webhook ingress | `/api/channel/channex/webhook` — secret header; resolves property by `external_property_id` then flagship fallback | **Code** — needs webhook secret |
| Booking cancel / no-show | Desk actions enqueue ARI for stay window | **Code** |
| Host routing | `public_host` / `desk_host` + middleware | Foundation for multi-hotel later |

## Preconditions

- [ ] Staging Channex property + API key in env (`CHANNEX_*`)
- [ ] Room types **and** rate plans mapped in `/erp/channel` (checklist green)
- [ ] Connection status `staging` or `live` + Channex property id set
- [ ] Webhook secret set; ack-after-import gate verified
- [ ] Queue 90d ARI → Flush on Preview (not only local); retry failed if needed
- [ ] Host white-label foundation live (Settings → hostnames) if certing a non-flagship domain

## Live cert steps

1. Push availability / rates / restrictions for a 14–90 day window; confirm in Channex UI.
2. Receive a test booking webhook; revision appears under the correct property; import then Ack.
3. Modify / cancel from Channex; desk stays in sync (or documents known lag).
4. No-show / cancel from desk queues ARI correctly.
5. Capture screenshots + booking IDs for Channex support cert packet.

## Exit

Channel maturity may move toward 90–98 only after cert packet accepted.

Current honest score until then: **~50–55** (active-property desk + rates/restrictions outbox; not live cert).

See also: [OPS-RUNBOOK.md](OPS-RUNBOOK.md), [FEATURES.md](FEATURES.md).
