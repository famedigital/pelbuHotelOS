# Pelbu Suites — UAT checklist (go-live)

Use before cutting over from Excel. Desk PIN: `DESK_PIN`. Property slug: `pelbu-suites-olakha`.

## Public site
- [ ] Home / rooms / dine / spa / meeting / agents / contact load on mobile
- [ ] Book request creates `pending` booking
- [ ] Cafe/restaurant order creates KOT ticket on `/erp`
- [ ] Menu images + room blurbs resolve (Cloudinary)

## Desk — rooms
- [ ] `/erp/fast-book` overbooking guard (qty vs overlapping confirmed/checked_in)
- [ ] Guide number required for agent bookings
- [ ] Check-in requires guide; assigns guest + guide/driver beds
- [ ] Cancel / no-show frees inventory; ARI queued if channel mapped
- [ ] `/erp/rooms` HK status toggles

## Desk — money
- [ ] POS order → KOT board live refresh
- [ ] Post order / guest service to folio
- [ ] Folio payment (cash/bank/QR/Pay.bt/credit)
- [ ] Void charge line with reason (audit_events)
- [ ] Comp credit with reason
- [ ] Deposit link `/pay/{token}` + mark paid
- [ ] Night audit one run per business date
- [ ] `/erp/finance` expense + bank JSON import + match
- [ ] Reports CSV export (payments / expenses / folio lines)

## Agents
- [ ] Apply → approve → portal token
- [ ] Credit limit blocks over-limit on-credit book
- [ ] Agent voucher has **no** rates

## Channel (staging only)
- [ ] Map sellable room types to Channex IDs
- [ ] Set `CHANNEX_API_KEY` + external property id
- [ ] Queue 90d ARI → flush in staging
- [ ] Pull booking feed → ack after import

## Sign-off
| Role | Name | Date |
|------|------|------|
| Owner | | |
| Front desk | | |
| F&B | | |
