# Performance + free-tier budget

Pelbu runs on **Vercel Hobby** + **Supabase Free**. Soft internal budgets stay at **≤70%** of published caps so the project never pauses mid-month.

## DNS / first-load checklist (P0)

Symptom: browser shows “can’t find DNS” / site unreachable, then loads after several seconds.

1. Production host is **CNAME (or ALIAS/ANAME) to Vercel** — not registrar URL forward. See [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md).
2. Apex (`pelbusuites.bt`) uses provider CNAME flattening or redirect-to-`www`.
3. Domain is **Added + Valid** in Vercel (HTTPS cert Issued).
4. Flagship hosts skip Supabase in middleware (`pelbusuites.bt`, `www`, `*.vercel.app`) via `lib/free-tier.ts`.
5. Supabase project is **Active** (not paused). Keep-alive is folded into `/api/cron/expire-holds` (daily DB touch).
6. Cold open of production URL must never show NXDOMAIN; delay should be TTFB/spinner only.

Verify locally:

```bash
nslookup pelbusuites.bt
nslookup www.pelbusuites.bt
curl -sI https://www.pelbusuites.bt | head
```

Checked 2026-09-10: both `pelbusuites.bt` and `www.pelbusuites.bt` resolve (Vercel anycast). Intermittent “can’t find DNS” is then usually cold origin / paused Supabase / long TTFB — not NXDOMAIN.

## Free-tier soft caps (≤70%)

| Meter | Soft target | Protection in app |
|-------|-------------|-------------------|
| Vercel Fast Data Transfer | ≤70 GB / 30d | Cloudinary images; ISR HTML; slim SSR |
| Vercel Function / Edge invocations | ≤700k / 30d | ISR cache hits; adaptive FO polls; light fingerprints |
| Vercel Image Optimization | avoid | Cloudinary loader only |
| Vercel Cron | ≤3 jobs | Keep-alive inside existing expire-holds cron |
| Supabase pause (7d inactivity) | never | Daily cron DB activity |
| Supabase egress / API | watch weekly | Aggregate fingerprints; windowed calendar; hidden-tab poll slowdown |

Check weekly: Vercel Usage + Supabase Usage. Alert mentally at **70%**.

## Performance budgets

| Route / action | Budget |
|----------------|--------|
| DNS resolve production host | ≤ 500ms; zero NXDOMAIN in normal use |
| `/` TTFB after warm CDN | ≤ 400ms p75 |
| `/` LCP mobile | ≤ 2.5s |
| `/` if Supabase slow | branded response within 3s (fail soft) |
| `/book` first preview | ≤ 1.2s |
| FO fingerprint | ≤ 80ms, ≤ 5KB; poll ≤ 15s visible, ≥ 60s hidden |
| StayHub Folio open (warm) | ≤ 800ms |
| Monthly free-tier usage | ≤ 70% of includes |

## How to re-measure

1. Lighthouse mobile on `/`, `/book`, `/rooms`, `/menu` (production or preview).
2. Desk: open StayHub Folio on an in-house stay; time to usable summary.
3. `GET /api/erp/front-desk-version` while logged in — check size and latency.
4. Screenshot Vercel + Supabase usage %.

## Ship gates / UAT (before merge)

- [ ] Cold open `https://www.pelbusuites.bt` — no NXDOMAIN; delay is spinner/TTFB only
- [ ] CMS edit → publish → hard refresh `/` within 5s shows new copy
- [ ] Mark menu item 86’d → `/menu` reflects within 15s (page stays dynamic)
- [ ] `/book?checkIn=…&checkOut=…` shows rates without waiting for a second client round-trip
- [ ] Today board: check-in on tab A updates tab B without full white flash
- [ ] StayHub: open in-house Folio without loading check-in; open arrival still loads check-in
- [ ] Vercel + Supabase usage still under ~70% soft cap after a desk day
- [ ] Kill-switch: `PUBLIC_FORCE_DYNAMIC=1` skips public data cache (loaders); tag bust refreshes HTML

