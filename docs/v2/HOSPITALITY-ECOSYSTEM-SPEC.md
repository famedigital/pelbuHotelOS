# Hospitality ecosystem — role companions (v2 desk)

Mobile-first workspaces for field roles around the hotel property. **Priority #1 is phone / handheld** (`<768px`): single-hand reach, ≥48px tap targets, `env(safe-area-inset-*)` padding. Desktop chrome may mirror the same data; never invert the hierarchy.

Cutover: these routes live on v2 desk only. Do **not** flip `V2_DESK_CUTOVER`.

## Roles

| Role | Route | Primary jobs |
|------|-------|----------------|
| Tour guide | `/ecosystem/guide` | Group roster, dietary badges, 1-tap arrival check-in, box-breakfast → KDS, driver call/WhatsApp |
| Driver / fleet | `/ecosystem/driver` | High-contrast outdoor UI, dorm bed, run sheet, 1-tap fuel/market advance → desk till |
| Staff handheld | `/housekeeping`, `/pos` (phone shells) | HK 2-col Clean/Dirty/Inspect; waiter table grid + Fire KOT + room charge; tip-pool SC share widget |
| B2B agent / TO | `/partner` | Masked availability (`Occupied · Tour Group`), 48h allotment + MoU rates, voucher PDF → master folio |

## Money & authority

- Box breakfast fires through existing POS `fireKot` / KDS path (no shadow tickets).
- Fuel/market cash advances use `procurement.issueAdvance` / `issueAdvanceRemote` (till float).
- Partner deposits / vouchers only credit AR after API ACK (`recordPayment` / folio link).
- Competitor masking uses domain `maskPartnerCalendar` — never leak guest/agent/rate.

## Touch & a11y

- Minimum hit area **48×48 CSS px** on phone companions and hallway tiles.
- Respect `prefers-reduced-motion` and opaque data cells (no blur on roster/grids).

## Status

Implemented on desk modules under `v2/apps/desk/src/modules/ecosystem/` + mobile shells + partner portal enhancements (2026-11-08).
