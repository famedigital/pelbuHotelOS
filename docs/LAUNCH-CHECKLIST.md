# Launch checklist — Pelbu Olakha (single-hotel)

Use before cutting over to production. Owner signs each box with **real initials** — do not invent sign-off.

## Environment (Vercel production)

- [ ] `CRON_SECRET` set (night-audit + expire-holds fail closed / authenticated)
- [ ] Staff Auth desk users ready; `DESK_PIN` only as single-hotel escape hatch
- [ ] If PIN still needed on launch day: `ALLOW_DESK_PIN_IN_PROD=1` — **remove** once staff Auth + `desk_role` covers the desk
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Cloudinary + Resend configured
- [ ] Optional: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- [ ] Optional: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for distributed rate limits (in-memory fallback works on single instance)
- [ ] Optional until Channel cert: `CHANNEX_API_KEY`, `CHANNEX_WEBHOOK_SECRET` (Preview first — see [CHANNEX-CERT.md](CHANNEX-CERT.md))

## Auth

- [ ] At least one `staff_members` row with `can_access_desk = true`, `desk_role`, and Auth login
- [ ] Supabase Dashboard → Authentication → Providers → enable **Leaked password protection** (HaveIBeenPwned)
- [ ] Confirm `/erp/login` works with staff Auth (and PIN only if `ALLOW_DESK_PIN_IN_PROD=1`)

## Smoke UAT (from docs/UAT-CHECKLIST.md)

- [ ] Public `/book` creates held booking
- [ ] Desk check-in assigns rooms + opens folio
- [ ] Folio payment posts + balance updates
- [ ] POS room charge → folio line + journal
- [ ] Manual night audit once for today's business date (or wait for cron `0 18 * * *` UTC)
- [ ] Finance pack spot-check: [FINANCE-UAT.md](FINANCE-UAT.md) (period / GST / edge journals)

## Data safety

- [ ] Supabase PITR / daily backups enabled on project
- [ ] Know who gets CallMeBot if night-audit cron fails — [OPS-RUNBOOK.md](OPS-RUNBOOK.md)

## Sign-off

| Role | Name | Date |
|------|------|------|
| Owner | | |
| Desk lead | | |

See also: [WHITEBOARD.md](WHITEBOARD.md) · [UAT-CHECKLIST.md](UAT-CHECKLIST.md) · [FINANCE-UAT.md](FINANCE-UAT.md) · [OPS-RUNBOOK.md](OPS-RUNBOOK.md) · [CHANNEX-CERT.md](CHANNEX-CERT.md) · [ERP-AUDIT.md](ERP-AUDIT.md).
